import dotenv from 'dotenv';

// Load environment variables first
dotenv.config();

import { google } from 'googleapis';
import Manager from '../models/Manager.js';
import processEmailWithOpenAI from './processEmailWithOpenAI.js';
import sendToGoogleSheet from './sendToGoogleSheet.js';
import { isClientEmail } from '../utils/emailUtils.js';


export default async function checkNewEmailsAndProcess() {
  const managers = await Manager.find();

  for (const manager of managers) {
    try {
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

      const gmail = google.gmail({ version: 'v1', auth: oAuth2Client });

      // Get client emails for filtering
      const clientEmails = manager.clients.map(client => client.email.toLowerCase());

      const listRes = await gmail.users.messages.list({
        userId: 'me',
        q: 'in:inbox',
        maxResults: 10
      });

      const messageList = listRes.data.messages || [];

      const newMessages = messageList.filter(msg =>
        !manager.messages.some(m => m.id === msg.id)
      );

      for (const msg of newMessages) {
        const full = await gmail.users.messages.get({
          userId: 'me',
          id: msg.id,
          format: 'full'
        });

        // Extract sender email from headers
        const headers = full.data.payload.headers || [];
        const fromHeader = headers.find(h => h.name.toLowerCase() === 'from')?.value || '';
        const senderEmail = extractEmailFromHeader(fromHeader);

        // Only process emails from known clients
        if (!isClientEmail(senderEmail, clientEmails)) {
          console.log(`⏭️ Skipping email from non-client: ${senderEmail}`);
          // Still mark as processed to avoid reprocessing
          manager.messages.push({ id: msg.id, stage: 'skipped' });
          continue;
        }

        const rawText = extractTextFromMessage(full);

        if (!rawText) continue;

        manager.messages.push({ id: msg.id, stage: 'processing' });
        await manager.save();

        try {
          const gptData = await processEmailWithOpenAI(rawText, manager.email);

          if (gptData) {
            await sendToGoogleSheet(manager, gptData);
            updateMessageStage(manager, msg.id, 'success');
            
            // Update client response count
            const client = manager.clients.find(c => c.email.toLowerCase() === senderEmail.toLowerCase());
            if (client) {
              client.responseCount += 1;
            }
          } else {
            updateMessageStage(manager, msg.id, 'error');
          }
        } catch (e) {
          console.error(`❌ Ошибка при обработке письма ${msg.id}`, e);
          updateMessageStage(manager, msg.id, 'retry');
        }
      }

      await manager.save();
    } catch (err) {
      console.error(`Ошибка при проверке ${manager.email}:`, err);
    }
  }
}

function extractEmailFromHeader(fromHeader) {
  const emailMatch = fromHeader.match(/<([^>]+)>/) || fromHeader.match(/([^\s<>]+@[^\s<>]+)/);
  return emailMatch ? emailMatch[1].toLowerCase() : '';
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

function updateMessageStage(manager, messageId, stage) {
  const message = manager.messages.find(m => m.id === messageId);
  if (message) message.stage = stage;
}
