import { Request, Response } from 'express';
import { AuthService, Session } from '../services/auth.service';
import { GoogleAuthService } from '../services/googleAuth.service';

const sessionBody = ({ tokens, user }: Session) => ({
  accessToken: tokens.accessToken,
  refreshToken: tokens.refreshToken,
  user,
});

export class AuthController {
  static async signup(req: Request, res: Response) {
    const { email, password, name, displayName } = req.body;
    const session = await AuthService.signup(name ?? displayName, email, password);
    res.status(201).json(sessionBody(session));
  }

  static async login(req: Request, res: Response) {
    res.json(sessionBody(await AuthService.login(req.body.email, req.body.password)));
  }

  static async refresh(req: Request, res: Response) {
    res.json(sessionBody(await AuthService.refresh(req.body.refreshToken)));
  }

  // Works without an access token so an expired session can still sign out
  static async logout(req: Request, res: Response) {
    if (typeof req.body?.refreshToken === 'string') await AuthService.logout(req.body.refreshToken);
    res.status(204).send();
  }

  static async google(req: Request, res: Response) {
    const { isNewUser, ...session } = await GoogleAuthService.authenticate(req.body.token);
    res.json({ ...sessionBody(session), isNewUser });
  }

  static async me(req: Request, res: Response) {
    res.json({ user: await AuthService.getUserById(req.user!.id) });
  }

  static async updateProfile(req: Request, res: Response) {
    const { name, email } = req.body;
    res.json({ user: await AuthService.updateProfile(req.user!.id, { name, email }) });
  }

  static async changePassword(req: Request, res: Response) {
    await AuthService.changePassword(req.user!.id, req.body.currentPassword, req.body.newPassword);
    res.status(204).send();
  }

  static async deleteAccount(req: Request, res: Response) {
    await AuthService.deleteAccount(req.user!.id, { password: req.body?.password, email: req.body?.email });
    res.status(204).send();
  }
}
