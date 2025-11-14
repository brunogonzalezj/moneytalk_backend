import * as cron from 'node-cron';
import { RecurringPaymentService } from './recurringPayment.service';

export class CronJobsService {
  private static isJobRunning = false;

  static startRecurringPaymentsCronJob() {
    // Ejecutar todos los días a las 00:01 (1 minuto después de medianoche)
    // Formato: segundo minuto hora día mes día-de-la-semana
    // '0 1 0 * * *' = a las 00:01:00 todos los días
    cron.schedule('0 1 0 * * *', async () => {
      if (this.isJobRunning) {
        console.log('⏳ Cron job ya está en ejecución, saltando esta vez...');
        return;
      }

      try {
        this.isJobRunning = true;
        console.log('🕐 [CRON] Iniciando procesamiento de pagos recurrentes:', new Date().toISOString());

        const result = await RecurringPaymentService.processAllRecurringPayments();

        console.log('✅ [CRON] Pagos recurrentes procesados exitosamente:');
        console.log(`   - Total procesados: ${result.processed}`);
        console.log(`   - Exitosos: ${result.successful}`);
        console.log(`   - Fallidos: ${result.failed}`);

        if (result.failed > 0) {
          console.error('⚠️ [CRON] Algunos pagos fallaron:', result.results.filter((r: any) => !r.success));
        }
      } catch (error) {
        console.error('❌ [CRON] Error procesando pagos recurrentes:', error);
      } finally {
        this.isJobRunning = false;
      }
    });

    console.log('✅ Cron job para pagos recurrentes iniciado (se ejecutará diariamente a las 00:01)');
  }

  // Método para ejecutar manualmente (útil para testing)
  static async executeRecurringPaymentsNow() {
    try {
      console.log('🔧 [MANUAL] Ejecutando pagos recurrentes manualmente...');
      const result = await RecurringPaymentService.processAllRecurringPayments();
      console.log('✅ [MANUAL] Resultado:', result);
      return result;
    } catch (error) {
      console.error('❌ [MANUAL] Error:', error);
      throw error;
    }
  }

  // Configuración alternativa para testing (cada minuto)
  static startRecurringPaymentsCronJobForTesting() {
    console.log('⚠️ MODO TESTING: Cron job se ejecutará cada minuto');
    
    cron.schedule('* * * * *', async () => {
      if (this.isJobRunning) {
        console.log('⏳ Cron job ya está en ejecución, saltando...');
        return;
      }

      try {
        this.isJobRunning = true;
        console.log('🕐 [CRON-TEST] Procesando pagos recurrentes:', new Date().toISOString());

        const result = await RecurringPaymentService.processAllRecurringPayments();

        console.log('✅ [CRON-TEST] Resultado:', {
          processed: result.processed,
          successful: result.successful,
          failed: result.failed
        });
      } catch (error) {
        console.error('❌ [CRON-TEST] Error:', error);
      } finally {
        this.isJobRunning = false;
      }
    });
  }
}
