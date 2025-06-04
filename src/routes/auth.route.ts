import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
// import { validateRequest } from '../middlewares/validateRequest';
// import { signupSchema, loginSchema, refreshSchema } from '../types';

const router = Router();

// router.post('/signup', validateRequest(signupSchema), AuthController.signup);
// router.post('/login', validateRequest(loginSchema), AuthController.login);
// router.post('/refresh', validateRequest(refreshSchema), AuthController.refresh);

// Por ahora sin validación para pruebas iniciales:
router.post('/signup', AuthController.signup);
router.post('/login', AuthController.login);
router.post('/refresh', AuthController.refresh);

export default router;

