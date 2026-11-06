import { Router } from 'express';
import { RecurringPaymentController } from '../controllers/recurringPayment.controller';
import { authMiddleware, requireAdmin } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import {
  createRecurringPaymentValidator,
  listRecurringPaymentsValidator,
  updateRecurringPaymentValidator,
} from '../validators/recurringPayment.validator';
import { idParamValidator } from '../validators/transaction.validator';

const router = Router();

router.use(authMiddleware);

router.get('/', validate(listRecurringPaymentsValidator), asyncHandler(RecurringPaymentController.list));
router.post('/process-all', asyncHandler(requireAdmin), asyncHandler(RecurringPaymentController.processAll));
router.get('/:id', validate(idParamValidator), asyncHandler(RecurringPaymentController.get));
router.post('/', validate(createRecurringPaymentValidator), asyncHandler(RecurringPaymentController.create));
router.put(
  '/:id',
  validate([...idParamValidator, ...updateRecurringPaymentValidator]),
  asyncHandler(RecurringPaymentController.update)
);
router.delete('/:id', validate(idParamValidator), asyncHandler(RecurringPaymentController.remove));
router.post('/:id/execute', validate(idParamValidator), asyncHandler(RecurringPaymentController.execute));

export default router;
