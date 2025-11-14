import { BudgetPeriod } from '@prisma/client';
import prisma from '../prisma/client';
import { checkDateOverlap } from '../utils/dateCalculations';

interface CreateBudgetPayload {
  categoryId: number;
  amount: number;
  period: BudgetPeriod;
  startDate: Date;
  endDate: Date;
}

interface UpdateBudgetPayload {
  amount?: number;
  startDate?: Date;
  endDate?: Date;
}

interface BudgetWithCalculations {
  id: number;
  amount: number;
  period: BudgetPeriod;
  startDate: Date;
  endDate: Date;
  category: {
    id: number;
    name: string;
    type: string;
  };
  spent: number;
  remaining: number;
  percentage: number;
}

export class BudgetService {
  static async getBudgets(
    userId: number,
    filters?: { period?: BudgetPeriod; categoryId?: number }
  ): Promise<BudgetWithCalculations[]> {
    const where: any = { userId };

    if (filters?.period) {
      where.period = filters.period;
    }
    if (filters?.categoryId) {
      where.categoryId = filters.categoryId;
    }

    const budgets = await prisma.budget.findMany({
      where,
      include: {
        category: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const budgetsWithCalculations = await Promise.all(
      budgets.map(async (budget) => {
        const spent = await this.calculateSpent(
          userId,
          budget.categoryId,
          budget.startDate,
          budget.endDate
        );

        const amountFloat = parseFloat(budget.amount.toString());
        const remaining = amountFloat - spent;
        const percentage = amountFloat > 0 ? (spent / amountFloat) * 100 : 0;

        return {
          id: budget.id,
          amount: amountFloat,
          period: budget.period,
          startDate: budget.startDate,
          endDate: budget.endDate,
          category: {
            id: budget.category.id,
            name: budget.category.name,
            type: budget.category.type,
          },
          spent,
          remaining,
          percentage: Math.round(percentage * 10) / 10,
        };
      })
    );

    return budgetsWithCalculations;
  }

  static async getBudgetById(budgetId: number, userId: number): Promise<any> {
    const budget = await prisma.budget.findFirst({
      where: {
        id: budgetId,
        userId,
      },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
      },
    });

    if (!budget) {
      throw new Error('Budget not found');
    }

    const transactions = await prisma.transaction.findMany({
      where: {
        userId,
        categoryId: budget.categoryId,
        date: {
          gte: budget.startDate,
          lte: budget.endDate,
        },
      },
      orderBy: {
        date: 'desc',
      },
      select: {
        id: true,
        amount: true,
        description: true,
        date: true,
      },
    });

    const spent = transactions.reduce(
      (sum, t) => sum + parseFloat(t.amount.toString()),
      0
    );

    const amountFloat = parseFloat(budget.amount.toString());
    const remaining = amountFloat - spent;
    const percentage = amountFloat > 0 ? (spent / amountFloat) * 100 : 0;

    return {
      id: budget.id,
      amount: amountFloat,
      period: budget.period,
      startDate: budget.startDate,
      endDate: budget.endDate,
      category: budget.category,
      spent,
      remaining,
      percentage: Math.round(percentage * 10) / 10,
      transactions: transactions.map((t) => ({
        id: t.id,
        amount: parseFloat(t.amount.toString()),
        description: t.description,
        date: t.date,
      })),
    };
  }

  static async createBudget(
    data: CreateBudgetPayload,
    userId: number
  ): Promise<any> {
    const { categoryId, amount, period, startDate, endDate } = data;

    const category = await prisma.category.findUnique({
      where: { id: categoryId },
    });

    if (!category) {
      throw new Error('Category not found');
    }

    const existingBudgets = await prisma.budget.findMany({
      where: {
        userId,
        categoryId,
      },
    });

    for (const existing of existingBudgets) {
      if (checkDateOverlap(startDate, endDate, existing.startDate, existing.endDate)) {
        throw new Error(
          'Ya existe un presupuesto para esta categoría en el período especificado'
        );
      }
    }

    const budget = await prisma.budget.create({
      data: {
        userId,
        categoryId,
        amount,
        period,
        startDate,
        endDate,
      },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
      },
    });

    return budget;
  }

  static async updateBudget(
    budgetId: number,
    data: UpdateBudgetPayload,
    userId: number
  ): Promise<any> {
    const budget = await prisma.budget.findFirst({
      where: {
        id: budgetId,
        userId,
      },
    });

    if (!budget) {
      throw new Error('Budget not found');
    }

    const updateData: any = {};
    if (data.amount !== undefined) updateData.amount = data.amount;
    if (data.startDate !== undefined) updateData.startDate = data.startDate;
    if (data.endDate !== undefined) updateData.endDate = data.endDate;

    if (data.startDate || data.endDate) {
      const newStartDate = data.startDate || budget.startDate;
      const newEndDate = data.endDate || budget.endDate;

      if (newEndDate <= newStartDate) {
        throw new Error('endDate debe ser posterior a startDate');
      }

      const existingBudgets = await prisma.budget.findMany({
        where: {
          userId,
          categoryId: budget.categoryId,
          id: { not: budgetId },
        },
      });

      for (const existing of existingBudgets) {
        if (checkDateOverlap(newStartDate, newEndDate, existing.startDate, existing.endDate)) {
          throw new Error(
            'El período se solapa con otro presupuesto existente para esta categoría'
          );
        }
      }
    }

    const updatedBudget = await prisma.budget.update({
      where: { id: budgetId },
      data: updateData,
      include: {
        category: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
      },
    });

    return updatedBudget;
  }

  static async deleteBudget(budgetId: number, userId: number): Promise<void> {
    const budget = await prisma.budget.findFirst({
      where: {
        id: budgetId,
        userId,
      },
    });

    if (!budget) {
      throw new Error('Budget not found');
    }

    await prisma.budget.delete({
      where: { id: budgetId },
    });
  }

  private static async calculateSpent(
    userId: number,
    categoryId: number,
    startDate: Date,
    endDate: Date
  ): Promise<number> {
    const transactions = await prisma.transaction.findMany({
      where: {
        userId,
        categoryId,
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    return transactions.reduce(
      (sum, transaction) => sum + parseFloat(transaction.amount.toString()),
      0
    );
  }
}
