import express from 'express';
import Manager from '../models/Manager.js';
import Campaign from '../models/Campaign.js';

const router = express.Router();

// Get manager analytics dashboard
router.get('/dashboard/:managerEmail', async (req, res) => {
    const { managerEmail } = req.params;

    try {
        const manager = await Manager.findOne({ email: managerEmail });
        if (!manager) {
            return res.status(404).json({ error: 'Manager not found' });
        }

        // Get campaign statistics
        const campaigns = await Campaign.find({ managerEmail });
        const totalCampaigns = campaigns.length;
        const completedCampaigns = campaigns.filter(c => c.status === 'completed').length;
        const totalEmailsSent = campaigns.reduce((sum, c) => sum + c.sentCount, 0);
        const totalEmailsFailed = campaigns.reduce((sum, c) => sum + c.failedCount, 0);

        // Client statistics
        const totalClients = manager.clients.length;
        const activeClients = manager.clients.filter(c => c.status === 'active').length;
        const clientsWithResponses = manager.clients.filter(c => c.responseCount > 0).length;
        const totalResponses = manager.clients.reduce((sum, c) => sum + c.responseCount, 0);

        // Message processing statistics
        const messageStats = {
            total: manager.messages.length,
            pending: manager.messages.filter(m => m.stage === 'pending').length,
            processing: manager.messages.filter(m => m.stage === 'processing').length,
            success: manager.messages.filter(m => m.stage === 'success').length,
            error: manager.messages.filter(m => m.stage === 'error').length,
            retry: manager.messages.filter(m => m.stage === 'retry').length,
            skipped: manager.messages.filter(m => m.stage === 'skipped').length,
            failed_permanently: manager.messages.filter(m => m.stage === 'failed_permanently').length
        };

        // Response rate calculation
        const responseRate = totalEmailsSent > 0 ? (totalResponses / totalEmailsSent * 100).toFixed(2) : 0;
        const successRate = totalEmailsSent > 0 ? ((totalEmailsSent - totalEmailsFailed) / totalEmailsSent * 100).toFixed(2) : 0;

        // Recent activity (last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const recentCampaigns = campaigns.filter(c => c.createdAt >= thirtyDaysAgo).length;
        const recentResponses = manager.messages.filter(m => 
            m.createdAt >= thirtyDaysAgo && m.stage === 'success'
        ).length;

        res.json({
            manager: {
                email: manager.email,
                connectedAt: manager.createdAt
            },
            campaigns: {
                total: totalCampaigns,
                completed: completedCampaigns,
                recent: recentCampaigns,
                successRate: `${successRate}%`
            },
            emails: {
                sent: totalEmailsSent,
                failed: totalEmailsFailed,
                successRate: `${successRate}%`
            },
            clients: {
                total: totalClients,
                active: activeClients,
                withResponses: clientsWithResponses,
                responseRate: `${responseRate}%`
            },
            responses: {
                total: totalResponses,
                recent: recentResponses,
                rate: `${responseRate}%`
            },
            messageProcessing: messageStats
        });

    } catch (error) {
        console.error('Error fetching analytics:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get detailed client performance
router.get('/clients/:managerEmail', async (req, res) => {
    const { managerEmail } = req.params;

    try {
        const manager = await Manager.findOne({ email: managerEmail });
        if (!manager) {
            return res.status(404).json({ error: 'Manager not found' });
        }

        const clientAnalytics = manager.clients.map(client => ({
            email: client.email,
            name: client.name,
            status: client.status,
            addedAt: client.addedAt,
            responseCount: client.responseCount,
            lastEmailSent: client.lastEmailSent,
            notes: client.notes
        })).sort((a, b) => b.responseCount - a.responseCount);

        res.json({
            clients: clientAnalytics,
            summary: {
                totalClients: manager.clients.length,
                activeClients: manager.clients.filter(c => c.status === 'active').length,
                topResponders: clientAnalytics.slice(0, 5),
                averageResponseRate: clientAnalytics.length > 0 
                    ? (clientAnalytics.reduce((sum, c) => sum + c.responseCount, 0) / clientAnalytics.length).toFixed(2)
                    : 0
            }
        });

    } catch (error) {
        console.error('Error fetching client analytics:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get campaign performance details
router.get('/campaigns/:managerEmail', async (req, res) => {
    const { managerEmail } = req.params;

    try {
        const campaigns = await Campaign.find({ managerEmail })
            .sort({ createdAt: -1 });

        const campaignAnalytics = campaigns.map(campaign => {
            const successRate = campaign.totalRecipients > 0 
                ? ((campaign.sentCount / campaign.totalRecipients) * 100).toFixed(2)
                : 0;

            return {
                id: campaign._id,
                subject: campaign.subject,
                status: campaign.status,
                createdAt: campaign.createdAt,
                completedAt: campaign.completedAt,
                totalRecipients: campaign.totalRecipients,
                sentCount: campaign.sentCount,
                failedCount: campaign.failedCount,
                successRate: `${successRate}%`,
                duration: campaign.completedAt 
                    ? Math.round((campaign.completedAt - campaign.createdAt) / (1000 * 60)) + ' minutes'
                    : 'In progress'
            };
        });

        res.json({
            campaigns: campaignAnalytics,
            summary: {
                totalCampaigns: campaigns.length,
                completedCampaigns: campaigns.filter(c => c.status === 'completed').length,
                totalEmailsSent: campaigns.reduce((sum, c) => sum + c.sentCount, 0),
                averageSuccessRate: campaigns.length > 0
                    ? (campaigns.reduce((sum, c) => sum + (c.sentCount / c.totalRecipients * 100), 0) / campaigns.length).toFixed(2) + '%'
                    : '0%'
            }
        });

    } catch (error) {
        console.error('Error fetching campaign analytics:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;