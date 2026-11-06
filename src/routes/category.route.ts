import { Router } from 'express';
import { CategoryController } from '../controllers/category.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import { createCategoryValidator, listCategoriesValidator } from '../validators/category.validator';

const router = Router();

router.use(authMiddleware);

router.get('/', validate(listCategoriesValidator), asyncHandler(CategoryController.list));
router.post('/', validate(createCategoryValidator), asyncHandler(CategoryController.create));

export default router;
