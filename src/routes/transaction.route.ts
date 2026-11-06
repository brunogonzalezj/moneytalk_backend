import { Router } from 'express';
import { TransactionController } from '../controllers/transaction.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import {
  createTransactionValidator,
  exportTransactionsValidator,
  idParamValidator,
  listTransactionsValidator,
  summaryValidator,
  updateTransactionValidator,
} from '../validators/transaction.validator';

const router = Router();

router.use(authMiddleware);

router.get('/', validate(listTransactionsValidator), asyncHandler(TransactionController.list));
// Declared before /:id so they are not taken as ids
router.get('/summary', validate(summaryValidator), asyncHandler(TransactionController.summary));
router.get('/export', validate(exportTransactionsValidator), asyncHandler(TransactionController.export));
router.post('/', validate(createTransactionValidator), asyncHandler(TransactionController.create));
router.put('/:id', validate(updateTransactionValidator), asyncHandler(TransactionController.update));
router.delete('/:id', validate(idParamValidator), asyncHandler(TransactionController.remove));

export default router;
