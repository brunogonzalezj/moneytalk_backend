import jwt from 'jsonwebtoken';
import { TokenPayload, AuthTokens } from '../types';

/**
 * Generates JWT access and refresh tokens
 * @param payload User data to include in the token
 * @returns Object containing access and refresh tokens with their expiration
 */
export const generateTokens = (payload: TokenPayload): AuthTokens => {
  if (!process.env.JWT_ACCESS_SECRET || !process.env.JWT_REFRESH_SECRET) {
    throw new Error('JWT secrets are not defined in environment variables');
  }

  const accessToken = jwt.sign(payload, process.env.JWT_ACCESS_SECRET, {
    expiresIn: '24h',
  });

  const refreshToken = jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
    expiresIn: '30d',
  });

  return {
    accessToken,
    refreshToken,
  };
};

/**
 * Verifies JWT token
 * @param token JWT token
 * @param isRefreshToken Flag to indicate if token is a refresh token
 * @returns Decoded token payload
 */
export const verifyToken = (token: string, isRefreshToken = false): TokenPayload => {
  const secret = isRefreshToken
    ? process.env.JWT_REFRESH_SECRET
    : process.env.JWT_ACCESS_SECRET;

  if (!secret) {
    throw new Error('JWT secret is not defined in environment variables');
  }

  return jwt.verify(token, secret) as TokenPayload;
};

/**
 * Calculates expiry date for refresh tokens
 * @returns Date object set 7 days in the future
 */
export const getRefreshTokenExpiryDate = (): Date => {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  return date;
};
