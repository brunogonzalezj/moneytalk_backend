import { body, query } from 'express-validator';
import { RecurrenceFrequency } from '../generated/prisma/client';

const FREQUENCIES = Object.values(RecurrenceFrequency);
const validDate = (value: unknown) => typeof value === 'string' && !Number.isNaN(Date.parse(value));

const paymentFields = (optional: boolean) => {
  const field = (name: string) => (optional ? body(name).optional() : body(name));
  return [
    field('categoryId').isInt({ min: 1 }).withMessage('Selecciona una categoría').toInt(),
    field('name').isString().trim().isLength({ min: 1, max: 100 }).withMessage('El nombre es obligatorio (máximo 100 caracteres)'),
    field('amount').isFloat({ gt: 0, max: 99_999_999 }).withMessage('El monto debe ser mayor a 0').toFloat(),
    body('description').optional({ nullable: true }).isString().trim().isLength({ max: 191 }),
    field('frequency').isIn(FREQUENCIES).withMessage('La frecuencia debe ser DAILY, WEEKLY, MONTHLY o YEARLY'),
    field('startDate').custom(validDate).withMessage('La fecha de inicio es obligatoria'),
    body('endDate')
      .optional({ nullable: true })
      .custom(validDate)
      .withMessage('Fecha de fin inválida')
      .custom((endDate, { req }) => !req.body.startDate || Date.parse(endDate) >= Date.parse(req.body.startDate))
      .withMessage('La fecha de fin debe ser posterior a la de inicio'),
    body('isActive').optional().isBoolean().withMessage('isActive debe ser verdadero o falso').toBoolean(),
  ];
};

export const listRecurringPaymentsValidator = [
  query('isActive').optional().isBoolean().withMessage('isActive debe ser true o false').toBoolean(),
  query('frequency').optional().isIn(FREQUENCIES).withMessage('Frecuencia inválida'),
];

export const createRecurringPaymentValidator = paymentFields(false);
export const updateRecurringPaymentValidator = paymentFields(true);
