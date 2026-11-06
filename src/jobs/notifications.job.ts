import cron from 'node-cron';
import { env } from '../config/env';
import { NotificationService } from '../services/notification.service';
import { logger } from '../utils/logger';

// Skips a run if the previous one of the same job has not finished yet
const guarded = (name: string, task: () => Promise<{ sent: number }>) => {
  let running = false;
  return async () => {
    if (running) return;
    running = true;
    try {
      const { sent } = await task();
      if (sent > 0) logger.info(`[cron] ${name}: ${sent} notificaciones enviadas`);
    } catch (error) {
      logger.error(`[cron] ${name} falló`, error);
    } finally {
      running = false;
    }
  };
};

export const startNotificationJobs = (): void => {
  const options = { timezone: env.APP_TIMEZONE };
  // Each user's own time and timezone are checked inside the service
  const daily = env.CRON_TEST_MODE ? '*/5 * * * *' : '*/15 * * * *';
  const weekly = env.CRON_TEST_MODE ? '*/10 * * * *' : '5 * * * *';
  const monthly = env.CRON_TEST_MODE ? '*/15 * * * *' : '10 * * * *';

  cron.schedule(daily, guarded('recordatorio diario', () => NotificationService.runDailyReminders()), options);
  cron.schedule(weekly, guarded('recordatorio semanal', () => NotificationService.runWeeklyReminders()), options);
  cron.schedule(monthly, guarded('reporte mensual', () => NotificationService.runMonthlyReports()), options);

  logger.info(`Jobs de notificaciones iniciados${env.CRON_TEST_MODE ? ' (modo test)' : ''}`);
};
