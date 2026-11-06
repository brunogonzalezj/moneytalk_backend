import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { authMiddleware } from '../middlewares/authMiddleware';
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

// Ruta para actualizar perfil (requiere autenticación)
router.put('/profile', authMiddleware, AuthController.updateProfile);

// Ruta para cambiar contraseña (requiere autenticación)
router.put('/change-password', authMiddleware, AuthController.changePassword);

// Rutas de autenticación con Google
router.post('/google', AuthController.googleAuth);
router.post('/google/callback', AuthController.googleCallback);
router.get('/google/url', AuthController.getGoogleAuthUrl);

// Ruta para obtener información del usuario actual
router.get('/me', authMiddleware, AuthController.getCurrentUser);

export default router;

