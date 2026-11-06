import { Prisma } from '../generated/prisma/client';

type DecimalLike = Prisma.Decimal | number | string | null | undefined;

/** Converts a Prisma Decimal (or anything numeric) to a JS number rounded to cents. */
export const toMoney = (value: DecimalLike): number => {
  if (value === null || value === undefined) return 0;
  const number = value instanceof Prisma.Decimal ? value.toNumber() : Number(value);
  return Number.isFinite(number) ? Math.round(number * 100) / 100 : 0;
};

export const roundMoney = (value: number): number => Math.round(value * 100) / 100;
