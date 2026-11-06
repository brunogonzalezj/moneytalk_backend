import crypto from 'crypto';
import jwt, { SignOptions } from 'jsonwebtoken';
import { env } from '../config/env';
import { AuthTokens, TokenPayload } from '../types';

const DAY_MS = 24 * 60 * 60 * 1000;

export const generateTokens = (payload: TokenPayload): AuthTokens => {
  const claims = { id: payload.id, email: payload.email, name: payload.name };
  const accessToken = jwt.sign(claims, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN as SignOptions['expiresIn'],
  });
  // jti keeps two refresh tokens issued in the same second from colliding on the unique column
  const refreshToken = jwt.sign(claims, env.JWT_REFRESH_SECRET, {
    expiresIn: `${env.REFRESH_TOKEN_TTL_DAYS}d`,
    jwtid: crypto.randomUUID(),
  });
  return { accessToken, refreshToken };
};

export const verifyAccessToken = (token: string): TokenPayload =>
  jwt.verify(token, env.JWT_ACCESS_SECRET) as TokenPayload;

export const verifyRefreshToken = (token: string): TokenPayload =>
  jwt.verify(token, env.JWT_REFRESH_SECRET) as TokenPayload;

export const getRefreshTokenExpiryDate = (): Date => new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * DAY_MS);
