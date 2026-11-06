import { Prisma, SavingsGoal, SavingsGoalStatus, SavingsGoalType } from '@prisma/client';
import prisma from '../lib/prisma';
import { AppError } from '../utils/AppError';
import { isoDateToStoredDate } from '../utils/dates';
import { toMoney } from '../utils/decimal';
import { CategoryService } from './category.service';

export interface SavingsGoalInput {
  name: string;
  description?: string;
  type: SavingsGoalType;
  targetAmount: number;
  targetDate?: string; // YYYY-MM-DD or ISO
  status?: SavingsGoalStatus;
}

// Name of the expense category savings contributions are recorded under
export const SAVINGS_CATEGORY_NAME = 'Ahorros';

const toDto = (goal: SavingsGoal) => ({
  id: String(goal.id),
  name: goal.name,
  description: goal.description ?? '',
  type: goal.type,
  targetAmount: toMoney(goal.targetAmount),
  currentAmount: toMoney(goal.currentAmount),
  targetDate: goal.targetDate?.toISOString(),
  status: goal.status,
  createdAt: goal.createdAt.toISOString(),
  updatedAt: goal.updatedAt.toISOString(),
});

const toDate = (value: string) => (/^\d{4}-\d{2}-\d{2}$/.test(value) ? isoDateToStoredDate(value) : new Date(value));

const oneYearFromNow = () => {
  const date = new Date();
  date.setFullYear(date.getFullYear() + 1);
  return date;
};

export class SavingsGoalService {
  private static async findOwned(userId: number, id: number, client: Prisma.TransactionClient = prisma) {
    const goal = await client.savingsGoal.findFirst({ where: { id, userId } });
    if (!goal) throw AppError.notFound('Meta de ahorro no encontrada');
    return goal;
  }

  static async list(userId: number, filters: { type?: SavingsGoalType; status?: SavingsGoalStatus } = {}) {
    const goals = await prisma.savingsGoal.findMany({
      where: { userId, ...(filters.type && { type: filters.type }), ...(filters.status && { status: filters.status }) },
      orderBy: { createdAt: 'desc' },
    });
    return goals.map(toDto);
  }

  static async get(userId: number, id: number) {
    return toDto(await this.findOwned(userId, id));
  }

  static async create(userId: number, input: SavingsGoalInput) {
    const goal = await prisma.savingsGoal.create({
      data: {
        userId,
        name: input.name,
        description: input.description ?? '',
        type: input.type,
        targetAmount: new Prisma.Decimal(input.targetAmount),
        targetDate: input.targetDate ? toDate(input.targetDate) : oneYearFromNow(),
        status: input.status ?? SavingsGoalStatus.ACTIVE,
      },
    });
    return toDto(goal);
  }

  // currentAmount only changes through contributions, so it is not editable here
  static async update(userId: number, id: number, changes: Partial<SavingsGoalInput>) {
    await this.findOwned(userId, id);
    const goal = await prisma.savingsGoal.update({
      where: { id },
      data: {
        ...(changes.name !== undefined && { name: changes.name }),
        ...(changes.description !== undefined && { description: changes.description }),
        ...(changes.type !== undefined && { type: changes.type }),
        ...(changes.targetAmount !== undefined && { targetAmount: new Prisma.Decimal(changes.targetAmount) }),
        ...(changes.targetDate !== undefined && { targetDate: toDate(changes.targetDate) }),
        ...(changes.status !== undefined && { status: changes.status }),
      },
    });
    return toDto(goal);
  }

  static async remove(userId: number, id: number) {
    await this.findOwned(userId, id);
    await prisma.savingsGoal.delete({ where: { id } });
  }

  /**
   * Adds money to an active goal and records it as an expense in the
   * "Ahorros" category, both in one database transaction.
   */
  static async contribute(userId: number, id: number, amount: number) {
    const category = await CategoryService.ensureGlobal(SAVINGS_CATEGORY_NAME, 'EXPENSE');

    return prisma.$transaction(async (tx) => {
      const goal = await this.findOwned(userId, id, tx);
      if (goal.status !== SavingsGoalStatus.ACTIVE) {
        throw AppError.badRequest('Solo se puede aportar a metas activas');
      }

      const transaction = await tx.transaction.create({
        data: {
          userId,
          categoryId: category.id,
          amount: new Prisma.Decimal(amount),
          description: `Aporte a meta de ahorro: ${goal.name}`,
          date: new Date(),
        },
      });

      const newAmount = goal.currentAmount.plus(amount);
      const updated = await tx.savingsGoal.update({
        where: { id },
        data: {
          currentAmount: newAmount,
          status: newAmount.gte(goal.targetAmount) ? SavingsGoalStatus.COMPLETED : goal.status,
        },
      });

      return {
        goal: toDto(updated),
        transaction: {
          id: transaction.id,
          amount: toMoney(transaction.amount),
          description: transaction.description,
          date: transaction.date.toISOString(),
        },
      };
    });
  }
}
