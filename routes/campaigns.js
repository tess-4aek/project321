import express from 'express';
import { google } from 'googleapis';
import Manager from '../models/Manager.js';
import Campaign from '../models/Campaign.js';

const router = express.Router();

const oAuth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
);

// Create and start email campaign
router.post('/start', async (req, res) => {
    const { managerEmail, subject, message, template } = req.body;

    if (!managerEmail || !subject || !message) {
        return res.status(400).json({ 
            error: 'Manager email, subject, and message are required' 
        });
    }

    try {
        const manager = await Manager.findOne({ email: managerEmail });
        if (!manager) {
            return res.status(404).json({ error: 'Manager not found' });
        }

        if (!manager.clients || manager.clients.length === 0) {
            return res.status(400).json({ error: 'No clients found for this manager' });
        }

        // Create campaign record
        const campaign = new Campaign({
            managerId: manager._id,
            managerEmail: manager.email,
            subject,
            message,
            template,
            totalRecipients: manager.clients.length,
            status: 'starting'
        });

        await campaign.save();

        // Start sending emails in background
        sendCampaignEmails(campaign, manager);

        res.json({
            message: 'Campaign started successfully',
            campaignId: campaign._id,
            totalRecipients: manager.clients.length
        });
    } catch (error) {
        console.error('Error starting campaign:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get campaign status
router.get('/status/:campaignId', async (req, res) => {
    const { campaignId } = req.params;

    try {
        const campaign = await Campaign.findById(campaignId);
        if (!campaign) {
            return res.status(404).json({ error: 'Campaign not found' });
        }

        res.json({
            campaign: {
                id: campaign._id,
                status: campaign.status,
                totalRecipients: campaign.totalRecipients,
                sentCount: campaign.sentCount,
                failedCount: campaign.failedCount,
                createdAt: campaign.createdAt,
                completedAt: campaign.completedAt,
                recipients: campaign.recipients
            }
        });
    } catch (error) {
        console.error('Error fetching campaign status:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get all campaigns for a manager
router.get('/list/:managerEmail', async (req, res) => {
    const { managerEmail } = req.params;

    try {
        const campaigns = await Campaign.find({ managerEmail })
            .sort({ createdAt: -1 })
            .limit(20);

        res.json({
            campaigns: campaigns.map(c => ({
                id: c._id,
                subject: c.subject,
                status: c.status,
                totalRecipients: c.totalRecipients,
                sentCount: c.sentCount,
                failedCount: c.failedCount,
                createdAt: c.createdAt,
                completedAt: c.completedAt
            }))
        });
    } catch (error) {
        console.error('Error fetching campaigns:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Function to send campaign emails
async function sendCampaignEmails(campaign, manager) {
    try {
        campaign.status = 'sending';
        await campaign.save();

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

        for (const client of manager.clients) {
            if (client.status !== 'active') continue;

            try {
                // Personalize message if client has name
                let personalizedMessage = campaign.message;
                if (client.name) {
                    personalizedMessage = personalizedMessage.replace(/\{name\}/g, client.name);
                }

                const encodedSubject = `=?UTF-8?B?${Buffer.from(campaign.subject).toString('base64')}?=`;

                const email = [
                    `To: ${client.email}`,
                    `Subject: ${encodedSubject}`,
                    'Content-Type: text/plain; charset="UTF-8"',
                    'MIME-Version: 1.0',
                    '',
                    personalizedMessage
                ].join('\n');

                const encodedEmail = Buffer.from(email, 'utf-8')
                    .toString('base64')
                    .replace(/\+/g, '-')
                    .replace(/\//g, '_')
                    .replace(/=+$/, '');

                await gmail.users.messages.send({
                    userId: 'me',
                    requestBody: {
                        raw: encodedEmail
                    }
                });

                // Update campaign progress
                campaign.sentCount += 1;
                campaign.recipients.push({
                    email: client.email,
                    status: 'sent',
                    sentAt: new Date()
                });

                console.log(`✅ Email sent to ${client.email}`);

                // Small delay to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 1000));

            } catch (error) {
                console.error(`❌ Failed to send email to ${client.email}:`, error);
                campaign.failedCount += 1;
                campaign.recipients.push({
                    email: client.email,
                    status: 'failed',
                    error: error.message,
                    sentAt: new Date()
                });
            }
        }

        campaign.status = 'completed';
        campaign.completedAt = new Date();
        await campaign.save();

        console.log(`🎉 Campaign completed: ${campaign.sentCount} sent, ${campaign.failedCount} failed`);

    } catch (error) {
        console.error('Campaign error:', error);
        campaign.status = 'failed';
        campaign.error = error.message;
        await campaign.save();
    }
}

export default router;