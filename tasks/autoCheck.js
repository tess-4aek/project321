import cron from 'node-cron';
import checkNewEmailsAndProcess from '../func/checkNewEmailsAndProcess.js';

// Каждый 1 минуту
cron.schedule('* * * * *', async () => {
  console.log('⏰ Проверка новых писем...');
  await checkNewEmailsAndProcess();
});
