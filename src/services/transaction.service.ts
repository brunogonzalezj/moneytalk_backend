import { Prisma, TransactionType } from '../generated/prisma/client';
import { stringify } from 'csv-stringify/sync';
import { Workbook } from 'exceljs';
import prisma from '../lib/prisma';
import { ExportFormat, TransactionListItem, TransactionsListResponse } from '../types';
import { AppError } from '../utils/AppError';
import { addDaysToIsoDate, isoDateRangeToBounds, isoDateToStoredDate, toLocalIsoDate } from '../utils/dates';
import { roundMoney, toMoney } from '../utils/decimal';
import { CategoryService } from './category.service';

export type GroupBy = 'day' | 'week' | 'month';

export interface TransactionFilters {
  type?: TransactionType;
  categoryId?: number;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}

export interface TransactionInput {
  amount: number;
  description: string;
  date: string; // YYYY-MM-DD or a full ISO timestamp
  categoryId: number;
  type?: TransactionType;
}

const listSelect = {
  id: true,
  description: true,
  amount: true,
  date: true,
  createdAt: true,
  category: { select: { id: true, name: true, type: true } },
} as const;

type ListRow = Prisma.TransactionGetPayload<{ select: typeof listSelect }>;

const toListItem = (t: ListRow): TransactionListItem => ({
  id: String(t.id),
  description: t.description,
  amount: toMoney(t.amount),
  category: t.category.name,
  categoryId: t.category.id,
  type: t.category.type,
  date: t.date.toISOString().slice(0, 10),
  createdAt: t.createdAt.toISOString(),
});

/**
 * Transactions are calendar dates. A full timestamp from the client is read as
 * the local calendar day it represents, then stored at 12:00 UTC.
 */
const toStoredDate = (value: string): Date => {
  const isoDate = /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : toLocalIsoDate(new Date(value));
  return isoDateToStoredDate(isoDate);
};

const buildWhere = (userId: number, filters: TransactionFilters): Prisma.TransactionWhereInput => ({
  userId,
  ...(filters.categoryId && { categoryId: filters.categoryId }),
  ...(filters.type && { category: { type: filters.type } }),
  ...((filters.dateFrom || filters.dateTo) && { date: isoDateRangeToBounds(filters.dateFrom, filters.dateTo) }),
  ...(filters.search?.trim() && { description: { contains: filters.search.trim() } }),
});

/** First day (YYYY-MM-DD) of the bucket that contains `isoDate`. Weeks start on Monday. */
const bucketOf = (isoDate: string, groupBy: GroupBy): string => {
  if (groupBy === 'day') return isoDate;
  if (groupBy === 'month') return `${isoDate.slice(0, 7)}-01`;
  const weekday = new Date(`${isoDate}T00:00:00Z`).getUTCDay(); // 0 = domingo
  return addDaysToIsoDate(isoDate, -((weekday + 6) % 7));
};

