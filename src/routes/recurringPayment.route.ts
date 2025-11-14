import express from 'express';
import { RecurringPaymentController } from '../controllers/recurringPayment.controller';
import { authMiddleware } from '../middlewares/authMiddleware';
import {
  createRecurringPaymentValidator,
  updateRecurringPaymentValidator,
  getRecurringPaymentValidator,
  deleteRecurringPaymentValidator,
  executeRecurringPaymentValidator,
  getRecurringPaymentsQueryValidator,
} from '../validators/recurringPayments.validator';

const router = express.Router();

router.get(
  '/',
  authMiddleware,
  getRecurringPaymentsQueryValidator,
  RecurringPaymentController.getRecurringPayments
);

router.get(
  '/:id',
  authMiddleware,
  getRecurringPaymentValidator,
  RecurringPaymentController.getRecurringPaymentById
);

router.post(
  '/',
  authMiddleware,
  createRecurringPaymentValidator,
  RecurringPaymentController.createRecurringPayment
);

router.put(
  '/:id',
  authMiddleware,
  updateRecurringPaymentValidator,
  RecurringPaymentController.updateRecurringPayment
);

router.delete(
  '/:id',
  authMiddleware,
  deleteRecurringPaymentValidator,
  RecurringPaymentController.deleteRecurringPayment
);

router.post(
  '/:id/execute',
  authMiddleware,
  executeRecurringPaymentValidator,
  RecurringPaymentController.executeRecurringPayment
);

router.post(
  '/process-all',
  RecurringPaymentController.processAllRecurringPayments
);

export default router;
