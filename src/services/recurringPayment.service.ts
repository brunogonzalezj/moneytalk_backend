import { RecurrenceFrequency } from '@prisma/client';
import prisma from '../prisma/client';
import { calculateNextDate } from '../utils/dateCalculations';

interface CreateRecurringPaymentPayload {
  categoryId: number;
  name: string;
  amount: number;
  description: string;
  frequency: RecurrenceFrequency;
  startDate: Date;
  endDate?: Date;
}

interface UpdateRecurringPaymentPayload {
  name?: string;
  amount?: number;
  description?: string;
  frequency?: RecurrenceFrequency;
  nextDate?: Date;
  endDate?: Date;
  isActive?: boolean;
}

export class RecurringPaymentService {
  static async getRecurringPayments(
    userId: number,
    filters?: { isActive?: boolean; frequency?: RecurrenceFrequency }
  ): Promise<any[]> {
    const where: any = { userId };

    if (filters?.isActive !== undefined) {
      where.isActive = filters.isActive;
    }
    if (filters?.frequency) {
      where.frequency = filters.frequency;
    }

    const recurringPayments = await prisma.recurringPayment.findMany({
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

    return recurringPayments.map((rp) => ({
      id: rp.id,
      name: rp.name,
      amount: parseFloat(rp.amount.toString()),
      description: rp.description,
      frequency: rp.frequency,
      startDate: rp.startDate,
      nextDate: rp.nextDate,
      endDate: rp.endDate,
      isActive: rp.isActive,
      category: rp.category,
    }));
  }

  static async getRecurringPaymentById(
    recurringPaymentId: number,
    userId: number
  ): Promise<any> {
    const recurringPayment = await prisma.recurringPayment.findFirst({
      where: {
        id: recurringPaymentId,
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
        transactions: {
          orderBy: {
            date: 'desc',
          },
          select: {
            id: true,
            amount: true,
            description: true,
            date: true,
          },
        },
      },
    });

    if (!recurringPayment) {
      throw new Error('Recurring payment not found');
    }

    return {
      id: recurringPayment.id,
      name: recurringPayment.name,
      amount: parseFloat(recurringPayment.amount.toString()),
      description: recurringPayment.description,
      frequency: recurringPayment.frequency,
      startDate: recurringPayment.startDate,
      nextDate: recurringPayment.nextDate,
      endDate: recurringPayment.endDate,
      isActive: recurringPayment.isActive,
      category: recurringPayment.category,
      transactions: recurringPayment.transactions.map((t) => ({
        id: t.id,
        amount: parseFloat(t.amount.toString()),
        description: t.description,
        date: t.date,
      })),
    };
  }

  static async createRecurringPayment(
    data: CreateRecurringPaymentPayload,
    userId: number
  ): Promise<any> {
    const { categoryId, name, amount, description, frequency, startDate, endDate } = data;

    const category = await prisma.category.findUnique({
      where: { id: categoryId },
    });

    if (!category) {
      throw new Error('Category not found');
    }

    const nextDate = calculateNextDate(startDate, frequency);

    const recurringPayment = await prisma.recurringPayment.create({
      data: {
        userId,
        categoryId,
        name,
        amount,
        description,
        frequency,
        startDate,
        nextDate,
        endDate: endDate || null,
        isActive: true,
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

    return {
      id: recurringPayment.id,
      name: recurringPayment.name,
      amount: parseFloat(recurringPayment.amount.toString()),
      description: recurringPayment.description,
      frequency: recurringPayment.frequency,
      startDate: recurringPayment.startDate,
      nextDate: recurringPayment.nextDate,
      endDate: recurringPayment.endDate,
      isActive: recurringPayment.isActive,
      category: recurringPayment.category,
    };
  }

  static async updateRecurringPayment(
    recurringPaymentId: number,
    data: UpdateRecurringPaymentPayload,
    userId: number
  ): Promise<any> {
    const recurringPayment = await prisma.recurringPayment.findFirst({
      where: {
        id: recurringPaymentId,
        userId,
      },
    });

    if (!recurringPayment) {
      throw new Error('Recurring payment not found');
    }

    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.amount !== undefined) updateData.amount = data.amount;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.frequency !== undefined) updateData.frequency = data.frequency;
    if (data.nextDate !== undefined) updateData.nextDate = data.nextDate;
    if (data.endDate !== undefined) updateData.endDate = data.endDate;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    const updatedRecurringPayment = await prisma.recurringPayment.update({
      where: { id: recurringPaymentId },
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

    return {
      id: updatedRecurringPayment.id,
      name: updatedRecurringPayment.name,
      amount: parseFloat(updatedRecurringPayment.amount.toString()),
      description: updatedRecurringPayment.description,
      frequency: updatedRecurringPayment.frequency,
      startDate: updatedRecurringPayment.startDate,
      nextDate: updatedRecurringPayment.nextDate,
      endDate: updatedRecurringPayment.endDate,
      isActive: updatedRecurringPayment.isActive,
      category: updatedRecurringPayment.category,
    };
  }

  static async deleteRecurringPayment(
    recurringPaymentId: number,
    userId: number
  ): Promise<void> {
    const recurringPayment = await prisma.recurringPayment.findFirst({
      where: {
        id: recurringPaymentId,
        userId,
      },
    });

    if (!recurringPayment) {
      throw new Error('Recurring payment not found');
    }

    await prisma.recurringPayment.update({
      where: { id: recurringPaymentId },
      data: { isActive: false },
    });
  }

  static async executeRecurringPayment(
    recurringPaymentId: number,
    userId: number
  ): Promise<any> {
    const recurringPayment = await prisma.recurringPayment.findFirst({
      where: {
        id: recurringPaymentId,
        userId,
      },
    });

    if (!recurringPayment) {
      throw new Error('Recurring payment not found');
    }

    if (!recurringPayment.isActive) {
      throw new Error('Recurring payment is not active');
    }

    const transaction = await prisma.transaction.create({
      data: {
        userId,
        categoryId: recurringPayment.categoryId,
        amount: recurringPayment.amount,
        description: `${recurringPayment.name}: ${recurringPayment.description}`,
        date: new Date(),
        recurringPaymentId: recurringPayment.id,
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

    const newNextDate = calculateNextDate(
      recurringPayment.nextDate,
      recurringPayment.frequency
    );

    await prisma.recurringPayment.update({
      where: { id: recurringPaymentId },
      data: { nextDate: newNextDate },
    });

    return {
      id: transaction.id,
      amount: parseFloat(transaction.amount.toString()),
      description: transaction.description,
      date: transaction.date,
      category: transaction.category,
      recurringPaymentId: transaction.recurringPaymentId,
    };
  }

  static async processAllRecurringPayments(): Promise<any> {
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    const duePayments = await prisma.recurringPayment.findMany({
      where: {
        isActive: true,
        nextDate: {
          lte: today,
        },
      },
      include: {
        category: true,
      },
    });

    const results = [];

    for (const payment of duePayments) {
      if (payment.endDate && payment.nextDate > payment.endDate) {
        await prisma.recurringPayment.update({
          where: { id: payment.id },
          data: { isActive: false },
        });
        continue;
      }

      try {
        const transaction = await prisma.transaction.create({
          data: {
            userId: payment.userId,
            categoryId: payment.categoryId,
            amount: payment.amount,
            description: `${payment.name}: ${payment.description}`,
            date: payment.nextDate,
            recurringPaymentId: payment.id,
          },
        });

        const newNextDate = calculateNextDate(payment.nextDate, payment.frequency);

        await prisma.recurringPayment.update({
          where: { id: payment.id },
          data: { nextDate: newNextDate },
        });

        results.push({
          recurringPaymentId: payment.id,
          transactionId: transaction.id,
          amount: parseFloat(transaction.amount.toString()),
          description: transaction.description,
          date: transaction.date,
          success: true,
        });
      } catch (error) {
        results.push({
          recurringPaymentId: payment.id,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return {
      processed: results.length,
      successful: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
      results,
    };
  }
}
