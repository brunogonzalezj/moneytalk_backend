import { Prisma, RecurrenceFrequency } from '../generated/prisma/client';
import prisma from '../lib/prisma';
import { AppError } from '../utils/AppError';
import { calculateNextDate, isoDateToStoredDate, toLocalIsoDate } from '../utils/dates';
import { toMoney } from '../utils/decimal';
import { CategoryService } from './category.service';

export interface RecurringPaymentInput {
  categoryId: number;
  name: string;
  amount: number;
  description?: string;
  frequency: RecurrenceFrequency;
  startDate: string; // YYYY-MM-DD or ISO
  endDate?: string | null;
  isActive?: boolean;
}

// Safety cap for catching up on missed periods in a single run
const MAX_CATCH_UP_OCCURRENCES = 31;

const include = { category: { select: { id: true, name: true, type: true } } } as const;
type Row = Prisma.RecurringPaymentGetPayload<{ include: typeof include }>;

const toDto = (payment: Row) => ({
  id: payment.id,
  name: payment.name,
  amount: toMoney(payment.amount),
  description: payment.description,
  frequency: payment.frequency,
  startDate: payment.startDate.toISOString(),
  nextDate: payment.nextDate.toISOString(),
  endDate: payment.endDate?.toISOString() ?? null,
  isActive: payment.isActive,
  categoryId: payment.categoryId,
  category: payment.category,
  createdAt: payment.createdAt.toISOString(),
  updatedAt: payment.updatedAt.toISOString(),
});

const toStoredDate = (value: string) =>
  isoDateToStoredDate(/^\d{4}-\d{2}-\d{2}$/.test(value) ? value : toLocalIsoDate(new Date(value)));

// End of today in the app's timezone, as the latest instant a payment counts as due
const endOfToday = () => new Date(`${toLocalIsoDate(new Date())}T23:59:59.999Z`);
const startOfToday = () => isoDateToStoredDate(toLocalIsoDate(new Date()));

/** First occurrence on or after today, so a past start date or a pause never charges missed periods. */
const firstUpcoming = (from: Date, frequency: RecurrenceFrequency) => {
  const today = startOfToday();
  let next = new Date(from);
  while (next < today) next = calculateNextDate(next, frequency);
  return next;
};

export class RecurringPaymentService {
  private static async findOwned(userId: number, id: number) {
    const payment = await prisma.recurringPayment.findFirst({ where: { id, userId }, include });
    if (!payment) throw AppError.notFound('Pago recurrente no encontrado');
    return payment;
  }

  static async list(userId: number, filters: { isActive?: boolean; frequency?: RecurrenceFrequency } = {}) {
    const payments = await prisma.recurringPayment.findMany({
      where: {
        userId,
        ...(filters.isActive !== undefined && { isActive: filters.isActive }),
        ...(filters.frequency && { frequency: filters.frequency }),
      },
      include,
      orderBy: { createdAt: 'desc' },
    });
    return payments.map(toDto);
  }

  static async get(userId: number, id: number) {
    const payment = await this.findOwned(userId, id);
    const transactions = await prisma.transaction.findMany({
      where: { recurringPaymentId: id, userId },
      orderBy: { date: 'desc' },
      take: 24,
      select: { id: true, amount: true, description: true, date: true },
    });
    return {
      ...toDto(payment),
      transactions: transactions.map((t) => ({ ...t, amount: toMoney(t.amount), date: t.date.toISOString() })),
    };
  }

  static async create(userId: number, input: RecurringPaymentInput) {
    await CategoryService.assertAccessible(userId, input.categoryId);
    const startDate = toStoredDate(input.startDate);

    const payment = await prisma.recurringPayment.create({
      data: {
        userId,
        categoryId: input.categoryId,
        name: input.name,
        amount: new Prisma.Decimal(input.amount),
        description: input.description?.trim() || input.name,
        frequency: input.frequency,
        startDate,
        // The first charge happens on the start date itself
        nextDate: firstUpcoming(startDate, input.frequency),
        endDate: input.endDate ? toStoredDate(input.endDate) : null,
        isActive: input.isActive ?? true,
      },
      include,
    });
    return toDto(payment);
  }

