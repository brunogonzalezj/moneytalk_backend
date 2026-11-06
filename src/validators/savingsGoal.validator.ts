import { body, query } from 'express-validator';
import { SavingsGoalStatus, SavingsGoalType } from '@prisma/client';

const TYPES = Object.values(SavingsGoalType);
const STATUSES = Object.values(SavingsGoalStatus);

const validDate = (value: unknown) => typeof value === 'string' && !Number.isNaN(Date.parse(value));

const goalFields = (optional: boolean) => {
  const field = (name: string) => (optional ? body(name).optional() : body(name));
  return [
    field('name').isString().trim().isLength({ min: 2, max: 80 }).withMessage('El nombre debe tener entre 2 y 80 caracteres'),
    body('description').optional({ nullable: true }).isString().trim().isLength({ max: 191 }),
    field('type').isIn(TYPES).withMessage(`type debe ser uno de: ${TYPES.join(', ')}`),
    field('targetAmount').isFloat({ gt: 0, max: 99_999_999 }).withMessage('El monto objetivo debe ser mayor a 0').toFloat(),
    body('targetDate').optional({ nullable: true }).custom(validDate).withMessage('Fecha objetivo inválida'),
    body('status').optional().isIn(STATUSES).withMessage(`status debe ser uno de: ${STATUSES.join(', ')}`),
  ];
};

export const listSavingsGoalsValidator = [
  query('type').optional().isIn(TYPES).withMessage('type inválido'),
  query('status').optional().isIn(STATUSES).withMessage('status inválido'),
];

export const createSavingsGoalValidator = goalFields(false);
export const updateSavingsGoalValidator = goalFields(true);

export const contributeValidator = [
  body('amount').isFloat({ gt: 0, max: 99_999_999 }).withMessage('El monto debe ser mayor a 0').toFloat(),
];
