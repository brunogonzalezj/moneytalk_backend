import { Response, NextFunction } from 'express';
import { SavingsGoalService } from '../services/savingsGoal.service';
import { AuthenticatedRequest } from '../types';

export class SavingsGoalController {
  static async getSavingsGoals(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'No autorizado' });
      }

      const filters: any = {};
      if (req.query.type) {
        filters.type = req.query.type;
      }
      if (req.query.status) {
        filters.status = req.query.status;
      }

      const savingsGoals = await SavingsGoalService.getSavingsGoals(userId, filters);

      return res.json({ savingsGoals });
    } catch (error) {
      console.error('Error getting savings goals:', error);
      next(error);
    }
  }

  static async getSavingsGoalById(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'No autorizado' });
      }

      const goalId = parseInt(req.params.id, 10);

      try {
        const goal = await SavingsGoalService.getSavingsGoalById(goalId, userId);
        return res.json(goal);
      } catch (error) {
        if (error instanceof Error && error.message === 'Savings goal not found') {
          return res.status(404).json({
            error: 'Savings goal not found',
            code: 'SAVINGS_GOAL_NOT_FOUND',
            statusCode: 404,
          });
        }
        throw error;
      }
    } catch (error) {
      console.error('Error getting savings goal:', error);
      next(error);
    }
  }

  static async createSavingsGoal(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'No autorizado' });
      }

      const { name, description, type, targetAmount, targetDate, status } = req.body;

      if (!name || !type || !targetAmount) {
        return res.status(400).json({
          error: 'Los campos name, type y targetAmount son requeridos',
          code: 'MISSING_REQUIRED_FIELDS',
        });
      }

      if (targetAmount <= 0) {
        return res.status(400).json({
          error: 'El monto objetivo debe ser mayor a 0',
          code: 'INVALID_TARGET_AMOUNT',
        });
      }

      try {
        const savingsGoal = await SavingsGoalService.createSavingsGoal(
          {
            name,
            description,
            type,
            targetAmount: parseFloat(targetAmount),
            targetDate: targetDate ? new Date(targetDate) : undefined,
            status,
          },
          userId
        );

        return res.status(201).json(savingsGoal);
      } catch (error) {
        console.error('Error creating savings goal:', error);
        throw error;
      }
    } catch (error) {
      console.error('Error creating savings goal:', error);
      next(error);
    }
  }

  static async updateSavingsGoal(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'No autorizado' });
      }

      const goalId = parseInt(req.params.id, 10);
      const updateData: any = {};

      if (req.body.name !== undefined) updateData.name = req.body.name;
      if (req.body.description !== undefined) updateData.description = req.body.description;
      if (req.body.type !== undefined) updateData.type = req.body.type;
      if (req.body.targetAmount !== undefined) {
        const amount = parseFloat(req.body.targetAmount);
        if (amount <= 0) {
          return res.status(400).json({
            error: 'El monto objetivo debe ser mayor a 0',
            code: 'INVALID_TARGET_AMOUNT',
          });
        }
        updateData.targetAmount = amount;
      }
      if (req.body.targetDate !== undefined) {
        updateData.targetDate = req.body.targetDate ? new Date(req.body.targetDate) : null;
      }
      if (req.body.status !== undefined) updateData.status = req.body.status;

      try {
        const savingsGoal = await SavingsGoalService.updateSavingsGoal(goalId, updateData, userId);
        return res.json(savingsGoal);
      } catch (error) {
        if (error instanceof Error && error.message === 'Savings goal not found') {
          return res.status(404).json({
            error: 'Savings goal not found',
            code: 'SAVINGS_GOAL_NOT_FOUND',
            statusCode: 404,
          });
        }
        throw error;
      }
    } catch (error) {
      console.error('Error updating savings goal:', error);
      next(error);
    }
  }

  static async deleteSavingsGoal(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'No autorizado' });
      }

      const goalId = parseInt(req.params.id, 10);

      try {
        await SavingsGoalService.deleteSavingsGoal(goalId, userId);
        return res.status(204).send();
      } catch (error) {
        if (error instanceof Error && error.message === 'Savings goal not found') {
          return res.status(404).json({
            error: 'Savings goal not found',
            code: 'SAVINGS_GOAL_NOT_FOUND',
            statusCode: 404,
          });
        }
        throw error;
      }
    } catch (error) {
      console.error('Error deleting savings goal:', error);
      next(error);
    }
  }

  static async addToSavingsGoal(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'No autorizado' });
      }

      const { amount } = req.body;

      if (!amount || amount <= 0) {
        return res.status(400).json({
          error: 'El monto debe ser mayor a 0',
          code: 'INVALID_AMOUNT'
        });
      }

      const goalId = parseInt(req.params.id, 10);

      try {
        const result = await SavingsGoalService.addToSavingsGoal(goalId, parseFloat(amount), userId);
        return res.json(result);
      } catch (error) {
        if (error instanceof Error) {
          if (error.message === 'Savings goal not found') {
            return res.status(404).json({
              error: 'Savings goal not found',
              code: 'SAVINGS_GOAL_NOT_FOUND',
              statusCode: 404,
            });
          }
          if (error.message === 'Cannot add money to inactive savings goal') {
            return res.status(400).json({
              error: 'No se puede agregar dinero a una meta de ahorro inactiva',
              code: 'INACTIVE_SAVINGS_GOAL',
              statusCode: 400,
            });
          }
        }
        throw error;
      }
    } catch (error) {
      console.error('Error adding to savings goal:', error);
      next(error);
    }
  }
}