import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.service';
import { GoogleAuthService } from '../services/googleAuth.service';

export class AuthController {
  static async signup(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password, displayName } = req.body;
      const { tokens, user } = await AuthService.signupUser(email, password, displayName);
      res.status(201).json({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, user });
    } catch (err) {
      next(err);
    }
  }

  static async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password } = req.body;
      const { tokens, user } = await AuthService.loginUser(email, password);
      res.json({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, user });
    } catch (err) {
      next(err);
    }
  }

  static async refresh(req: Request, res: Response, next: NextFunction) {
    try {
      const { refreshToken } = req.body;
      const { tokens, user } = await AuthService.refreshTokens(refreshToken);
      res.json({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, user });
    } catch (err) {
      next(err);
    }
  }

  static async updateProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'No autorizado' });
      }
      const { name, email } = req.body;

      const updatedUser = await AuthService.updateProfile(userId, name, email);
      res.json({ user: updatedUser });
    } catch (err) {
      next(err);
    }
  }

  static async changePassword(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'No autorizado' });
      }
      const { currentPassword, newPassword } = req.body;

      await AuthService.changePassword(userId, currentPassword, newPassword);
      res.json({ message: 'Contraseña cambiada exitosamente' });
    } catch (err) {
      next(err);
    }
  }

  static async googleAuth(req: Request, res: Response, next: NextFunction) {
    try {
      const { token } = req.body;
      const { tokens, user, isNewUser } = await GoogleAuthService.authenticateWithGoogle(token);
      res.json({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, user, isNewUser });
    } catch (err) {
      next(err);
    }
  }

  static async googleCallback(req: Request, res: Response, next: NextFunction) {
    try {
      const { code } = req.body;
      const { tokens, user, isNewUser } = await GoogleAuthService.exchangeCodeForTokens(code);
      res.json({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, user, isNewUser });
    } catch (err) {
      next(err);
    }
  }

  static async getGoogleAuthUrl(req: Request, res: Response, next: NextFunction) {
    try {
      const authUrl = GoogleAuthService.getGoogleAuthUrl();
      res.json({ authUrl });
    } catch (err) {
      next(err);
    }
  }

  static async getCurrentUser(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'No autorizado' });
      }
      const user = await AuthService.getUserById(userId);
      res.json({ user });
    } catch (err) {
      next(err);
    }
  }
}

