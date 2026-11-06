import { User } from '@prisma/client';
import prisma from '../lib/prisma';
import { AuthTokens, UserPayload } from '../types';
import { AppError } from '../utils/AppError';
import { comparePassword, hashPassword } from '../utils/password';
import { generateTokens, getRefreshTokenExpiryDate, verifyRefreshToken } from '../utils/tokens';
import { RecommendationsService } from './ai/recommendations.service';

export interface Session {
  tokens: AuthTokens;
  user: UserPayload;
}

const toUserPayload = (user: Pick<User, 'id' | 'email' | 'name' | 'avatar'>): UserPayload => ({
  id: user.id,
  email: user.email,
  name: user.name,
  ...(user.avatar && { avatar: user.avatar }),
});

const invalidCredentials = () => new AppError(401, 'INVALID_CREDENTIALS', 'Correo o contraseña incorrectos');
const invalidRefresh = () => new AppError(401, 'REFRESH_INVALID', 'La sesión expiró. Inicia sesión de nuevo.');

export class AuthService {
  /**
   * Issues an access/refresh pair and stores the refresh token. Other sessions
   * stay valid; only this user's expired refresh tokens are cleaned up.
   */
  static async startSession(user: Pick<User, 'id' | 'email' | 'name' | 'avatar'>): Promise<Session> {
    const tokens = generateTokens({ id: user.id, email: user.email, name: user.name });
    await prisma.$transaction([
      prisma.refreshToken.deleteMany({ where: { userId: user.id, expiresAt: { lt: new Date() } } }),
      prisma.refreshToken.create({
        data: { userId: user.id, token: tokens.refreshToken, expiresAt: getRefreshTokenExpiryDate() },
      }),
    ]);
    return { tokens, user: toUserPayload(user) };
  }

  static async signup(name: string, email: string, password: string): Promise<Session> {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw AppError.conflict('Ya existe una cuenta con ese correo');

    const user = await prisma.user.create({
      data: { email, name, passwordHash: await hashPassword(password), provider: 'email' },
    });
    return this.startSession(user);
  }

  static async login(email: string, password: string): Promise<Session> {
    const user = await prisma.user.findUnique({ where: { email } });
    // Google-only accounts have no password
    if (!user?.passwordHash) throw invalidCredentials();
    if (!(await comparePassword(password, user.passwordHash))) throw invalidCredentials();
    return this.startSession(user);
  }

  /** Rotates a refresh token: the old one stops working as soon as the new one exists. */
  static async refresh(refreshToken: string): Promise<Session> {
    try {
      verifyRefreshToken(refreshToken);
    } catch {
      throw invalidRefresh();
    }

    const record = await prisma.refreshToken.findUnique({ where: { token: refreshToken }, include: { user: true } });
    if (!record || record.expiresAt < new Date()) throw invalidRefresh();

    const tokens = generateTokens({ id: record.user.id, email: record.user.email, name: record.user.name });
    try {
      await prisma.$transaction([
        prisma.refreshToken.delete({ where: { id: record.id } }),
        prisma.refreshToken.create({
          data: { userId: record.userId, token: tokens.refreshToken, expiresAt: getRefreshTokenExpiryDate() },
        }),
      ]);
    } catch {
      // Another request rotated this token first
      throw invalidRefresh();
    }
    return { tokens, user: toUserPayload(record.user) };
  }

  static async logout(refreshToken: string): Promise<void> {
    await prisma.refreshToken.deleteMany({ where: { token: refreshToken } });
  }

  static async getUserById(userId: number): Promise<UserPayload> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw AppError.notFound('Usuario no encontrado');
    return toUserPayload(user);
  }

  static async updateProfile(userId: number, changes: { name?: string; email?: string }): Promise<UserPayload> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw AppError.notFound('Usuario no encontrado');

    if (changes.email && changes.email !== user.email) {
      // The email of a Google account is owned by Google
      if (user.provider === 'google') throw AppError.badRequest('El correo de una cuenta de Google no se puede cambiar');
      const taken = await prisma.user.findUnique({ where: { email: changes.email } });
      if (taken) throw AppError.conflict('Ese correo ya está en uso');
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { ...(changes.name && { name: changes.name }), ...(changes.email && { email: changes.email }) },
    });
    return toUserPayload(updated);
  }

  static async changePassword(userId: number, currentPassword: string, newPassword: string): Promise<void> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw AppError.notFound('Usuario no encontrado');
    if (!user.passwordHash) {
      throw AppError.badRequest('Esta cuenta no tiene contraseña. Inicia sesión con Google.');
    }
    if (!(await comparePassword(currentPassword, user.passwordHash))) {
      throw new AppError(400, 'INVALID_PASSWORD', 'La contraseña actual es incorrecta');
    }

    // Signs out every other session
    await prisma.$transaction([
      prisma.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(newPassword) } }),
      prisma.refreshToken.deleteMany({ where: { userId } }),
    ]);
  }

  /**
   * Permanently deletes the account and all its data. Email accounts confirm
   * with their password; Google accounts by typing their email.
   */
  static async deleteAccount(userId: number, confirmation: { password?: string; email?: string }): Promise<void> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw AppError.notFound('Usuario no encontrado');

    if (user.passwordHash) {
      if (!confirmation.password || !(await comparePassword(confirmation.password, user.passwordHash))) {
        throw new AppError(400, 'INVALID_PASSWORD', 'La contraseña es incorrecta');
      }
    } else if (confirmation.email?.trim().toLowerCase() !== user.email.toLowerCase()) {
      throw AppError.badRequest('Escribe tu correo exactamente para confirmar');
    }

    // Explicit order: transactions reference recurring payments and categories
    await prisma.$transaction([
      prisma.transaction.deleteMany({ where: { userId } }),
      prisma.recurringPayment.deleteMany({ where: { userId } }),
      prisma.savingsGoal.deleteMany({ where: { userId } }),
      prisma.refreshToken.deleteMany({ where: { userId } }),
      prisma.user.delete({ where: { id: userId } }),
    ]);
    RecommendationsService.forget(userId);
  }
}
