import { Router } from 'express';
import { aiRouter, gptRouter } from './ai.route';
import authRoute from './auth.route';
import categoryRoute from './category.route';
import notificationRoute from './notification.route';
import recurringPaymentRoute from './recurringPayment.route';
import savingsGoalRoute from './savingsGoal.route';
import transactionRoute from './transaction.route';

const router = Router();

router.get('/health', (_req, res) => res.json({ status: 'ok' }));

router.use('/auth', authRoute);
router.use('/transactions', transactionRoute);
router.use('/categories', categoryRoute);
router.use('/savings-goals', savingsGoalRoute);
router.use('/recurring-payments', recurringPaymentRoute);
router.use('/notifications', notificationRoute);
router.use('/ai', aiRouter);
router.use('/gpt', gptRouter);

export default router;
