import { Router } from 'express';
import { SavingsGoalController } from '../controllers/savingsGoal.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import {
  contributeValidator,
  createSavingsGoalValidator,
  listSavingsGoalsValidator,
  updateSavingsGoalValidator,
} from '../validators/savingsGoal.validator';
import { idParamValidator } from '../validators/transaction.validator';

const router = Router();

router.use(authMiddleware);

router.get('/', validate(listSavingsGoalsValidator), asyncHandler(SavingsGoalController.list));
router.get('/:id', validate(idParamValidator), asyncHandler(SavingsGoalController.get));
router.post('/', validate(createSavingsGoalValidator), asyncHandler(SavingsGoalController.create));
router.put('/:id', validate([...idParamValidator, ...updateSavingsGoalValidator]), asyncHandler(SavingsGoalController.update));
router.delete('/:id', validate(idParamValidator), asyncHandler(SavingsGoalController.remove));
router.post('/:id/add', validate([...idParamValidator, ...contributeValidator]), asyncHandler(SavingsGoalController.contribute));

export default router;
