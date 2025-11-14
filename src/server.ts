import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import {categorizeTransaction} from "./services/aiService";
import authRoute from "./routes/auth.route";
import transactionRoute from "./routes/transaction.route";
import categoryRoute from "./routes/category.route";
import aiRoute from "./routes/ai.route";
import budgetRoute from "./routes/budget.route";
import recurringPaymentRoute from "./routes/recurringPayment.route";
import { CronJobsService } from "./services/cronJobs.service";

dotenv.config();

const app = express();

const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';

// Middlewares de seguridad y parseo
app.use(helmet());
app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json());

// Rate limiting para login y signup
const authLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minuto
    max: 5,
    message: { error: 'Demasiados intentos, intenta más tarde.' }
});
app.use('/api/auth/signup', authLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/gpt/categorize', categorizeTransaction)

// Rutas (importa y usa tus routers aquí)
app.use('/api/auth', authRoute)
app.use('/api/transactions', transactionRoute)
app.use('/api/categories', categoryRoute)
app.use('/api/ai', aiRoute)
app.use('/api/budgets', budgetRoute)
app.use('/api/recurring-payments', recurringPaymentRoute)

// Middleware de manejo de errores global
app.use((err: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const status = err.status || 500;
    res.status(status).json({
        error: err.message || 'Error interno del servidor',
        details: err.details || undefined
    });
});

// Iniciar cron jobs para pagos recurrentes
const ENABLE_CRON = process.env.ENABLE_CRON !== 'false'; // Por defecto true
const CRON_TEST_MODE = process.env.CRON_TEST_MODE === 'true'; // Por defecto false

if (ENABLE_CRON) {
    if (CRON_TEST_MODE) {
        console.log('⚠️ Iniciando cron jobs en MODO TEST (cada minuto)');
        CronJobsService.startRecurringPaymentsCronJobForTesting();
    } else {
        console.log('✅ Iniciando cron jobs en modo PRODUCCIÓN (diario a las 00:01)');
        CronJobsService.startRecurringPaymentsCronJob();
    }
} else {
    console.log('⏸️ Cron jobs deshabilitados (ENABLE_CRON=false)');
}

// Iniciar servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor escuchando en puerto ${PORT}`);
});