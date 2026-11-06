import { body } from 'express-validator';
import { MAX_CATEGORIZE_TEXT_LENGTH } from '../services/ai/categorization.service';

export const categorizeValidator = [
  body('text')
    .isString()
    .withMessage('text es obligatorio')
    .trim()
    .isLength({ min: 3, max: MAX_CATEGORIZE_TEXT_LENGTH })
    .withMessage(`El texto debe tener entre 3 y ${MAX_CATEGORIZE_TEXT_LENGTH} caracteres`),
];

export const recommendationsValidator = [body('forceRefresh').optional().isBoolean()];
