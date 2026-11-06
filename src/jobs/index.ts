import { env } from '../config/env';
import { logger } from '../utils/logger';
import { startNotificationJobs } from './notifications.job';
import { startRecurringPaymentsJob } from './recurringPayments.job';

export const startJobs = (): void => {
  if (env.ENABLE_CRON) startRecurringPaymentsJob();
  else logger.info('Job de pagos recurrentes deshabilitado (ENABLE_CRON=false)');

  if (env.ENABLE_NOTIFICATIONS) startNotificationJobs();
  else logger.info('Jobs de notificaciones deshabilitados (ENABLE_NOTIFICATIONS=false)');
};
