import { body, param, query } from 'express-validator';
import { isIsoDate } from '../utils/dates';

export const MAX_PAGE_SIZE = 100;
// Longest range per grouping, so a series never has more than ~400 points
const MAX_SUMMARY_DAYS = { day: 400, week: 2800, month: 3700 } as const;
const TYPES = ['INCOME', 'EXPENSE'];

const isoDateParam = (field: string) =>
  query(field).optional().custom(isIsoDate).withMessage(`${field} debe tener el formato YYYY-MM-DD`);

// Calendar dates (YYYY-MM-DD) or full ISO timestamps
const transactionDate = (optional: boolean) => {
  const chain = body('date');
  return (optional ? chain.optional() : chain)
    .custom((value) => typeof value === 'string' && (isIsoDate(value) || !Number.isNaN(Date.parse(value))))
    .withMessage('Fecha inválida');
};

const amount = (optional: boolean) => {
  const chain = body('amount');
  return (optional ? chain.optional() : chain)
    .isFloat({ gt: 0, max: 99_999_999 })
    .withMessage('El monto debe ser mayor a 0')
    .toFloat();
};

const description = (optional: boolean) => {
  const chain = body('description');
  return (optional ? chain.optional() : chain)
    .isString()
    .trim()
    .isLength({ min: 1, max: 191 })
    .withMessage('La descripción es obligatoria (máximo 191 caracteres)');
};

const categoryId = (optional: boolean) => {
  const chain = body('categoryId');
  return (optional ? chain.optional() : chain).isInt({ min: 1 }).withMessage('Categoría inválida').toInt();
};

export const idParamValidator = [param('id').isInt({ min: 1 }).withMessage('ID inválido').toInt()];

export const listTransactionsValidator = [
  query('page').optional().isInt({ min: 1 }).withMessage('page debe ser un entero positivo').toInt(),
  query('limit')
    .optional()
    .isInt({ min: 1, max: MAX_PAGE_SIZE })
    .withMessage(`limit debe estar entre 1 y ${MAX_PAGE_SIZE}`)
    .toInt(),
  query('type').optional().isIn([...TYPES, 'all']).withMessage('type debe ser INCOME, EXPENSE o all'),
  query('category').optional().isInt({ min: 1 }).withMessage('category debe ser un ID numérico').toInt(),
  isoDateParam('dateFrom'),
  isoDateParam('dateTo'),
  query('search').optional().isString().trim().isLength({ max: 100 }),
];

export const exportTransactionsValidator = [
  isoDateParam('dateFrom'),
  isoDateParam('dateTo'),
  query('format').optional().toUpperCase().isIn(['CSV', 'XLSX']).withMessage('Formato inválido. Usa CSV o XLSX.'),
];

export const summaryValidator = [
  // Without `from` the totals cover all history and no series is returned
  query('from').optional().custom(isIsoDate).withMessage('from debe tener el formato YYYY-MM-DD'),
  query('to').custom(isIsoDate).withMessage('to es obligatorio (YYYY-MM-DD)'),
  query('groupBy').optional().isIn(['day', 'week', 'month']).withMessage('groupBy debe ser day, week o month'),
  query('to').custom((to, { req }) => {
    const from = req.query?.from as string | undefined;
    if (!from) return true;
    const days = (Date.parse(to) - Date.parse(from)) / 86_400_000;
    if (days < 0) throw new Error('to debe ser posterior a from');
    const groupBy = (req.query?.groupBy as keyof typeof MAX_SUMMARY_DAYS | undefined) ?? 'day';
    const max = MAX_SUMMARY_DAYS[groupBy] ?? MAX_SUMMARY_DAYS.day;
    if (days > max) throw new Error(`El rango máximo agrupando por ${groupBy} es de ${max} días`);
    return true;
  }),
];

export const createTransactionValidator = [
  amount(false),
  description(false),
  transactionDate(false),
  categoryId(false),
  body('type').optional().isIn(TYPES).withMessage('type debe ser INCOME o EXPENSE'),
];

export const updateTransactionValidator = [
  ...idParamValidator,
  amount(true),
  description(true),
  transactionDate(true),
  categoryId(true),
];
