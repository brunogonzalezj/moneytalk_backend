//Create transaction controller based on the service
import { Response, NextFunction } from 'express';
import { TransactionService } from '../services/transaction.service';
import prisma from '../prisma/client';
import { TransactionUpdatePayload, AuthenticatedRequest, TransactionsListResponse, TransactionFilterType, ExportFormat } from '../types';

export class TransactionController {
  static async createTransaction(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { description, amount, categoryId, type, date, userId } = req.body as {
        description?: string;
        amount?: string | number;
        categoryId?: string | number;
        type?: 'INCOME' | 'EXPENSE';
        date?: string | Date;
        userId?: string | number;
      };

      // Convertir y validar tipos
      const parsedUserId = typeof userId === 'string' ? parseInt(userId, 10) : typeof userId === 'number' ? userId : NaN;
      const parsedCategoryId = typeof categoryId === 'string' ? parseInt(categoryId, 10) : typeof categoryId === 'number' ? categoryId : NaN;
      const parsedAmount = typeof amount === 'string' ? parseFloat(amount) : typeof amount === 'number' ? amount : NaN;

      if (!description || description.trim() === '') {
        return res.status(400).json({ error: 'Descripción requerida' });
      }
      if (!Number.isFinite(parsedUserId)) {
        return res.status(400).json({ error: 'ID de usuario inválido' });
      }
      if (!Number.isFinite(parsedCategoryId)) {
        return res.status(400).json({ error: 'ID de categoría inválido' });
      }
      if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
        return res.status(400).json({ error: 'Monto inválido' });
      }

      // Validar fecha
      const parsedDate = date instanceof Date ? date : new Date(date as string);
      if (!date || isNaN(parsedDate.getTime())) {
        return res.status(400).json({ error: 'Fecha inválida' });
      }

      // Verificar que la categoría existe
      const category = await prisma.category.findUnique({ where: { id: parsedCategoryId } });
      if (!category) {
        return res.status(404).json({ error: 'Categoría no encontrada' });
      }

      // Validar que el type (si viene) coincide con el de la categoría
      if (type && type !== category.type) {
        return res.status(400).json({ error: 'El tipo de la transacción no coincide con el tipo de la categoría' });
      }

      const transaction = await TransactionService.createTransaction(
        {
          description: description.trim(),
          amount: parsedAmount,
          categoryId: parsedCategoryId,
          date: parsedDate,
          type,
        },
        parsedUserId
      );

      res.status(201).json(transaction);
    } catch (error) {
      console.error('Error creating transaction:', error);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
  }

  static async getTransactions(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      console.log('🔍 getTransactions Debug:');
      console.log('req.user:', req.user);

      const authUserId = req.user?.id;
      console.log('authUserId:', authUserId);

      if (!authUserId) {
        console.log('❌ No authUserId found');
        return res.status(401).json({ error: 'No autorizado' });
      }

      // Parse and validate query params (sin userId en body ni query)
      const pageRaw = (req.query.page as string) ?? '1';
      const limitRaw = (req.query.limit as string) ?? '10';
      const typeRaw = (req.query.type as string) ?? 'all';
      const categoryRaw = req.query.category as string | undefined;
      const dateFrom = req.query.dateFrom as string | undefined;
      const dateTo = req.query.dateTo as string | undefined;
      const search = req.query.search as string | undefined;

      const page = Number.parseInt(pageRaw, 10);
      const limit = Number.parseInt(limitRaw, 10);

      if (!Number.isFinite(page) || page < 1) {
        return res.status(400).json({ error: 'Parámetro "page" inválido. Debe ser un número positivo.' });
      }
      if (!Number.isFinite(limit) || limit < 1) {
        return res.status(400).json({ error: 'Parámetro "limit" inválido. Debe ser un número positivo.' });
      }

      const allowedTypes: TransactionFilterType[] = ['INCOME', 'EXPENSE', 'all'];
      const type = allowedTypes.includes(typeRaw as TransactionFilterType)
        ? (typeRaw as TransactionFilterType)
        : 'all';

      const category = categoryRaw ? Number.parseInt(categoryRaw, 10) : undefined;
      if (categoryRaw && (!Number.isFinite(category!) || category! < 1)) {
        return res.status(400).json({ error: 'Parámetro "category" inválido. Debe ser un ID numérico positivo.' });
      }

      // Optional: validate date format YYYY-MM-DD (simple check)
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (dateFrom && !dateRegex.test(dateFrom)) {
        return res.status(400).json({ error: 'Parámetro "dateFrom" inválido. Formato esperado YYYY-MM-DD.' });
      }
      if (dateTo && !dateRegex.test(dateTo)) {
        return res.status(400).json({ error: 'Parámetro "dateTo" inválido. Formato esperado YYYY-MM-DD.' });
      }

      const result: TransactionsListResponse = await TransactionService.getTransactions({
        userId: authUserId, // ✅ Usar el userId del JWT, no del body
        page,
        limit,
        type,
        category,
        dateFrom,
        dateTo,
        search,
      });

      return res.json(result);
    } catch (err) {
      next(err);
    }
  }

  static async updateTransaction(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'No autorizado' });
      }
      const transactionId = parseInt(req.params.id, 10);
      const updateData: TransactionUpdatePayload = req.body;
      const updatedTransaction = await TransactionService.updateTransaction(transactionId, updateData, userId);
      res.json(updatedTransaction);
    } catch (err) {
      next(err);
    }
  }

  static async deleteTransaction(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'No autorizado' });
      }
      const transactionId = parseInt(req.params.id, 10);
      await TransactionService.deleteTransaction(transactionId, userId);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }

  static async exportTransactions(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'No autorizado' });
      }

      const { dateFrom, dateTo, format } = req.query as { dateFrom?: string; dateTo?: string; format?: string };
      const upperFormat = (format ?? 'CSV').toUpperCase();
      if (!['CSV', 'XLSX'].includes(upperFormat)) {
        return res.status(400).json({ error: 'Formato inválido. Usa CSV o XLSX.' });
      }

      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (dateFrom && !dateRegex.test(dateFrom)) {
        return res.status(400).json({ error: 'Parámetro "dateFrom" inválido. Usa YYYY-MM-DD.' });
      }
      if (dateTo && !dateRegex.test(dateTo)) {
        return res.status(400).json({ error: 'Parámetro "dateTo" inválido. Usa YYYY-MM-DD.' });
      }

      const { buffer, filename, mimeType } = await TransactionService.exportTransactions({
        userId,
        dateFrom,
        dateTo,
        format: upperFormat as ExportFormat,
      });

      res.setHeader('Content-Type', mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.send(buffer);
    } catch (error) {
      next(error);
    }
  }
}