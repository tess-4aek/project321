import { google } from 'googleapis';

export default async function sendToGoogleSheet(manager, values) {
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

    const sheets = google.sheets({ version: 'v4', auth: oAuth2Client });

    await sheets.spreadsheets.values.append({
        spreadsheetId: process.env.GOOGLE_SHEET_ID,
        range: 'Лист1!A2:I2',
        valueInputOption: 'USER_ENTERED',
        requestBody: {
            values: [values] // ← массив из 9 элементов
        }
    });

    console.log(`🟢 Добавлено в таблицу: ${values.join(' | ')}`);
}
