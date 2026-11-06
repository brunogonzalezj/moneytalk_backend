import { body, query } from 'express-validator';

const TYPES = ['INCOME', 'EXPENSE'];

export const listCategoriesValidator = [
  query('type').optional().isIn(TYPES).withMessage('type debe ser INCOME o EXPENSE'),
];

export const createCategoryValidator = [
  body('name')
    .isString()
    .trim()
    .isLength({ min: 2, max: 40 })
    .withMessage('El nombre debe tener entre 2 y 40 caracteres'),
  body('type').isIn(TYPES).withMessage('type debe ser INCOME o EXPENSE'),
];
