import { execSync } from 'child_process';
import dotenv from 'dotenv';

/** Brings the test database up to date with the migrations before any suite runs. */
export default async function globalSetup() {
  const { parsed } = dotenv.config({ path: '.env.test', quiet: true });
  if (!parsed?.DATABASE_URL?.includes('test')) {
    throw new Error('Define DATABASE_URL en .env.test apuntando a una base de datos de pruebas (su nombre debe contener "test")');
  }
  execSync('npx prisma migrate deploy', {
    env: { ...process.env, DATABASE_URL: parsed.DATABASE_URL },
    stdio: 'ignore',
  });
}
