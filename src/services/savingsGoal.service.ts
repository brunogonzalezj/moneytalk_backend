import prisma from '../prisma/client';
import { SavingsGoalType, SavingsGoalStatus } from '@prisma/client';

interface CreateSavingsGoalPayload {
  name: string;
  description?: string;
  type: SavingsGoalType;
  targetAmount: number;
  targetDate?: Date;
  status?: SavingsGoalStatus;
}

interface UpdateSavingsGoalPayload {
  name?: string;
  description?: string;
  type?: SavingsGoalType;
  targetAmount?: number;
  currentAmount?: number;
  targetDate?: Date;
  status?: SavingsGoalStatus;
}

export class SavingsGoalService {
  static async getSavingsGoals(
    userId: number,
    filters?: { type?: SavingsGoalType; status?: SavingsGoalStatus }
  ): Promise<any[]> {
    const where: any = { userId };

    if (filters?.type) {
      where.type = filters.type;
    }
    if (filters?.status) {
      where.status = filters.status;
    }

    const savingsGoals = await prisma.savingsGoal.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
    });

    return savingsGoals.map((goal) => ({
      id: String(goal.id),
      name: goal.name,
      description: goal.description || '',
      type: goal.type,
      targetAmount: Number(goal.targetAmount),
      currentAmount: Number(goal.currentAmount),
      targetDate: goal.targetDate?.toISOString(),
      status: goal.status,
      createdAt: goal.createdAt.toISOString(),
      updatedAt: goal.updatedAt.toISOString(),
    }));
  }

  static async getSavingsGoalById(goalId: number, userId: number): Promise<any> {
    const goal = await prisma.savingsGoal.findFirst({
      where: {
        id: goalId,
        userId,
      },
    });

    if (!goal) {
      throw new Error('Savings goal not found');
    }

    return {
      id: String(goal.id),
      name: goal.name,
      description: goal.description || '',
      type: goal.type,
      targetAmount: Number(goal.targetAmount),
      currentAmount: Number(goal.currentAmount),
      targetDate: goal.targetDate?.toISOString(),
      status: goal.status,
      createdAt: goal.createdAt.toISOString(),
      updatedAt: goal.updatedAt.toISOString(),
    };
  }

  static async createSavingsGoal(
    data: CreateSavingsGoalPayload,
    userId: number
  ): Promise<any> {
    const { name, description, type, targetAmount, targetDate, status } = data;

    // Set default target date to 1 year from now if not provided
    const defaultTargetDate = new Date();
    defaultTargetDate.setFullYear(defaultTargetDate.getFullYear() + 1);

    const savingsGoal = await prisma.savingsGoal.create({
      data: {
        userId,
        name,
        description: description || '',
        type,
        targetAmount,
        targetDate: targetDate || defaultTargetDate,
        status: status || SavingsGoalStatus.ACTIVE,
      },
    });

    return {
      id: String(savingsGoal.id),
      name: savingsGoal.name,
      description: savingsGoal.description || '',
      type: savingsGoal.type,
      targetAmount: Number(savingsGoal.targetAmount),
      currentAmount: Number(savingsGoal.currentAmount),
      targetDate: savingsGoal.targetDate?.toISOString(),
      status: savingsGoal.status,
      createdAt: savingsGoal.createdAt.toISOString(),
      updatedAt: savingsGoal.updatedAt.toISOString(),
    };
  }

  static async updateSavingsGoal(
    goalId: number,
    data: UpdateSavingsGoalPayload,
    userId: number
  ): Promise<any> {
    const goal = await prisma.savingsGoal.findFirst({
      where: {
        id: goalId,
        userId,
      },
    });

    if (!goal) {
      throw new Error('Savings goal not found');
    }

    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.type !== undefined) updateData.type = data.type;
    if (data.targetAmount !== undefined) updateData.targetAmount = data.targetAmount;
    if (data.currentAmount !== undefined) updateData.currentAmount = data.currentAmount;
    if (data.targetDate !== undefined) updateData.targetDate = data.targetDate;
    if (data.status !== undefined) updateData.status = data.status;

    const updatedGoal = await prisma.savingsGoal.update({
      where: { id: goalId },
      data: updateData,
    });

    return {
      id: String(updatedGoal.id),
      name: updatedGoal.name,
      description: updatedGoal.description || '',
      type: updatedGoal.type,
      targetAmount: Number(updatedGoal.targetAmount),
      currentAmount: Number(updatedGoal.currentAmount),
      targetDate: updatedGoal.targetDate?.toISOString(),
      status: updatedGoal.status,
      createdAt: updatedGoal.createdAt.toISOString(),
      updatedAt: updatedGoal.updatedAt.toISOString(),
    };
  }

  static async deleteSavingsGoal(goalId: number, userId: number): Promise<void> {
    const goal = await prisma.savingsGoal.findFirst({
      where: {
        id: goalId,
        userId,
      },
    });

    if (!goal) {
      throw new Error('Savings goal not found');
    }

    await prisma.savingsGoal.delete({
      where: { id: goalId },
    });
  }

  static async addToSavingsGoal(
    goalId: number,
    amount: number,
    userId: number
  ): Promise<any> {
    return await prisma.$transaction(async (tx) => {
      const goal = await tx.savingsGoal.findFirst({
        where: {
          id: goalId,
          userId,
        },
      });

      if (!goal) {
        throw new Error('Savings goal not found');
      }

      if (goal.status !== SavingsGoalStatus.ACTIVE) {
        throw new Error('Cannot add money to inactive savings goal');
      }

      // Find or create savings category
      let savingsCategory = await tx.category.findFirst({
        where: {
          name: 'Ahorros',
          type: 'EXPENSE',
        },
      });

      if (!savingsCategory) {
        savingsCategory = await tx.category.create({
          data: {
            name: 'Ahorros',
            type: 'EXPENSE',
          },
        });
      }

      // Create a transaction for the savings contribution
      const transaction = await tx.transaction.create({
        data: {
          userId,
          categoryId: savingsCategory.id,
          amount: amount,
          description: `Aporte a meta de ahorro: ${goal.name}`,
          date: new Date(),
        },
      });

      // Update savings goal current amount
      const currentAmount = Number(goal.currentAmount);
      const newAmount = currentAmount + amount;

      // Check if goal is completed
      const targetAmount = Number(goal.targetAmount);
      const newStatus = newAmount >= targetAmount ? SavingsGoalStatus.COMPLETED : goal.status;

      const updatedGoal = await tx.savingsGoal.update({
        where: { id: goalId },
        data: {
          currentAmount: newAmount,
          status: newStatus,
        },
      });

      return {
        goal: {
          id: String(updatedGoal.id),
          name: updatedGoal.name,
          description: updatedGoal.description || '',
          type: updatedGoal.type,
          targetAmount: Number(updatedGoal.targetAmount),
          currentAmount: Number(updatedGoal.currentAmount),
          targetDate: updatedGoal.targetDate?.toISOString(),
          status: updatedGoal.status,
          createdAt: updatedGoal.createdAt.toISOString(),
          updatedAt: updatedGoal.updatedAt.toISOString(),
        },
        transaction: {
          id: transaction.id,
          amount: Number(transaction.amount),
          description: transaction.description,
          date: transaction.date.toISOString(),
        },
      };
    });
  }

  static async getTotalSavingsAllocations(userId: number): Promise<number> {
    const savingsGoals = await prisma.savingsGoal.findMany({
      where: {
        userId,
        status: SavingsGoalStatus.ACTIVE,
      },
    });

    return savingsGoals.reduce((total, goal) => {
      const targetAmount = Number(goal.targetAmount);
      const currentAmount = Number(goal.currentAmount);
      const remaining = targetAmount - currentAmount;

      // Calculate monthly allocation based on target date
      if (goal.targetDate && remaining > 0) {
        const now = new Date();
        const target = new Date(goal.targetDate);
        const monthsLeft = Math.max(1, Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30)));
        return total + (remaining / monthsLeft);
      }

      return total;
    }, 0);
  }
}