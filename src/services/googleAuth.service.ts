import { OAuth2Client } from 'google-auth-library';
import { PrismaClient } from '@prisma/client';
import { generateTokens, getRefreshTokenExpiryDate } from '../utils/generateTokens';
import { TokenPayload, AuthTokens, UserPayload } from '../types';

const prisma = new PrismaClient();

// Configuración del cliente de OAuth2 de Google
const googleClient = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  'postmessage' // Para el flujo de autorización
);

export class GoogleAuthService {
  /**
   * Verifica el token de ID de Google y crea o actualiza un usuario
   */
  static async authenticateWithGoogle(token: string): Promise<{ tokens: AuthTokens; user: UserPayload; isNewUser: boolean }> {
    try {
      // Verificar el token con Google
      const ticket = await googleClient.verifyIdToken({
        idToken: token,
        audience: process.env.GOOGLE_CLIENT_ID,
      });

      const payload = ticket.getPayload();
      if (!payload || !payload.email) {
        throw new Error('Token de Google inválido o sin email');
      }

      const { email, name, picture, sub: googleId } = payload;

      // Buscar usuario existente por email o por Google ID
      let user = await prisma.user.findFirst({
        where: {
          OR: [
            { email },
            { providerId: googleId }
          ]
        }
      });

      let isNewUser = false;

      if (user) {
        // Si el usuario existe pero no tiene Google ID, actualizarlo
        if (user.provider !== 'google' || !user.providerId) {
          user = await prisma.user.update({
            where: { id: user.id },
            data: {
              provider: 'google',
              providerId: googleId,
              avatar: picture,
              name: name || user.name,
            }
          });
        } else {
          // Actualizar avatar y nombre si han cambiado
          user = await prisma.user.update({
            where: { id: user.id },
            data: {
              avatar: picture,
              name: name || user.name,
            }
          });
        }
      } else {
        // Crear nuevo usuario
        user = await prisma.user.create({
          data: {
            email,
            name: name || 'Usuario de Google',
            provider: 'google',
            providerId: googleId,
            avatar: picture,
          }
        });
        isNewUser = true;
      }

      // Invalidar refresh tokens anteriores
      await prisma.refreshToken.deleteMany({ where: { userId: user.id } });

      // Generar nuevos tokens
      const tokenPayload: TokenPayload = {
        id: user.id,
        userId: user.id,
        email: user.email,
        name: user.name
      };

      const tokens = generateTokens(tokenPayload);

      // Guardar refresh token
      await prisma.refreshToken.create({
        data: {
          userId: user.id,
          token: tokens.refreshToken,
          expiresAt: getRefreshTokenExpiryDate(),
        },
      });

      return {
        tokens,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatar: user.avatar
        } as UserPayload,
        isNewUser
      };

    } catch (error) {
      console.error('Error en autenticación con Google:', error);
      throw new Error('Error al autenticar con Google');
    }
  }

  /**
   * Obtiene la URL de autorización de Google
   */
  static getGoogleAuthUrl(): string {
    const scopes = [
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile'
    ];

    return googleClient.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent'
    });
  }

  /**
   * Intercambia el código de autorización por tokens
   */
  static async exchangeCodeForTokens(code: string): Promise<{ tokens: AuthTokens; user: UserPayload; isNewUser: boolean }> {
    try {
      const { tokens } = await googleClient.getToken(code);

      if (!tokens.id_token) {
        throw new Error('No se obtuvo ID token de Google');
      }

      return await this.authenticateWithGoogle(tokens.id_token);
    } catch (error) {
      console.error('Error intercambiando código por tokens:', error);
      throw new Error('Error al intercambiar código de autorización');
    }
  }
}