import dotenv from 'dotenv';

// Load environment variables first, before any other imports
dotenv.config();

import express from 'express';
import mongoose from 'mongoose';

import authRoutes from './routes/auth.js';

import './tasks/autoCheck.js';

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());

mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
    .then(() => {
        console.log('Успешное подключение к MongoDB');
        app.listen(PORT, () => {
            console.log(`Сервер запущен на http://localhost:${PORT}`);
        });
    })
    .catch((err) => {
        console.error('Ошибка подключения к MongoDB:', err);
    });



app.use('/auth', authRoutes);

app.get('/', (req, res) => {
  res.send('Работает!');
});