import express from 'express';
import { google } from 'googleapis';
import Manager from '../models/Manager.js';
import dotenv from 'dotenv';

dotenv.config();
const router = express.Router();

const oAuth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
);

const MessageStatus = {
    PENDING: 'pending',        // Ожидает обработки
    PROCESSING: 'processing',  // В процессе обработки
    SUCCESS: 'success',        // Успешно обработано
    ERROR: 'error',            // Ошибка при обработке
    RETRY: 'retry'             // Нужно повторить попытку
};

router.get('/google', (req, res) => {
    const url = oAuth2Client.generateAuthUrl({
        access_type: 'offline',
        prompt: 'consent',
        scope: [
            'https://www.googleapis.com/auth/gmail.readonly',
            'https://www.googleapis.com/auth/userinfo.email',
            'https://www.googleapis.com/auth/gmail.send',
            'https://www.googleapis.com/auth/spreadsheets'
        ]
    });

    res.redirect(url);
});

router.get('/google/callback', async (req, res) => {
    const code = req.query.code;

    if (!code) {
        console.error('Код не передан из Google');
        return res.status(400).send('Код авторизации отсутствует');
    }

    try {
        const { tokens } = await oAuth2Client.getToken(code);
        oAuth2Client.setCredentials(tokens);

        const oauth2 = google.oauth2({
            auth: oAuth2Client,
            version: 'v2'
        });

        const { data: userInfo } = await oauth2.userinfo.get();
        const email = userInfo.email;

        const manager = await Manager.findOneAndUpdate(
            { email },
            {
                email,
                accessToken: tokens.access_token,
                refreshToken: tokens.refresh_token,
                tokenExpiryDate: tokens.expiry_date ? new Date(tokens.expiry_date) : null
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        console.log(`Менеджер ${email} авторизован`);
        res.send(`Почта ${email} успешно подключена к системе`);
    } catch (err) {
        console.error('Ошибка авторизации:', err?.response?.data || err.message || err);
        res.status(500).send('Ошибка авторизации');
    }
});

// Новый маршрут для отправки письма
router.post('/send-email', async (req, res) => {
    const { to, subject, message, fromEmail } = req.body;

    if (!to || !subject || !message || !fromEmail) {
        return res.status(400).send('Укажите получателя, тему, текст письма и отправителя');
    }

    try {
        const manager = await Manager.findOne({ email: fromEmail });
        if (!manager) {
            return res.status(404).send('Менеджер не найден');
        }

        oAuth2Client.setCredentials({
            access_token: manager.accessToken,
            refresh_token: manager.refreshToken,
            expiry_date: manager.tokenExpiryDate ? manager.tokenExpiryDate.getTime() : null
        });

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

        // Кодируем Subject в формате MIME (Base64 с UTF-8)
        const encodedSubject = `=?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`;

        // Формируем письмо
        const email = [
            `To: ${to}`,
            `Subject: ${encodedSubject}`,
            'Content-Type: text/plain; charset="UTF-8"',
            'MIME-Version: 1.0',
            '',
            message
        ].join('\n');

        // Кодируем письмо в Base64
        const encodedEmail = Buffer.from(email, 'utf-8')
            .toString('base64')
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');

        // Отправляем письмо
        await gmail.users.messages.send({
            userId: 'me',
            requestBody: {
                raw: encodedEmail
            }
        });

        res.send('Письмо успешно отправлено');
    } catch (err) {
        console.error('Ошибка отправки письма:', err);
        res.status(500).send('Ошибка отправки письма');
    }
});

// Новый маршрут для получения входящих писем
router.post('/fetch-emails', async (req, res) => {
    const { fromEmail, keywords } = req.body; // fromEmail - email менеджера, keywords - массив ключевых слов для поиска в письме

    if (!fromEmail) {
        return res.status(400).send('Укажите email менеджера');
    }

    try {
        const manager = await Manager.findOne({ email: fromEmail });
        if (!manager) {
            return res.status(404).send('Менеджер не найден');
        }

        oAuth2Client.setCredentials({
            access_token: manager.accessToken,
            refresh_token: manager.refreshToken,
            expiry_date: manager.tokenExpiryDate ? manager.tokenExpiryDate.getTime() : null
        });

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

        // Получаем список последних писем
        const response = await gmail.users.messages.list({
            userId: 'me',
            maxResults: 10, // Количество писем для обработки (настройте по необходимости)
            q: 'in:inbox', // Фильтр: только письма во входящих
        });

        const messages = response.data.messages || [];
        const results = [];

        // Обрабатываем каждое письмо
        for (const message of messages) {
            const msg = await gmail.users.messages.get({
                userId: 'me',
                id: message.id,
                format: 'full', // Получаем полное содержимое письма
            });

            const headers = msg.data.payload.headers || [];
            const from = headers.find(h => h.name.toLowerCase() === 'from')?.value || '';
            const subject = headers.find(h => h.name.toLowerCase() === 'subject')?.value || '';

            // Извлекаем текст письма
            let body = '';
            if (msg.data.payload.parts) {
                // Если письмо состоит из нескольких частей (например, text/plain и text/html)
                const textPart = msg.data.payload.parts.find(part => part.mimeType === 'text/plain');
                if (textPart && textPart.body.data) {
                    body = Buffer.from(textPart.body.data, 'base64').toString('utf-8');
                }
            } else if (msg.data.payload.body.data) {
                // Если письмо только текст
                body = Buffer.from(msg.data.payload.body.data, 'base64').toString('utf-8');
            }

            // Проверяем отправителя и содержимое
            const result = {
                id: message.id,
                from,
                subject,
                body,
                matchesKeywords: false
            };

            if (keywords && Array.isArray(keywords)) {
                // Проверяем, содержит ли письмо ключевые слова
                const lowerBody = body.toLowerCase();
                const lowerSubject = subject.toLowerCase();
                result.matchesKeywords = keywords.some(keyword =>
                    lowerBody.includes(keyword.toLowerCase()) || lowerSubject.includes(keyword.toLowerCase())
                );
            }

            results.push(result);
        }

        res.json({
            message: 'Письма успешно получены',
            emails: results
        });
    } catch (err) {
        console.error('Ошибка получения писем:', err);
        res.status(500).send('Ошибка получения писем');
    }
});

export default router;