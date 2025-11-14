const { body, param, query } = require('express-validator');
import { RecurrenceFrequency } from '@prisma/client';

export const createRecurringPaymentValidator = [
  body('categoryId')
    .isInt({ min: 1 })
    .withMessage('categoryId debe ser un número entero positivo'),
  body('name')
    .trim()
    .notEmpty()
    .withMessage('name es requerido')
    .isLength({ max: 100 })
    .withMessage('name debe tener máximo 100 caracteres'),
  body('amount')
    .isFloat({ min: 0.01 })
    .withMessage('amount debe ser un número mayor que 0'),
  body('description')
    .optional()
    .trim(),
  body('frequency')
    .isIn(['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'])
    .withMessage('frequency debe ser DAILY, WEEKLY, MONTHLY o YEARLY'),
];

export const updateRecurringPaymentValidator = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('id debe ser un número entero positivo'),
  body('name')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('name no puede estar vacío')
    .isLength({ max: 100 })
    .withMessage('name debe tener máximo 100 caracteres'),
  body('amount')
    .optional()
    .isFloat({ min: 0.01 })
    .withMessage('amount debe ser un número mayor que 0'),
  body('description')
    .optional()
    .trim(),
  body('frequency')
    .optional()
    .isIn(['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'])
    .withMessage('frequency debe ser DAILY, WEEKLY, MONTHLY o YEARLY'),
  body('nextDate')
    .optional()
    .isISO8601()
    .withMessage('nextDate debe ser una fecha válida en formato ISO8601'),
  body('endDate')
    .optional()
    .isISO8601()
    .withMessage('endDate debe ser una fecha válida en formato ISO8601'),
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive debe ser un valor booleano'),
];

export const getRecurringPaymentValidator = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('id debe ser un número entero positivo'),
];

export const deleteRecurringPaymentValidator = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('id debe ser un número entero positivo'),
];

export const executeRecurringPaymentValidator = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('id debe ser un número entero positivo'),
];

export const getRecurringPaymentsQueryValidator = [
  query('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive debe ser true o false'),
  query('frequency')
    .optional()
    .isIn(['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'])
    .withMessage('frequency debe ser DAILY, WEEKLY, MONTHLY o YEARLY'),
];
