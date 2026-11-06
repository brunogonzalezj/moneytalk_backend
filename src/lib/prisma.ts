import { PrismaClient } from '@prisma/client';
import { env } from '../config/env';

// One client for the whole process; reused across ts-node-dev reloads in development
declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

const prisma = global.prisma ?? new PrismaClient();

if (env.NODE_ENV !== 'production') {
  global.prisma = prisma;
}

export default prisma;
