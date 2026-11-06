import express from 'express';
import rateLimit from 'express-rate-limit';
import { authMiddleware } from '../middlewares/authMiddleware';
import { generateRecommendations } from '../services/aiService';
import { testOpenAIConnection } from '../services/testOpenAI.service';

const router = express.Router();

// Rate limiting exclusivo para AI
const aiRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 15 minutos
  max: 5, // máximo 5 requests por ventana por IP/usuario
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Demasiadas solicitudes de recomendaciones, intenta más tarde'
});

router.post('/recommendations', authMiddleware, generateRecommendations);
router.post('/test', authMiddleware, testOpenAIConnection);
router.post('/debug-financial', authMiddleware, async (req, res) => {
    const { testGetUserFinancialData } = await import('../services/aiService');
    try {
        const data = await testGetUserFinancialData(req.user.id);
        res.json({ success: true, data });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

export default router;

