import { Prisma, TransactionType } from '@prisma/client';
import prisma from '../prisma/client';
import { TransactionPayload, TransactionUpdatePayload, TransactionsListResponse, TransactionListItem, TransactionExportQuery } from '../types';
import { Workbook } from 'exceljs';
import { stringify } from 'csv-stringify/sync';

export class TransactionService {
  static async createTransaction(data: TransactionPayload, userId: number): Promise<any> {
    const { categoryId, amount, description, date, type } = data;

    if (!userId) {
      throw new Error('ID de usuario no proporcionado');
    }
    if (!categoryId) {
      throw new Error('ID de categoría no proporcionado');
    }
    if (!description || description.trim() === '') {
      throw new Error('Descripción requerida');
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error('El monto debe ser un número mayor que cero');
    }

    const parsedDate = date instanceof Date ? date : new Date(date as string);
    if (isNaN(parsedDate.getTime())) {
      throw new Error('Fecha inválida');
    }

    // Validar existencia de categoría y coincidencia con type si se envía
    const category = await prisma.category.findUnique({ where: { id: categoryId } });
    if (!category) {
      throw new Error('Categoría no encontrada');
    }
    if (type && type !== category.type) {
      throw new Error('El tipo de la transacción no coincide con el tipo de la categoría');
    }

    return await prisma.transaction.create({
      data: {
        amount,
        description: description.trim(),
        date: parsedDate,
        user: { connect: { id: userId } },
        category: { connect: { id: categoryId } },
      },
    });
  }

  static async getTransactions(params: {
    search: string | undefined;
    limit: number;
    dateTo: string | undefined;
    page: number;
    type: "INCOME" | "EXPENSE" | "all";
    category: number | undefined;
    dateFrom: string | undefined;
    userId: number | undefined
  }): Promise<TransactionsListResponse> {
    const { userId, page, limit, type, category, dateFrom, dateTo, search } = params;

    const andFilters: Prisma.TransactionWhereInput[] = [
      { userId },
    ];

    if (category) {
      andFilters.push({ categoryId: category });
    }

    if (search && search.trim() !== '') {
      andFilters.push({ description: { contains: search.trim() } });
    }

    if (dateFrom || dateTo) {
      const dateFilter: Prisma.DateTimeFilter = {};
      if (dateFrom) {
        const from = new Date(dateFrom + 'T00:00:00.000Z');
        if (!isNaN(from.getTime())) dateFilter.gte = from;
      }
      if (dateTo) {
        const to = new Date(dateTo + 'T23:59:59.999Z');
        if (!isNaN(to.getTime())) dateFilter.lte = to;
      }
      if (dateFilter.gte || dateFilter.lte) {
        andFilters.push({ date: dateFilter });
      }
    }

    if (type === 'INCOME' || type === 'EXPENSE') {
      andFilters.push({ category: { type: type as TransactionType } });
    }

    const where: Prisma.TransactionWhereInput = { AND: andFilters };

    const totalItems = await prisma.transaction.count({ where });

    const skip = (page - 1) * limit;
    const take = limit;

    const results = await prisma.transaction.findMany({
      where,
      include: {
        category: { select: { id: true, name: true, type: true } },
      },
      orderBy: [
        { date: 'desc' },
        { createdAt: 'desc' },
      ],
      skip,
      take,
    });

    const mapItem = (t: typeof results[number]): TransactionListItem => ({
      id: String(t.id),
      description: t.description,
      amount: parseFloat(t.amount.toString()),
      category: t.category.name,
      categoryId: t.category.id,
      type: t.category.type,
      date: new Date(t.date).toISOString().slice(0, 10),
      createdAt: t.createdAt.toISOString(),
    });

    const transactions = results.map(mapItem);

    const totalPages = Math.max(1, Math.ceil(totalItems / limit));
    const currentPage = Math.min(page, totalPages);

    return {
      transactions,
      pagination: {
        currentPage,
        totalPages,
        totalItems,
        hasNextPage: currentPage < totalPages,
        hasPrevPage: currentPage > 1,
      },
    };
  }

  static async updateTransaction(id: number, data: TransactionUpdatePayload, userId: number) {
    return await prisma.transaction.updateMany({
      where: { id, userId },
      data,
    });
  }

  static async deleteTransaction(id: number, userId: number) {
    return await prisma.transaction.deleteMany({
      where: { id, userId },
    });
  }

  static async exportTransactions(params: TransactionExportQuery): Promise<{ buffer: Buffer; filename: string; mimeType: string }> {
    const { userId, dateFrom, dateTo, format } = params;

    if (!userId) {
      throw new Error('Usuario no autenticado');
    }

    const where: Prisma.TransactionWhereInput = {
      userId,
    };

    if (dateFrom || dateTo) {
      const dateFilter: Prisma.DateTimeFilter = {};
      if (dateFrom) {
        const from = new Date(dateFrom + 'T00:00:00.000Z');
        if (!isNaN(from.getTime())) dateFilter.gte = from;
      }
      if (dateTo) {
        const to = new Date(dateTo + 'T23:59:59.999Z');
        if (!isNaN(to.getTime())) dateFilter.lte = to;
      }
      if (dateFilter.gte || dateFilter.lte) {
        where.date = dateFilter;
      }
    }

    const transactions = await prisma.transaction.findMany({
      where,
      include: { category: true },
      orderBy: [{ date: 'desc' }],
    });

    const rows = transactions.map((t) => ({
      Fecha: t.date.toISOString().slice(0, 10),
      Descripcion: t.description,
      Categoria: t.category?.name ?? '',
      Tipo: t.category?.type === 'INCOME' ? 'Ingreso' : t.category?.type === 'EXPENSE' ? 'Gasto' : '',
      Monto: t.amount.toString(),
    }));

    if (format === 'CSV') {
      const csv = stringify(rows, { header: true, delimiter: ',' });
      const filename = buildFilename('csv', dateFrom, dateTo);
      return { buffer: Buffer.from(csv, 'utf-8'), filename, mimeType: 'text/csv' };
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
    sheet.addRows(rows);

    const buffer = await workbook.xlsx.writeBuffer();
    const filename = buildFilename('xlsx', dateFrom, dateTo);
    return { buffer: Buffer.from(buffer), filename, mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' };
  }
}

const buildFilename = (extension: 'csv' | 'xlsx', from?: string, to?: string) => {
  const parts = ['transacciones'];
  if (from) parts.push(`desde-${from}`);
  if (to) parts.push(`hasta-${to}`);
  parts.push(new Date().toISOString().slice(0, 10));
  return `${parts.join('_')}.${extension}`;
};
