import { Response, NextFunction } from 'express';
const { validationResult } = require('express-validator');
import { RecurringPaymentService } from '../services/recurringPayment.service';
import { AuthenticatedRequest } from '../types';
import { RecurrenceFrequency } from '@prisma/client';

export class RecurringPaymentController {
  static async getRecurringPayments(
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
      if (req.query.isActive !== undefined) {
        filters.isActive = req.query.isActive === 'true';
      }
      if (req.query.frequency) {
        filters.frequency = req.query.frequency as RecurrenceFrequency;
      }

      const recurringPayments = await RecurringPaymentService.getRecurringPayments(
        userId,
        filters
      );

      return res.json({ recurringPayments });
    } catch (error) {
      console.error('Error getting recurring payments:', error);
      next(error);
    }
  }

  static async getRecurringPaymentById(
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

      const recurringPaymentId = parseInt(req.params.id, 10);

      try {
        const recurringPayment = await RecurringPaymentService.getRecurringPaymentById(
          recurringPaymentId,
          userId
        );
        return res.json(recurringPayment);
      } catch (error) {
        if (error instanceof Error && error.message === 'Recurring payment not found') {
          return res.status(404).json({
            error: 'Recurring payment not found',
            code: 'RECURRING_PAYMENT_NOT_FOUND',
            statusCode: 404,
          });
        }
        throw error;
      }
    } catch (error) {
      console.error('Error getting recurring payment:', error);
      next(error);
    }
  }

  static async createRecurringPayment(
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

      const { categoryId, name, amount, description, frequency, startDate, endDate } = req.body;

      try {
        const recurringPayment = await RecurringPaymentService.createRecurringPayment(
          {
            categoryId: parseInt(categoryId, 10),
            name,
            amount: parseFloat(amount),
            description,
            frequency: frequency as RecurrenceFrequency,
            startDate: new Date(startDate),
            endDate: endDate ? new Date(endDate) : undefined,
          },
          userId
        );

        return res.status(201).json(recurringPayment);
      } catch (error) {
        if (error instanceof Error && error.message === 'Category not found') {
          return res.status(404).json({
            error: 'Category not found',
            code: 'CATEGORY_NOT_FOUND',
            statusCode: 404,
          });
        }
        throw error;
      }
    } catch (error) {
      console.error('Error creating recurring payment:', error);
      next(error);
    }
  }

  static async updateRecurringPayment(
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

      const recurringPaymentId = parseInt(req.params.id, 10);
      const updateData: any = {};

      if (req.body.name !== undefined) {
        updateData.name = req.body.name;
      }
      if (req.body.amount !== undefined) {
        updateData.amount = parseFloat(req.body.amount);
      }
      if (req.body.description !== undefined) {
        updateData.description = req.body.description;
      }
      if (req.body.frequency !== undefined) {
        updateData.frequency = req.body.frequency as RecurrenceFrequency;
      }
      if (req.body.nextDate !== undefined) {
        updateData.nextDate = new Date(req.body.nextDate);
      }
      if (req.body.endDate !== undefined) {
        updateData.endDate = req.body.endDate ? new Date(req.body.endDate) : null;
      }
      if (req.body.isActive !== undefined) {
        updateData.isActive = req.body.isActive;
      }

      try {
        const recurringPayment = await RecurringPaymentService.updateRecurringPayment(
          recurringPaymentId,
          updateData,
          userId
        );
        return res.json(recurringPayment);
      } catch (error) {
        if (error instanceof Error && error.message === 'Recurring payment not found') {
          return res.status(404).json({
            error: 'Recurring payment not found',
            code: 'RECURRING_PAYMENT_NOT_FOUND',
            statusCode: 404,
          });
        }
        throw error;
      }
    } catch (error) {
      console.error('Error updating recurring payment:', error);
      next(error);
    }
  }

  static async deleteRecurringPayment(
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

      const recurringPaymentId = parseInt(req.params.id, 10);

      try {
        await RecurringPaymentService.deleteRecurringPayment(recurringPaymentId, userId);
        return res.status(204).send();
      } catch (error) {
        if (error instanceof Error && error.message === 'Recurring payment not found') {
          return res.status(404).json({
            error: 'Recurring payment not found',
            code: 'RECURRING_PAYMENT_NOT_FOUND',
            statusCode: 404,
          });
        }
        throw error;
      }
    } catch (error) {
      console.error('Error deleting recurring payment:', error);
      next(error);
    }
  }

  static async executeRecurringPayment(
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

      const recurringPaymentId = parseInt(req.params.id, 10);

      try {
        const transaction = await RecurringPaymentService.executeRecurringPayment(
          recurringPaymentId,
          userId
        );
        return res.status(201).json(transaction);
      } catch (error) {
        if (error instanceof Error) {
          if (error.message === 'Recurring payment not found') {
            return res.status(404).json({
              error: 'Recurring payment not found',
              code: 'RECURRING_PAYMENT_NOT_FOUND',
              statusCode: 404,
            });
          }
          if (error.message === 'Recurring payment is not active') {
            return res.status(400).json({
              error: 'Recurring payment is not active',
              code: 'RECURRING_PAYMENT_INACTIVE',
              statusCode: 400,
            });
          }
        }
        throw error;
      }
    } catch (error) {
      console.error('Error executing recurring payment:', error);
      next(error);
    }
  }

  static async processAllRecurringPayments(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const result = await RecurringPaymentService.processAllRecurringPayments();
      return res.json(result);
    } catch (error) {
      console.error('Error processing recurring payments:', error);
      next(error);
    }
  }
}
