import cron from 'node-cron';
import mongoose from 'mongoose';
import checkNewEmailsAndProcess from '../func/checkNewEmailsAndProcess.js';
import retryFailedMessages from '../func/retryFailedMessages.js';

// Helper function to check if database is connected
function isDatabaseConnected() {
    return mongoose.connection.readyState === 1;
}

// Check for new emails every hour (more reasonable for response tracking)
cron.schedule('0 * * * *', async () => {
    if (!isDatabaseConnected()) {
        console.log('Database not connected, skipping email check');
        return;
    }
  console.log('⏰ Hourly check for new client responses...');
  await checkNewEmailsAndProcess();
});

// Retry failed messages every 30 minutes
cron.schedule('*/30 * * * *', async () => {
  console.log('🔄 Retrying failed messages...');
  await retryFailedMessages();
});

// Quick check every 5 minutes during business hours (9 AM - 6 PM)
cron.schedule('*/5 9-18 * * 1-5', async () => {
    if (!isDatabaseConnected()) {
        console.log('Database not connected, skipping business hours email check');
        return;
    }
  console.log('⚡ Quick business hours check...');
  await checkNewEmailsAndProcess();
});

console.log('📅 Email monitoring schedules initialized:');
console.log('   - Hourly response checks');
    if (!isDatabaseConnected()) {
        console.log('Database not connected, skipping retry failed messages');
        return;
    }
console.log('   - 30-minute retry cycles');
console.log('   - 5-minute business hours monitoring');