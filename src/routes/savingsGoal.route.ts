import express from 'express';
import { SavingsGoalController } from '../controllers/savingsGoal.controller';
import { authMiddleware } from '../middlewares/authMiddleware';

const router = express.Router();

router.get(
  '/',
  authMiddleware,
  SavingsGoalController.getSavingsGoals
);

router.get(
  '/:id',
  authMiddleware,
  SavingsGoalController.getSavingsGoalById
);

router.post(
  '/',
  authMiddleware,
  SavingsGoalController.createSavingsGoal
);

router.put(
  '/:id',
  authMiddleware,
  SavingsGoalController.updateSavingsGoal
);

router.delete(
  '/:id',
  authMiddleware,
  SavingsGoalController.deleteSavingsGoal
);

router.post(
  '/:id/add',
  authMiddleware,
  SavingsGoalController.addToSavingsGoal
);

export default router;