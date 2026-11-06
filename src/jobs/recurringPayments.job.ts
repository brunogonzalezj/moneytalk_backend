import cron from 'node-cron';
import { env } from '../config/env';
import { RecurringPaymentService } from '../services/recurringPayment.service';
import { logger } from '../utils/logger';

let running = false;

export const runRecurringPayments = async () => {
  if (running) return null;
  running = true;
  try {
    const result = await RecurringPaymentService.processAllRecurringPayments();
    if (result.processed > 0) {
      logger.info(`[cron] Pagos recurrentes: ${result.successful} ok, ${result.failed} con error`);
    }
    return result;
  } catch (error) {
    logger.error('[cron] Error procesando pagos recurrentes', error);
    return null;
  } finally {
    running = false;
  }
};

export const startRecurringPaymentsJob = (): void => {
  // Daily at 00:01, or every minute in test mode
  const schedule = env.CRON_TEST_MODE ? '* * * * *' : '1 0 * * *';
  cron.schedule(schedule, () => void runRecurringPayments(), { timezone: env.APP_TIMEZONE });
  logger.info(`Job de pagos recurrentes iniciado${env.CRON_TEST_MODE ? ' (modo test, cada minuto)' : ''}`);
};