  static async update(userId: number, id: number, changes: Partial<RecurringPaymentInput>) {
    const current = await this.findOwned(userId, id);
    if (changes.categoryId !== undefined) await CategoryService.assertAccessible(userId, changes.categoryId);

    const startDate = changes.startDate ? toStoredDate(changes.startDate) : current.startDate;
    const frequency = changes.frequency ?? current.frequency;
    const scheduleChanged = changes.startDate !== undefined || changes.frequency !== undefined;
    const resuming = changes.isActive === true && !current.isActive;

    const payment = await prisma.recurringPayment.update({
      where: { id },
      data: {
        ...(changes.name !== undefined && { name: changes.name }),
        ...(changes.amount !== undefined && { amount: new Prisma.Decimal(changes.amount) }),
        ...(changes.description !== undefined && { description: changes.description.trim() || current.name }),
        ...(changes.categoryId !== undefined && { categoryId: changes.categoryId }),
        ...(changes.endDate !== undefined && { endDate: changes.endDate ? toStoredDate(changes.endDate) : null }),
        ...(changes.isActive !== undefined && { isActive: changes.isActive }),
        frequency,
        startDate,
        ...(scheduleChanged && { nextDate: firstUpcoming(startDate, frequency) }),
        // Resuming a paused payment continues from today, without charging the paused periods
        ...(!scheduleChanged && resuming && { nextDate: firstUpcoming(current.nextDate, frequency) }),
      },
      include,
    });
    return toDto(payment);
  }

  /** Deletes the schedule. Transactions it already created stay, unlinked (FK is SET NULL). */
  static async remove(userId: number, id: number) {
    await this.findOwned(userId, id);
    await prisma.recurringPayment.delete({ where: { id } });
  }

  /** Records one occurrence now and moves the schedule forward, atomically. */
  static async executeNow(userId: number, id: number) {
    const payment = await this.findOwned(userId, id);
    if (!payment.isActive) throw AppError.badRequest('El pago recurrente está pausado');

    const [transaction] = await prisma.$transaction([
      prisma.transaction.create({
        data: {
          userId,
          categoryId: payment.categoryId,
          amount: payment.amount,
          description: payment.description || payment.name,
          date: startOfToday(),
          recurringPaymentId: payment.id,
        },
        include,
      }),
      prisma.recurringPayment.update({
        where: { id },
        data: { nextDate: calculateNextDate(payment.nextDate, payment.frequency) },
      }),
    ]);

    return {
      id: transaction.id,
      amount: toMoney(transaction.amount),
      description: transaction.description,
      date: transaction.date.toISOString(),
      category: transaction.category,
      recurringPaymentId: transaction.recurringPaymentId,
    };
  }

  /**
   * Creates the transactions for every due occurrence. Each occurrence is
   * written together with the schedule update, so a crash can't charge twice.
   */
  static async processAllRecurringPayments() {
    const due = await prisma.recurringPayment.findMany({
      where: { isActive: true, nextDate: { lte: endOfToday() } },
    });

    const results: { recurringPaymentId: number; created: number; success: boolean; error?: string }[] = [];

    for (const payment of due) {
      let nextDate = payment.nextDate;
      let created = 0;
      try {
        while (nextDate <= endOfToday() && created < MAX_CATCH_UP_OCCURRENCES) {
          if (payment.endDate && nextDate > payment.endDate) {
            await prisma.recurringPayment.update({ where: { id: payment.id }, data: { isActive: false } });
            break;
          }
          const following = calculateNextDate(nextDate, payment.frequency);
          await prisma.$transaction([
            prisma.transaction.create({
              data: {
                userId: payment.userId,
                categoryId: payment.categoryId,
                amount: payment.amount,
                description: payment.description || payment.name,
                date: nextDate,
                recurringPaymentId: payment.id,
              },
            }),
            prisma.recurringPayment.update({ where: { id: payment.id }, data: { nextDate: following } }),
          ]);
          nextDate = following;
          created++;
        }
        results.push({ recurringPaymentId: payment.id, created, success: true });
      } catch (error) {
        results.push({
          recurringPaymentId: payment.id,
          created,
          success: false,
          error: error instanceof Error ? error.message : 'Error desconocido',
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
