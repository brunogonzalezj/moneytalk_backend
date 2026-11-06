import bcrypt from 'bcrypt';
import { env } from '../config/env';

// bcrypt cost: 12 in real use, minimal in tests so suites stay fast
const SALT_ROUNDS = env.NODE_ENV === 'test' ? 4 : 12;

export const hashPassword = (password: string): Promise<string> => bcrypt.hash(password, SALT_ROUNDS);

export const comparePassword = (password: string, hash: string): Promise<boolean> => bcrypt.compare(password, hash);
