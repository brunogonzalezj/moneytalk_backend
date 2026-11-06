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
    if (!user || !user.passwordHash) throw new Error('Credenciales inválidas');
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

  static async updateProfile(userId: number, name?: string, email?: string): Promise<UserPayload> {
    // First verify the user exists
    const existingUser = await prisma.user.findUnique({ where: { id: userId } });
    if (!existingUser) {
      throw new Error('Usuario no encontrado');
    }

    // If email is being updated, check if it's already taken by another user
    if (email && email !== existingUser.email) {
      const emailTaken = await prisma.user.findUnique({ where: { email } });
      if (emailTaken) {
        throw new Error('El correo electrónico ya está en uso');
      }
    }

    // Update the user with provided fields
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(name && { name }),
        ...(email && { email }),
      },
      select: {
        id: true,
        email: true,
        name: true,
      },
    });

    return {
      id: updatedUser.id,
      email: updatedUser.email,
      name: updatedUser.name,
    };
  }

  static async changePassword(userId: number, currentPassword: string, newPassword: string): Promise<void> {
    // First verify the user exists
    const existingUser = await prisma.user.findUnique({ where: { id: userId } });
    if (!existingUser) {
      throw new Error('Usuario no encontrado');
    }

    // Google-only accounts have no password to change
    if (!existingUser.passwordHash) {
      throw new Error('Esta cuenta no tiene contraseña. Inicia sesión con Google.');
    }

    // Verify current password
    const isValidPassword = await comparePassword(currentPassword, existingUser.passwordHash);
    if (!isValidPassword) {
      throw new Error('La contraseña actual es incorrecta');
    }

    // Hash new password
    const newPasswordHash = await hashPassword(newPassword);

    // Update password
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newPasswordHash },
    });

    // Invalidate all refresh tokens for security
    await prisma.refreshToken.deleteMany({ where: { userId } });
  }

  static async getUserById(userId: number): Promise<UserPayload> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        createdAt: true
      }
    });

    if (!user) {
      throw new Error('Usuario no encontrado');
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatar: user.avatar ?? undefined
    };
  }
}
