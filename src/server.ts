import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import {categorizeTransaction} from "./services/aiService";
import authRoute from "./routes/auth.route";
import transactionRoute from "./routes/transaction.route";
import categoryRoute from "./routes/category.route";

dotenv.config();

const app = express();
const prisma = new PrismaClient();

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
// Ejemplo:
// import authRouter from './routes/auth';
// app.use('/api/auth', authRouter);

// Middleware de manejo de errores global
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    const status = err.status || 500;
    res.status(status).json({
        error: err.message || 'Error interno del servidor',
        details: err.details || undefined
    });
});

// Iniciar servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor escuchando en puerto ${PORT}`);
});