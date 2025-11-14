import express from 'express';
import { BudgetController } from '../controllers/budget.controller';
import { authMiddleware } from '../middlewares/authMiddleware';
import {
  createBudgetValidator,
  updateBudgetValidator,
  getBudgetValidator,
  deleteBudgetValidator,
  getBudgetsQueryValidator,
} from '../validators/budgets.validator';

const router = express.Router();

router.get(
  '/',
  authMiddleware,
  getBudgetsQueryValidator,
  BudgetController.getBudgets
);

router.get(
  '/:id',
  authMiddleware,
  getBudgetValidator,
  BudgetController.getBudgetById
);

router.post(
  '/',
  authMiddleware,
  createBudgetValidator,
  BudgetController.createBudget
);

router.put(
  '/:id',
  authMiddleware,
  updateBudgetValidator,
  BudgetController.updateBudget
);

router.delete(
  '/:id',
  authMiddleware,
  deleteBudgetValidator,
  BudgetController.deleteBudget
);

export default router;
