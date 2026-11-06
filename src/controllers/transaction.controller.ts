import { Request, Response } from 'express';
import { matchedData } from 'express-validator';
import { TransactionType } from '../generated/prisma/client';
import { GroupBy, TransactionFilters, TransactionService } from '../services/transaction.service';
import { ExportFormat } from '../types';

const DEFAULT_PAGE_SIZE = 10;

const readFilters = (query: Record<string, unknown>): TransactionFilters => ({
  type: query.type === 'INCOME' || query.type === 'EXPENSE' ? (query.type as TransactionType) : undefined,
  categoryId: query.category as number | undefined,
  dateFrom: query.dateFrom as string | undefined,
  dateTo: query.dateTo as string | undefined,
  search: query.search as string | undefined,
});

export class TransactionController {
  static async list(req: Request, res: Response) {
    const query = matchedData(req, { locations: ['query'] });
    const page = (query.page as number | undefined) ?? 1;
    const limit = (query.limit as number | undefined) ?? DEFAULT_PAGE_SIZE;
    res.json(await TransactionService.list(req.user!.id, readFilters(query), page, limit));
  }

  static async summary(req: Request, res: Response) {
    const { from, to, groupBy } = req.query as { from?: string; to: string; groupBy?: GroupBy };
    res.json(await TransactionService.summary(req.user!.id, from, to, groupBy ?? 'day'));
  }

  static async create(req: Request, res: Response) {
    // Only validated fields reach the service; a userId in the body is ignored
    const data = matchedData(req, { locations: ['body'] });
    const transaction = await TransactionService.create(req.user!.id, {
      amount: data.amount,
      description: data.description,
      date: data.date,
      categoryId: data.categoryId,
      type: data.type,
    });
    res.status(201).json(transaction);
  }

  static async update(req: Request, res: Response) {
    const data = matchedData(req, { locations: ['body'] });
    const id = matchedData(req, { locations: ['params'] }).id as number;
    res.json(await TransactionService.update(req.user!.id, id, data));
  }

  static async remove(req: Request, res: Response) {
    const id = matchedData(req, { locations: ['params'] }).id as number;
    await TransactionService.remove(req.user!.id, id);
    res.status(204).send();
  }

  static async export(req: Request, res: Response) {
    const query = matchedData(req, { locations: ['query'] });
    const format = ((query.format as string | undefined) ?? 'CSV') as ExportFormat;
    const { buffer, filename, mimeType } = await TransactionService.export(req.user!.id, readFilters(query), format);
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }
}
