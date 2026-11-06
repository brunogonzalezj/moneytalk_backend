import { env } from '../config/env';
import { getGoogleClient } from '../lib/googleClient';
import prisma from '../lib/prisma';
import { AppError } from '../utils/AppError';
import { logger } from '../utils/logger';
import { AuthService, Session } from './auth.service';

export class GoogleAuthService {
  /**
   * Verifies a Google ID token and signs the user in, creating the account on
   * first use. An existing email account is only linked when Google confirms
   * the address is verified.
   */
  static async authenticate(idToken: string): Promise<Session & { isNewUser: boolean }> {
    if (!env.GOOGLE_CLIENT_ID) {
      throw AppError.serviceUnavailable('El inicio de sesión con Google no está configurado');
    }

    let payload;
    try {
      const ticket = await getGoogleClient().verifyIdToken({ idToken, audience: env.GOOGLE_CLIENT_ID });
      payload = ticket.getPayload();
    } catch (error) {
      logger.warn('Token de Google rechazado', (error as Error).message);
      throw AppError.unauthorized('No se pudo verificar tu cuenta de Google');
    }

    if (!payload?.email || !payload.sub) throw AppError.unauthorized('La cuenta de Google no tiene correo');
    if (payload.email_verified !== true) {
      throw AppError.unauthorized('Tu correo de Google no está verificado');
    }

    const { email, name, picture, sub: googleId } = payload;
    const existing = await prisma.user.findFirst({ where: { OR: [{ providerId: googleId }, { email }] } });

    if (existing) {
      const user = await prisma.user.update({
        where: { id: existing.id },
        data: {
          provider: 'google',
          providerId: googleId,
          avatar: picture ?? existing.avatar,
          name: existing.name || name || 'Usuario de Google',
        },
      });
      return { ...(await AuthService.startSession(user)), isNewUser: false };
    }

    const user = await prisma.user.create({
      data: { email, name: name || 'Usuario de Google', provider: 'google', providerId: googleId, avatar: picture },
    });
    return { ...(await AuthService.startSession(user)), isNewUser: true };
  }
}