const nextBucket = (bucket: string, groupBy: GroupBy): string => {
  if (groupBy === 'day') return addDaysToIsoDate(bucket, 1);
  if (groupBy === 'week') return addDaysToIsoDate(bucket, 7);
  const [year, month] = bucket.split('-').map(Number);
  return month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, '0')}-01`;
};

export class TransactionService {
  static async list(
    userId: number,
    filters: TransactionFilters,
    page: number,
    limit: number
  ): Promise<TransactionsListResponse> {
    const where = buildWhere(userId, filters);
    const [totalItems, rows] = await Promise.all([
      prisma.transaction.count({ where }),
      prisma.transaction.findMany({
        where,
        select: listSelect,
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    const totalPages = Math.max(1, Math.ceil(totalItems / limit));
    return {
      transactions: rows.map(toListItem),
      pagination: {
        currentPage: page,
        totalPages,
        totalItems,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }

  static async create(userId: number, input: TransactionInput): Promise<TransactionListItem> {
    const category = await CategoryService.assertAccessible(userId, input.categoryId);
    if (input.type && input.type !== category.type) {
      throw AppError.badRequest('El tipo de la transacción no coincide con el de la categoría');
    }

    const created = await prisma.transaction.create({
      data: {
        userId,
        categoryId: category.id,
        amount: roundMoney(input.amount),
        description: input.description.trim(),
        date: toStoredDate(input.date),
      },
      select: listSelect,
    });
    return toListItem(created);
  }

  /** Only amount, description, date and category can change; ownership is checked first. */
  static async update(userId: number, id: number, changes: Partial<TransactionInput>): Promise<TransactionListItem> {
    const existing = await prisma.transaction.findFirst({ where: { id, userId }, select: { id: true } });
    if (!existing) throw AppError.notFound('Transacción no encontrada');

    if (changes.categoryId !== undefined) await CategoryService.assertAccessible(userId, changes.categoryId);

    const updated = await prisma.transaction.update({
      where: { id },
      data: {
        ...(changes.amount !== undefined && { amount: roundMoney(changes.amount) }),
        ...(changes.description !== undefined && { description: changes.description.trim() }),
        ...(changes.date !== undefined && { date: toStoredDate(changes.date) }),
        ...(changes.categoryId !== undefined && { categoryId: changes.categoryId }),
      },
      select: listSelect,
    });
    return toListItem(updated);
  }

  static async remove(userId: number, id: number): Promise<void> {
    const { count } = await prisma.transaction.deleteMany({ where: { id, userId } });
    if (count === 0) throw AppError.notFound('Transacción no encontrada');
  }

  /**
   * Totals, per-category breakdown and a time series for a date range, computed
   * in the database so clients never download every transaction.
   */
  static async summary(userId: number, from: string | undefined, to: string, groupBy: GroupBy) {
    const where: Prisma.TransactionWhereInput = { userId, date: isoDateRangeToBounds(from, to) };

    const [grouped, rows] = await Promise.all([
      prisma.transaction.groupBy({ by: ['categoryId'], where, _sum: { amount: true }, _count: { _all: true } }),
      from
        ? prisma.transaction.findMany({ where, select: { date: true, amount: true, category: { select: { type: true } } } })
        : Promise.resolve([]),
    ]);

    const categories = await prisma.category.findMany({
      where: { id: { in: grouped.map((g) => g.categoryId) } },
      select: { id: true, name: true, type: true },
    });
    const categoryById = new Map(categories.map((c) => [c.id, c]));

    let income = 0;
    let expense = 0;
    let count = 0;
    const byCategory = grouped.map((g) => {
      const category = categoryById.get(g.categoryId)!;
      const total = toMoney(g._sum.amount);
      if (category.type === 'INCOME') income += total;
      else expense += total;
      count += g._count._all;
      return { categoryId: category.id, name: category.name, type: category.type, total, count: g._count._all };
    });

    const series = new Map<string, { income: number; expense: number }>();
    for (let bucket = from && bucketOf(from, groupBy); bucket && bucket <= to; bucket = nextBucket(bucket, groupBy)) {
      series.set(bucket, { income: 0, expense: 0 });
    }
    for (const row of rows) {
      const bucket = series.get(bucketOf(row.date.toISOString().slice(0, 10), groupBy));
      if (!bucket) continue;
      if (row.category.type === 'INCOME') bucket.income += toMoney(row.amount);
      else bucket.expense += toMoney(row.amount);
    }

    return {
      range: { from: from ?? null, to, groupBy },
      totals: { income: roundMoney(income), expense: roundMoney(expense), balance: roundMoney(income - expense), count },
      byCategory: byCategory
        .map((c) => {
          const typeTotal = c.type === 'INCOME' ? income : expense;
          return { ...c, percentage: typeTotal > 0 ? Math.round((c.total / typeTotal) * 1000) / 10 : 0 };
        })
        .sort((a, b) => b.total - a.total),
      series: [...series.entries()].map(([period, values]) => ({
        period,
        income: roundMoney(values.income),
        expense: roundMoney(values.expense),
      })),
    };
  }

  static async export(userId: number, filters: TransactionFilters, format: ExportFormat) {
    const rows = await prisma.transaction.findMany({
      where: buildWhere(userId, filters),
      select: listSelect,
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    });

    const records = rows.map((t) => ({
      Fecha: t.date.toISOString().slice(0, 10),
      Descripcion: asSpreadsheetText(t.description),
      Categoria: asSpreadsheetText(t.category.name),
      Tipo: t.category.type === 'INCOME' ? 'Ingreso' : 'Gasto',
      Monto: toMoney(t.amount).toFixed(2),
    }));

    if (format === 'CSV') {
      // BOM so Excel opens accented characters correctly
      const csv = '﻿' + stringify(records, { header: true, delimiter: ',' });
      return {
        buffer: Buffer.from(csv, 'utf-8'),
        filename: buildFilename('csv', filters.dateFrom, filters.dateTo),
        mimeType: 'text/csv; charset=utf-8',
      };
    }

    const workbook = new Workbook();
    const sheet = workbook.addWorksheet('Transacciones');
    sheet.columns = [
      { header: 'Fecha', key: 'Fecha', width: 15 },
      { header: 'Descripción', key: 'Descripcion', width: 32 },
      { header: 'Categoría', key: 'Categoria', width: 20 },
      { header: 'Tipo', key: 'Tipo', width: 12 },
      { header: 'Monto', key: 'Monto', width: 15 },
    ];
    sheet.addRows(records.map((r) => ({ ...r, Monto: Number(r.Monto) })));

    return {
      buffer: Buffer.from(await workbook.xlsx.writeBuffer()),
      filename: buildFilename('xlsx', filters.dateFrom, filters.dateTo),
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
  }
}

// Text a spreadsheet would read as a formula (=, +, -, @, tab, CR) is prefixed with ' so it stays plain text
const asSpreadsheetText = (value: string) => (/^[=+\-@\t\r]/.test(value) ? `'${value}` : value);

const buildFilename = (extension: 'csv' | 'xlsx', from?: string, to?: string) => {
  const parts = ['transacciones'];
  if (from) parts.push(`desde-${from}`);
  if (to) parts.push(`hasta-${to}`);
  parts.push(new Date().toISOString().slice(0, 10));
  return `${parts.join('_')}.${extension}`;
};
