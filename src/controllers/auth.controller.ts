import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.service';

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
}

