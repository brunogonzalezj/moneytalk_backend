import dotenv from 'dotenv';
import { z } from 'zod';

// Loaded before anything reads process.env: server.ts imports this module first
dotenv.config({ path: process.env.NODE_ENV === 'test' ? '.env.test' : '.env' });

const bool = (fallback: boolean) =>
  z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => (value === undefined ? fallback : value === 'true'));

const isTest = process.env.NODE_ENV === 'test';
// Tests never call OpenAI or sign real tokens for clients, so they get harmless defaults
const required = (testDefault: string) => (isTest ? z.string().min(1).default(testDefault) : z.string().min(1));

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1),

  JWT_ACCESS_SECRET: required('test-access-secret'),
  JWT_REFRESH_SECRET: required('test-refresh-secret'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('30m'),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),

  OPENAI_API_KEY: required('test-openai-key'),
  OPENAI_MODEL: z.string().default('gpt-4o-mini'),

  // Comma-separated list of allowed origins
  CORS_ORIGIN: z
    .string()
    .default('http://localhost:5173')
    .transform((value) => value.split(',').map((origin) => origin.trim()).filter(Boolean)),

  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),

  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  VAPID_SUBJECT: z.string().default('mailto:soporte@moneytalk.app'),

  ENABLE_CRON: bool(!isTest),
  ENABLE_NOTIFICATIONS: bool(!isTest),
  CRON_TEST_MODE: bool(false),
  // Timezone used by cron schedules and as the default for users without one
  APP_TIMEZONE: z.string().default('America/La_Paz'),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const missing = parsed.error.issues.map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`).join('\n');
  // eslint-disable-next-line no-console
  console.error(`Configuración inválida. Revisa tu archivo .env:\n${missing}`);
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;
