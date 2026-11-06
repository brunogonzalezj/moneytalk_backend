import dotenv from 'dotenv';
import { defineConfig, env } from 'prisma/config';

// Prisma 7 no longer reads .env by itself. Tests set DATABASE_URL explicitly.
dotenv.config({ quiet: true });

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
