import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { env } from '../config/env';
import { PrismaClient } from '../generated/prisma/client';

/**
 * Prisma 7 talks to MySQL through the MariaDB driver adapter (no Rust engine).
 * MySQL 8+ uses caching_sha2_password; without TLS the driver must fetch the
 * server's public key, which `allowPublicKeyRetrieval` enables.
 */
const createClient = () => {
  const url = new URL(env.DATABASE_URL);
  if (!url.searchParams.has('allowPublicKeyRetrieval')) url.searchParams.set('allowPublicKeyRetrieval', 'true');
  return new PrismaClient({ adapter: new PrismaMariaDb(url.toString()) });
};

// One client for the whole process; reused across ts-node-dev reloads in development
declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

const prisma = global.prisma ?? createClient();

if (env.NODE_ENV !== 'production') {
  global.prisma = prisma;
}

export default prisma;
