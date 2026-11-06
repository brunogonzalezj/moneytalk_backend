import { Router } from 'express';
import { AiController } from '../controllers/ai.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { aiLimiter } from '../middlewares/rateLimit';
import { validate } from '../middlewares/validate.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import { categorizeValidator, recommendationsValidator } from '../validators/ai.validator';

// Mounted at /api/ai
export const aiRouter = Router();
aiRouter.post(
  '/recommendations',
  authMiddleware,
  aiLimiter,
  validate(recommendationsValidator),
  asyncHandler(AiController.recommendations)
);

// Mounted at /api/gpt (path kept for the existing frontend)
export const gptRouter = Router();
gptRouter.post(
  '/categorize',
  authMiddleware,
  aiLimiter,
  validate(categorizeValidator),
  asyncHandler(AiController.categorize)
);
