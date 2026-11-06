import cron from 'node-cron';
import { sendDailyReminder, sendWeeklyReminder, sendMonthlyReport } from '../routes/notifications';

export class NotificationSchedulerService {
  /**
   * Inicia el cron job para recordatorios diarios
   * Se ejecuta cada minuto para verificar si es la hora configurada
   */
  static startDailyReminderCronJob(): void {
    // Ejecuta cada minuto para verificar la hora
    cron.schedule('* * * * *', async () => {
      try {
        await sendDailyReminder();
      } catch (error) {
        console.error('Error en recordatorio diario:', error);
      }
    });

    console.log('✅ Cron job de recordatorios diarios iniciado');
  }

  /**
   * Inicia el cron job para recordatorios semanales
   * Se ejecuta cada día a las 00:01 para verificar si es el día correcto
   */
  static startWeeklyReminderCronJob(): void {
    cron.schedule('1 0 * * *', async () => {
      try {
        await sendWeeklyReminder();
      } catch (error) {
        console.error('Error en recordatorio semanal:', error);
      }
    });

    console.log('✅ Cron job de recordatorios semanales iniciado');
  }

  /**
   * Inicia el cron job para reportes mensuales
   * Se ejecuta cada día a las 00:01 para verificar si es el primer día del mes
   */
  static startMonthlyReportCronJob(): void {
    cron.schedule('1 0 * * *', async () => {
      try {
        await sendMonthlyReport();
      } catch (error) {
        console.error('Error en reporte mensual:', error);
      }
    });

    console.log('✅ Cron job de reportes mensuales iniciado');
  }

  /**
   * Inicia todos los cron jobs de notificaciones
   */
  static startAllNotificationCronJobs(): void {
    this.startDailyReminderCronJob();
    this.startWeeklyReminderCronJob();
    this.startMonthlyReportCronJob();
    console.log('🔔 Todos los cron jobs de notificaciones han sido iniciados');
  }

  /**
   * Versión de test que ejecuta los recordatorios cada 5 minutos
   */
  static startTestNotificationCronJobs(): void {
    // Recordatorio diario cada 5 minutos
    cron.schedule('*/5 * * * *', async () => {
      try {
        console.log('🧪 Ejecutando recordatorio diario en modo test...');
        await sendDailyReminder();
      } catch (error) {
        console.error('Error en recordatorio diario (test):', error);
      }
    });

    // Recordatorio semanal cada 10 minutos
    cron.schedule('*/10 * * * *', async () => {
      try {
        console.log('🧪 Ejecutando recordatorio semanal en modo test...');
        await sendWeeklyReminder();
      } catch (error) {
        console.error('Error en recordatorio semanal (test):', error);
      }
    });

    // Reporte mensual cada 15 minutos
    cron.schedule('*/15 * * * *', async () => {
      try {
        console.log('🧪 Ejecutando reporte mensual en modo test...');
        await sendMonthlyReport();
      } catch (error) {
        console.error('Error en reporte mensual (test):', error);
      }
    });

    console.log('🧪 Cron jobs de notificaciones iniciados en MODO TEST (cada 5-15 minutos)');
  }

  /**
   * Detiene todos los cron jobs
   */
  static stopAllCronJobs(): void {
    cron.getTasks().forEach((task) => {
      task.stop();
    });
    console.log('⏸️ Todos los cron jobs de notificaciones han sido detenidos');
  }
}