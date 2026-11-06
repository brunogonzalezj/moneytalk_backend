import request from 'supertest';
import { TransactionType } from '../src/generated/prisma/client';
import { createApp } from '../src/app';
import prisma from '../src/lib/prisma';

export const app = createApp();
export const api = () => request(app);

let counter = 0;

/** Empties every table. Runs before each test so tests never depend on each other. */
export const resetDatabase = async () => {
  await prisma.$transaction([
    prisma.transaction.deleteMany(),
    prisma.recurringPayment.deleteMany(),
    prisma.savingsGoal.deleteMany(),
    prisma.refreshToken.deleteMany(),
    prisma.category.deleteMany(),
    prisma.user.deleteMany(),
  ]);
};

export interface TestUser {
  id: number;
  email: string;
  password: string;
  accessToken: string;
  refreshToken: string;
  auth: { Authorization: string };
}

export const createUser = async (overrides: { email?: string; password?: string; name?: string } = {}): Promise<TestUser> => {
  counter++;
  const email = overrides.email ?? `user${counter}_${Date.now()}@test.com`;
  const password = overrides.password ?? 'Clave1234';
  const res = await api()
    .post('/api/auth/signup')
    .send({ name: overrides.name ?? `Usuario ${counter}`, email, password })
    .expect(201);
  return {
    id: res.body.user.id,
    email,
    password,
    accessToken: res.body.accessToken,
    refreshToken: res.body.refreshToken,
    auth: { Authorization: `Bearer ${res.body.accessToken}` },
  };
};

export const createCategory = (name: string, type: TransactionType) => prisma.category.create({ data: { name, type } });

export { prisma };
