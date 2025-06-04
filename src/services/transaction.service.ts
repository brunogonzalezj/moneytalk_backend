import {PrismaClient} from '@prisma/client';
import { TransactionPayload, TransactionUpdatePayload } from '../types';

const prisma = new PrismaClient();

export class TransactionService {
  static async createTransaction(data: TransactionPayload, userId: number) {
    const { categoryId, amount, description, date } = data;
    const parsedDate = new Date(date);
    if (isNaN(parsedDate.getTime())) {
      throw new Error('Fecha inválida');
    }
    if (!userId){
        throw new Error('ID de usuario no proporcionado');
    }
    if (!categoryId) {
      throw new Error('ID de categoría no proporcionado');
    }
    if (amount <= 0) {
      throw new Error('El monto debe ser mayor que cero');
    }
    return await prisma.transaction.create({
      data: {
        amount,
        description,
        date: parsedDate,
        user: { connect: { id: userId } },
        category: { connect: { id: categoryId } },
      },
    });
  }

  static async getTransactions(userId: number) {
    return await prisma.transaction.findMany({
      where: { userId },
      orderBy: { date: 'desc' },
    });
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
}