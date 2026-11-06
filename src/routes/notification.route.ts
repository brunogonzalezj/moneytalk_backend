import { Router } from 'express';
import { NotificationController } from '../controllers/notification.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import { settingsValidator, subscribeValidator } from '../validators/notification.validator';

const router = Router();

router.use(authMiddleware);

router.post('/subscribe', validate(subscribeValidator), asyncHandler(NotificationController.subscribe));
router.post('/unsubscribe', asyncHandler(NotificationController.unsubscribe));
router.get('/status', asyncHandler(NotificationController.getStatus));
router.get('/settings', asyncHandler(NotificationController.getSettings));
router.post('/settings', validate(settingsValidator), asyncHandler(NotificationController.saveSettings));
router.post('/test', asyncHandler(NotificationController.sendTest));

export default router;
