import { env } from '../config/env';

type Level = 'debug' | 'info' | 'warn' | 'error';

const order: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const minLevel: Level = env.NODE_ENV === 'production' ? 'info' : 'debug';

const write = (level: Level, message: string, meta?: unknown) => {
  if (env.NODE_ENV === 'test' || order[level] < order[minLevel]) return;
  const line = `[${new Date().toISOString()}] ${level.toUpperCase()} ${message}`;
  const sink = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  if (meta === undefined) sink(line);
  else sink(line, meta);
};

export const logger = {
  debug: (message: string, meta?: unknown) => write('debug', message, meta),
  info: (message: string, meta?: unknown) => write('info', message, meta),
  warn: (message: string, meta?: unknown) => write('warn', message, meta),
  error: (message: string, meta?: unknown) => write('error', message, meta),
};
