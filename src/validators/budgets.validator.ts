const { body, param, query } = require('express-validator');
import { BudgetPeriod } from '@prisma/client';

export const createBudgetValidator = [
  body('categoryId')
    .isInt({ min: 1 })
    .withMessage('categoryId debe ser un número entero positivo'),
  body('amount')
    .isFloat({ min: 0.01 })
    .withMessage('amount debe ser un número mayor que 0'),
  body('period')
    .isIn(['WEEKLY', 'MONTHLY', 'YEARLY'])
    .withMessage('period debe ser WEEKLY, MONTHLY o YEARLY'),
  body('startDate')
    .isISO8601()
    .withMessage('startDate debe ser una fecha válida en formato ISO8601'),
  body('endDate')
    .isISO8601()
    .withMessage('endDate debe ser una fecha válida en formato ISO8601')
    .custom((endDate: any, { req }: any) => {
      const startDate = new Date(req.body.startDate);
      const end = new Date(endDate);
      if (end <= startDate) {
        throw new Error('endDate debe ser posterior a startDate');
      }
      return true;
    }),
];

export const updateBudgetValidator = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('id debe ser un número entero positivo'),
  body('amount')
    .optional()
    .isFloat({ min: 0.01 })
    .withMessage('amount debe ser un número mayor que 0'),
  body('startDate')
    .optional()
    .isISO8601()
    .withMessage('startDate debe ser una fecha válida en formato ISO8601'),
  body('endDate')
    .optional()
    .isISO8601()
    .withMessage('endDate debe ser una fecha válida en formato ISO8601')
    .custom((endDate: any, { req }: any) => {
      if (req.body.startDate) {
        const startDate = new Date(req.body.startDate);
        const end = new Date(endDate);
        if (end <= startDate) {
          throw new Error('endDate debe ser posterior a startDate');
        }
      }
      return true;
    }),
];

export const getBudgetValidator = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('id debe ser un número entero positivo'),
];

export const deleteBudgetValidator = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('id debe ser un número entero positivo'),
];

export const getBudgetsQueryValidator = [
  query('period')
    .optional()
    .isIn(['WEEKLY', 'MONTHLY', 'YEARLY'])
    .withMessage('period debe ser WEEKLY, MONTHLY o YEARLY'),
  query('categoryId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('categoryId debe ser un número entero positivo'),
];
