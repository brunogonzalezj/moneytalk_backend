import { Response, NextFunction } from 'express';
const { validationResult } = require('express-validator');
import { BudgetService } from '../services/budget.service';
import { AuthenticatedRequest } from '../types';
import { BudgetPeriod } from '@prisma/client';

export class BudgetController {
  static async getBudgets(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'No autorizado' });
      }

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const filters: any = {};
      if (req.query.period) {
        filters.period = req.query.period as BudgetPeriod;
      }
      if (req.query.categoryId) {
        filters.categoryId = parseInt(req.query.categoryId as string, 10);
      }

      const budgets = await BudgetService.getBudgets(userId, filters);

      return res.json({ budgets });
    } catch (error) {
      console.error('Error getting budgets:', error);
      next(error);
    }
  }

  static async getBudgetById(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'No autorizado' });
      }

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const budgetId = parseInt(req.params.id, 10);

      try {
        const budget = await BudgetService.getBudgetById(budgetId, userId);
        return res.json(budget);
      } catch (error) {
        if (error instanceof Error && error.message === 'Budget not found') {
          return res.status(404).json({
            error: 'Budget not found',
            code: 'BUDGET_NOT_FOUND',
            statusCode: 404,
          });
        }
        throw error;
      }
    } catch (error) {
      console.error('Error getting budget:', error);
      next(error);
    }
  }

  static async createBudget(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'No autorizado' });
      }

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { categoryId, amount, period, startDate, endDate } = req.body;

      try {
        const budget = await BudgetService.createBudget(
          {
            categoryId: parseInt(categoryId, 10),
            amount: parseFloat(amount),
            period: period as BudgetPeriod,
            startDate: new Date(startDate),
            endDate: new Date(endDate),
          },
          userId
        );

        return res.status(201).json(budget);
      } catch (error) {
        if (error instanceof Error) {
          if (error.message === 'Category not found') {
            return res.status(404).json({
              error: 'Category not found',
              code: 'CATEGORY_NOT_FOUND',
              statusCode: 404,
            });
          }
          if (
            error.message.includes('Ya existe un presupuesto') ||
            error.message.includes('período especificado')
          ) {
            return res.status(400).json({
              error: error.message,
              code: 'BUDGET_OVERLAP',
              statusCode: 400,
            });
          }
        }
        throw error;
      }
    } catch (error) {
      console.error('Error creating budget:', error);
      next(error);
    }
  }

  static async updateBudget(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'No autorizado' });
      }

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const budgetId = parseInt(req.params.id, 10);
      const updateData: any = {};

      if (req.body.amount !== undefined) {
        updateData.amount = parseFloat(req.body.amount);
      }
      if (req.body.startDate !== undefined) {
        updateData.startDate = new Date(req.body.startDate);
      }
      if (req.body.endDate !== undefined) {
        updateData.endDate = new Date(req.body.endDate);
      }

      try {
        const budget = await BudgetService.updateBudget(budgetId, updateData, userId);
        return res.json(budget);
      } catch (error) {
        if (error instanceof Error) {
          if (error.message === 'Budget not found') {
            return res.status(404).json({
              error: 'Budget not found',
              code: 'BUDGET_NOT_FOUND',
              statusCode: 404,
            });
          }
          if (error.message.includes('solapa')) {
            return res.status(400).json({
              error: error.message,
              code: 'BUDGET_OVERLAP',
              statusCode: 400,
            });
          }
        }
        throw error;
      }
    } catch (error) {
      console.error('Error updating budget:', error);
      next(error);
    }
  }

  static async deleteBudget(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'No autorizado' });
      }

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const budgetId = parseInt(req.params.id, 10);

      try {
        await BudgetService.deleteBudget(budgetId, userId);
        return res.status(204).send();
      } catch (error) {
        if (error instanceof Error && error.message === 'Budget not found') {
          return res.status(404).json({
            error: 'Budget not found',
            code: 'BUDGET_NOT_FOUND',
            statusCode: 404,
          });
        }
        throw error;
      }
    } catch (error) {
      console.error('Error deleting budget:', error);
      next(error);
    }
  }
}
