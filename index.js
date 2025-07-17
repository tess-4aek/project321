import dotenv from 'dotenv';

// Load environment variables first, before any other imports
dotenv.config();

import express from 'express';
import mongoose from 'mongoose';

import authRoutes from './routes/auth.js';
import clientRoutes from './routes/clients.js';
import campaignRoutes from './routes/campaigns.js';
import templateRoutes from './routes/templates.js';
import analyticsRoutes from './routes/analytics.js';

import './tasks/autoCheck.js';

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());

mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/mail-auto-manager', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    bufferTimeoutMS: 30000,
    serverSelectionTimeoutMS: 30000,
    socketTimeoutMS: 45000,
    connectTimeoutMS: 30000
})
    .then(() => {
        console.log('Успешное подключение к MongoDB:', process.env.MONGO_URI ? 'Atlas' : 'Local');
        app.listen(PORT, () => {
            console.log(`Сервер запущен на http://localhost:${PORT}`);
        });
    })
    .catch((err) => {
        console.error('Ошибка подключения к MongoDB:', err);
        console.error('Проверьте MONGO_URI в .env файле:', process.env.MONGO_URI);
        process.exit(1);
    });



app.use('/auth', authRoutes);
app.use('/clients', clientRoutes);
app.use('/campaigns', campaignRoutes);
app.use('/templates', templateRoutes);
app.use('/analytics', analyticsRoutes);

app.get('/', (req, res) => {
  res.send('Работает!');
});