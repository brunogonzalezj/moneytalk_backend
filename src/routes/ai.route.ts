import express from 'express';
import rateLimit from 'express-rate-limit';
import { authMiddleware } from '../middlewares/authMiddleware';
import { generateRecommendations } from '../services/aiService';

const router = express.Router();

// Rate limiting exclusivo para AI
const aiRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // máximo 5 requests por ventana por IP/usuario
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Demasiadas solicitudes de recomendaciones, intenta más tarde'
});

router.post('/recommendations', authMiddleware, generateRecommendations);

export default router;

