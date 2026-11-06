import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { authLimiter } from '../middlewares/rateLimit';
import { validate } from '../middlewares/validate.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import {
  changePasswordValidator,
  deleteAccountValidator,
  googleValidator,
  loginValidator,
  refreshValidator,
  signupValidator,
  updateProfileValidator,
} from '../validators/auth.validator';

const router = Router();

router.post('/signup', authLimiter, validate(signupValidator), asyncHandler(AuthController.signup));
router.post('/login', authLimiter, validate(loginValidator), asyncHandler(AuthController.login));
router.post('/refresh', authLimiter, validate(refreshValidator), asyncHandler(AuthController.refresh));
router.post('/logout', asyncHandler(AuthController.logout));
router.post('/google', authLimiter, validate(googleValidator), asyncHandler(AuthController.google));

router.get('/me', authMiddleware, asyncHandler(AuthController.me));
router.put('/profile', authMiddleware, validate(updateProfileValidator), asyncHandler(AuthController.updateProfile));
router.put(
  '/change-password',
  authMiddleware,
  validate(changePasswordValidator),
  asyncHandler(AuthController.changePassword)
);
router.delete('/account', authMiddleware, validate(deleteAccountValidator), asyncHandler(AuthController.deleteAccount));

export default router;
