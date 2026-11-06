// Must be the first import: loads and validates .env before anything reads it
import { env } from './config/env';
import { createApp } from './app';
import { startJobs } from './jobs';
import prisma from './lib/prisma';
import { logger } from './utils/logger';

const start = async () => {
  const server = createApp().listen(env.PORT, () => {
    logger.info(`Servidor escuchando en el puerto ${env.PORT} (${env.NODE_ENV})`);
  });

  startJobs();

  const shutdown = (signal: string) => {
    logger.info(`${signal} recibido, cerrando servidor...`);
    server.close(() => {
      void prisma.$disconnect().finally(() => process.exit(0));
    });
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
};

start().catch((error) => {
  logger.error('No se pudo iniciar el servidor', error);
  process.exit(1);
});
