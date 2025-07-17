import dotenv from 'dotenv';
dotenv.config();

import { google } from 'googleapis';
import Manager from '../models/Manager.js';
import processEmailWithOpenAI from './processEmailWithOpenAI.js';
import sendToGoogleSheet from './sendToGoogleSheet.js';

const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY_HOURS = 2;

export default async function retryFailedMessages() {
  const managers = await Manager.find();

  for (const manager of managers) {
    try {
      // Find messages that need retry
      const failedMessages = manager.messages.filter(msg => 
        msg.stage === 'retry' || msg.stage === 'error'
      );

      if (failedMessages.length === 0) continue;

      console.log(`🔄 Found ${failedMessages.length} failed messages for ${manager.email}`);

      const oAuth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI
      );

      oAuth2Client.setCredentials({
        access_token: manager.accessToken,
        refresh_token: manager.refreshToken,
        expiry_date: manager.tokenExpiryDate?.getTime()
      });

      // Refresh token if needed
      if (manager.tokenExpiryDate < new Date()) {
        const { credentials } = await oAuth2Client.refreshAccessToken();
        await Manager.findOneAndUpdate(
          { email: manager.email },
          {
            accessToken: credentials.access_token,
            refreshToken: credentials.refresh_token || manager.refreshToken,
            tokenExpiryDate: credentials.expiry_date ? new Date(credentials.expiry_date) : null
          }
        );
        oAuth2Client.setCredentials(credentials);
      }

      const gmail = google.gmail({ version: 'v1', auth: oAuth2Client });

      for (const failedMsg of failedMessages) {
        // Check if enough time has passed since last attempt
        const timeSinceCreation = Date.now() - failedMsg.createdAt.getTime();
        const hoursElapsed = timeSinceCreation / (1000 * 60 * 60);

        if (hoursElapsed < RETRY_DELAY_HOURS) {
          continue; // Not enough time has passed
        }

        // Check retry count
        const retryCount = failedMsg.retryCount || 0;
        if (retryCount >= MAX_RETRY_ATTEMPTS) {
          failedMsg.stage = 'failed_permanently';
          console.log(`❌ Message ${failedMsg.id} failed permanently after ${MAX_RETRY_ATTEMPTS} attempts`);
          continue;
        }

        try {
          console.log(`🔄 Retrying message ${failedMsg.id} (attempt ${retryCount + 1})`);

          // Get the email content again
          const full = await gmail.users.messages.get({
            userId: 'me',
            id: failedMsg.id,
            format: 'full'
          });

          const rawText = extractTextFromMessage(full);
          if (!rawText) {
            failedMsg.stage = 'failed_permanently';
            continue;
          }

          // Extract sender email for client filtering
          const headers = full.data.payload.headers || [];
          const fromHeader = headers.find(h => h.name.toLowerCase() === 'from')?.value || '';
          const senderEmail = extractEmailFromHeader(fromHeader);

          // Check if it's from a client
          const clientEmails = manager.clients.map(client => client.email.toLowerCase());
          if (!clientEmails.includes(senderEmail.toLowerCase())) {
            failedMsg.stage = 'skipped';
            continue;
          }

          failedMsg.stage = 'processing';
          failedMsg.retryCount = retryCount + 1;

          const gptData = await processEmailWithOpenAI(rawText, manager.email);

          if (gptData) {
            await sendToGoogleSheet(manager, gptData);
            failedMsg.stage = 'success';
            console.log(`✅ Successfully processed message ${failedMsg.id} on retry`);

            // Update client response count
            const client = manager.clients.find(c => c.email.toLowerCase() === senderEmail.toLowerCase());
            if (client) {
              client.responseCount += 1;
            }
          } else {
            failedMsg.stage = 'retry';
            console.log(`⚠️ Retry failed for message ${failedMsg.id}, will try again later`);
          }

        } catch (error) {
          console.error(`❌ Retry failed for message ${failedMsg.id}:`, error);
          failedMsg.stage = 'retry';
          failedMsg.retryCount = retryCount + 1;
          failedMsg.lastError = error.message;
        }
      }

      await manager.save();

    } catch (error) {
      console.error(`Error retrying messages for ${manager.email}:`, error);
    }
  }
}

function extractTextFromMessage(msg) {
  try {
    const parts = msg.data.payload.parts;
    const part = parts?.find(p => p.mimeType === 'text/plain');
    const raw = part?.body?.data || msg.data.payload?.body?.data;
    return raw ? Buffer.from(raw, 'base64').toString('utf-8') : '';
  } catch {
    return '';
  }
}

function extractEmailFromHeader(fromHeader) {
  const emailMatch = fromHeader.match(/<([^>]+)>/) || fromHeader.match(/([^\s<>]+@[^\s<>]+)/);
  return emailMatch ? emailMatch[1].toLowerCase() : '';
}