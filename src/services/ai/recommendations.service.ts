import { TransactionType } from '@prisma/client';
import prisma from '../../lib/prisma';
import {
  buildRecommendationsUserPrompt,
  FinancialSnapshot,
  PeriodTotals,
  RECOMMENDATIONS_SYSTEM_PROMPT,
  recommendationsResponseSchema,
} from '../../prompts/recommendations.prompt';
import { addDaysToIsoDate, isoDateRangeToBounds, toLocalIsoDate } from '../../utils/dates';
import { roundMoney, toMoney } from '../../utils/decimal';
import { chatJson } from './chatJson';

export interface Recommendation {
  id: number;
  title: string;
  description: string;
  type: 'warning' | 'success' | 'info';
}

export interface RecommendationsPayload {
  recommendations: Recommendation[];
  generatedAt: string;
  cached?: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const CACHE_TTL_MS = DAY_MS;
const MIN_REFRESH_INTERVAL_MS = 10 * 60 * 1000;
const MAX_CACHE_ENTRIES = 500;

// Per-process cache; Map keeps insertion order, so the first key is the oldest
const cache = new Map<number, { payload: RecommendationsPayload; createdAt: number }>();

const remember = (userId: number, payload: RecommendationsPayload) => {
  cache.delete(userId);
  cache.set(userId, { payload, createdAt: Date.now() });
  if (cache.size > MAX_CACHE_ENTRIES) cache.delete(cache.keys().next().value as number);
};

const MONTHLY_FACTOR: Record<string, number> = { DAILY: 30, WEEKLY: 52 / 12, MONTHLY: 1, YEARLY: 1 / 12 };

type CategoryInfo = { name: string; type: TransactionType };

const totalsFor = (
  rows: { categoryId: number; _sum: { amount: unknown }; _count: { _all: number } }[],
  categories: Map<number, CategoryInfo>
): PeriodTotals => {
  let income = 0;
  let expense = 0;
  let count = 0;
  for (const row of rows) {
    const amount = toMoney(row._sum.amount as never);
    if (categories.get(row.categoryId)?.type === 'INCOME') income += amount;
    else expense += amount;
    count += row._count._all;
  }
  return { income: roundMoney(income), expense: roundMoney(expense), balance: roundMoney(income - expense), count };
};

export class RecommendationsService {
  /** Aggregates the user's figures in the database instead of loading every row. */
  static async getSnapshot(userId: number, now = new Date()): Promise<FinancialSnapshot> {
    // Whole calendar days in the app's timezone, today included
    const today = toLocalIsoDate(now);
    const lastDays = (days: number) => isoDateRangeToBounds(addDaysToIsoDate(today, -(days - 1)), today);
    const groupSince = (days: number) =>
      prisma.transaction.groupBy({
        by: ['categoryId'],
        where: { userId, date: lastDays(days) },
        _sum: { amount: true },
        _count: { _all: true },
      });

    const [rows7, rows30, rows180, oldest, categories, goals, recurring] = await Promise.all([
      groupSince(7),
      groupSince(30),
      groupSince(180),
      prisma.transaction.aggregate({ where: { userId, date: lastDays(180) }, _min: { date: true } }),
      prisma.category.findMany({ select: { id: true, name: true, type: true } }),
      prisma.savingsGoal.findMany({
        where: { userId, status: 'ACTIVE' },
        select: { name: true, currentAmount: true, targetAmount: true },
      }),
      prisma.recurringPayment.findMany({ where: { userId, isActive: true }, select: { amount: true, frequency: true } }),
    ]);

    const categoryById = new Map(categories.map((c) => [c.id, { name: c.name, type: c.type }]));
    const last30 = totalsFor(rows30, categoryById);

    const largest = await prisma.transaction.findMany({
      where: { userId, date: lastDays(30), category: { type: 'EXPENSE' } },
      orderBy: { amount: 'desc' },
      take: 3,
      select: { description: true, amount: true, date: true, category: { select: { name: true } } },
    });

    const byCategory = (rows: typeof rows30, type: TransactionType) =>
      rows
        .filter((row) => categoryById.get(row.categoryId)?.type === type)
        .map((row) => ({ name: categoryById.get(row.categoryId)!.name, total: toMoney(row._sum.amount) }))
        .sort((a, b) => b.total - a.total);

    const oldestDate = oldest._min.date;
    const monthsWithData = oldestDate
      ? Math.min(6, Math.max(1, Math.ceil((now.getTime() - oldestDate.getTime()) / (30 * DAY_MS))))
      : 0;

    return {
      last7: totalsFor(rows7, categoryById),
      last30,
      last180: totalsFor(rows180, categoryById),
      monthsWithData,
      expenseByCategory30: byCategory(rows30, 'EXPENSE')
        .slice(0, 8)
        .map((c) => ({ ...c, share: last30.expense > 0 ? (c.total / last30.expense) * 100 : 0 })),
      incomeByCategory180: byCategory(rows180, 'INCOME').slice(0, 5),
      largestExpenses30: largest.map((t) => ({
        description: t.description,
        amount: toMoney(t.amount),
        category: t.category.name,
        date: t.date.toISOString().slice(0, 10),
      })),
      savingsGoals: goals.map((g) => {
        const target = toMoney(g.targetAmount);
        const current = toMoney(g.currentAmount);
        return { name: g.name, current, target, progress: target > 0 ? Math.round((current / target) * 100) : 0 };
      }),
      monthlyRecurringCommitments: roundMoney(
        recurring.reduce((sum, p) => sum + toMoney(p.amount) * (MONTHLY_FACTOR[p.frequency] ?? 1), 0)
      ),
    };
  }

  static async getRecommendations(userId: number, forceRefresh = false): Promise<RecommendationsPayload> {
    const cached = cache.get(userId);
    const age = cached ? Date.now() - cached.createdAt : Infinity;
    // A forced refresh is honoured at most every few minutes to keep OpenAI costs bounded
    if (cached && (age < (forceRefresh ? MIN_REFRESH_INTERVAL_MS : CACHE_TTL_MS))) {
      return { ...cached.payload, cached: true };
    }

    const snapshot = await this.getSnapshot(userId);

    if (snapshot.last180.count === 0) {
      return {
        recommendations: [
          {
            id: 1,
            title: 'Registra tus primeras transacciones',
            description:
              'Todavía no hay movimientos para analizar. Registra tus ingresos y gastos de esta semana (por voz o texto) y vuelve para recibir recomendaciones basadas en tus datos.',
            type: 'info',
          },
        ],
        generatedAt: new Date().toISOString(),
      };
    }

    const answer = await chatJson({
      system: RECOMMENDATIONS_SYSTEM_PROMPT,
      user: buildRecommendationsUserPrompt(snapshot),
      schema: recommendationsResponseSchema,
      temperature: 0.5,
      maxTokens: 900,
    });

    const payload: RecommendationsPayload = {
      recommendations: answer.recommendations.slice(0, 3).map((rec, index) => ({ id: index + 1, ...rec })),
      generatedAt: new Date().toISOString(),
    };
    remember(userId, payload);
    return payload;
  }

  /** Drops the cached recommendations, e.g. after the user's data is deleted. */
  static forget(userId: number) {
    cache.delete(userId);
  }
}
