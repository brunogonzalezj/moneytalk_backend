import {PrismaClient}  from '@prisma/client';
import { hashPassword } from '../utils/hashPassword';
import { comparePassword } from '../utils/comparePassword';
import { generateTokens, getRefreshTokenExpiryDate } from '../utils/generateTokens';
import { TokenPayload, AuthTokens, UserPayload } from '../types';

const prisma = new PrismaClient();

export class AuthService {
  static async signupUser(email: string, password: string, displayName: string): Promise<{ tokens: AuthTokens; user: UserPayload }> {
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      throw new Error('El correo ya está registrado');
    }
    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: { email, passwordHash, name: displayName },
    });
    const payload: TokenPayload = { id: user.id, userId: user.id, email: user.email, name: user.name };
    const tokens = generateTokens(payload);
    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        token: tokens.refreshToken,
        expiresAt: getRefreshTokenExpiryDate(),
      },
    });
    return { tokens, user: { id: user.id, email: user.email, name: user.name } };
  }

  static async loginUser(email: string, password: string): Promise<{ tokens: AuthTokens; user: UserPayload }> {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw new Error('Credenciales inválidas');
    const valid = await comparePassword(password, user.passwordHash);
    if (!valid) throw new Error('Credenciales inválidas');
    // Invalida todos los refresh tokens anteriores
    await prisma.refreshToken.deleteMany({ where: { userId: user.id } });
    const payload: TokenPayload = { id: user.id, userId: user.id, email: user.email, name: user.name };
    const tokens = generateTokens(payload);
    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        token: tokens.refreshToken,
        expiresAt: getRefreshTokenExpiryDate(),
      },
    });
    return { tokens, user: { id: user.id, email: user.email, name: user.name } };
  }

  static async refreshTokens(refreshToken: string): Promise<{ tokens: AuthTokens; user: UserPayload }> {
    const tokenRecord = await prisma.refreshToken.findUnique({ where: { token: refreshToken } });
    if (!tokenRecord || tokenRecord.expiresAt < new Date()) {
      throw new Error('Refresh token inválido o expirado');
    }
    const user = await prisma.user.findUnique({ where: { id: tokenRecord.userId } });
    if (!user) throw new Error('Usuario no encontrado');
    await prisma.refreshToken.delete({ where: { token: refreshToken } });
    const payload: TokenPayload = { id: user.id, userId: user.id, email: user.email, name: user.name };
    const tokens = generateTokens(payload);
    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        token: tokens.refreshToken,
        expiresAt: getRefreshTokenExpiryDate(),
      },
    });
    return { tokens, user: { id: user.id, email: user.email, name: user.name } };
  }
}
