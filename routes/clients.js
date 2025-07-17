import express from 'express';
import Manager from '../models/Manager.js';

const router = express.Router();

// Add client to manager's list
router.post('/add', async (req, res) => {
    const { managerEmail, clientEmail, clientName } = req.body;

    if (!managerEmail || !clientEmail) {
        return res.status(400).json({ 
            error: 'Manager email and client email are required' 
        });
    }

    try {
        const manager = await Manager.findOne({ email: managerEmail });
        if (!manager) {
            return res.status(404).json({ error: 'Manager not found' });
        }

        // Check if client already exists
        const existingClient = manager.clients.find(client => client.email === clientEmail);
        if (existingClient) {
            return res.status(400).json({ error: 'Client already exists in the list' });
        }

        manager.clients.push({
            email: clientEmail,
            name: clientName || '',
            addedAt: new Date(),
            status: 'active'
        });

        await manager.save();

        res.json({
            message: 'Client added successfully',
            client: { email: clientEmail, name: clientName }
        });
    } catch (error) {
        console.error('Error adding client:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get all clients for a manager
router.get('/list/:managerEmail', async (req, res) => {
    const { managerEmail } = req.params;

    try {
        const manager = await Manager.findOne({ email: managerEmail });
        if (!manager) {
            return res.status(404).json({ error: 'Manager not found' });
        }

        res.json({
            clients: manager.clients,
            total: manager.clients.length
        });
    } catch (error) {
        console.error('Error fetching clients:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update client information
router.put('/update', async (req, res) => {
    const { managerEmail, clientEmail, updates } = req.body;

    if (!managerEmail || !clientEmail) {
        return res.status(400).json({ 
            error: 'Manager email and client email are required' 
        });
    }

    try {
        const manager = await Manager.findOne({ email: managerEmail });
        if (!manager) {
            return res.status(404).json({ error: 'Manager not found' });
        }

        const client = manager.clients.find(c => c.email === clientEmail);
        if (!client) {
            return res.status(404).json({ error: 'Client not found' });
        }

        // Update allowed fields
        if (updates.name !== undefined) client.name = updates.name;
        if (updates.status !== undefined) client.status = updates.status;
        if (updates.notes !== undefined) client.notes = updates.notes;

        await manager.save();

        res.json({
            message: 'Client updated successfully',
            client: client
        });
    } catch (error) {
        console.error('Error updating client:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete client from manager's list
router.delete('/delete', async (req, res) => {
    const { managerEmail, clientEmail } = req.body;

    if (!managerEmail || !clientEmail) {
        return res.status(400).json({ 
            error: 'Manager email and client email are required' 
        });
    }

    try {
        const manager = await Manager.findOne({ email: managerEmail });
        if (!manager) {
            return res.status(404).json({ error: 'Manager not found' });
        }

        const clientIndex = manager.clients.findIndex(c => c.email === clientEmail);
        if (clientIndex === -1) {
            return res.status(404).json({ error: 'Client not found' });
        }

        manager.clients.splice(clientIndex, 1);
        await manager.save();

        res.json({
            message: 'Client deleted successfully',
            deletedClient: clientEmail
        });
    } catch (error) {
        console.error('Error deleting client:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;