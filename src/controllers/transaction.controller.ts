//Create transaction controller based on the service
import { Request, Response, NextFunction } from 'express';
import { TransactionService } from '../services/transaction.service';
import { TransactionPayload, TransactionUpdatePayload } from '../types';

export class TransactionController {
  static async createTransaction(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.body.userId; // Assuming user ID is set in the request by authentication middleware
      const transactionData: TransactionPayload = req.body;
      const transaction = await TransactionService.createTransaction(transactionData, userId);
      res.status(201).json(transaction);
    } catch (err) {
      next(err);
    }
  }

  static async getTransactions(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user.id;
      const transactions = await TransactionService.getTransactions(userId);
      res.json(transactions);
    } catch (err) {
      next(err);
    }
  }

  static async updateTransaction(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user.id;
      const transactionId = parseInt(req.params.id, 10);
      const updateData: TransactionUpdatePayload = req.body;
      const updatedTransaction = await TransactionService.updateTransaction(transactionId, updateData, userId);
      res.json(updatedTransaction);
    } catch (err) {
      next(err);
    }
  }

  static async deleteTransaction(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user.id;
      const transactionId = parseInt(req.params.id, 10);
      await TransactionService.deleteTransaction(transactionId, userId);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
}