//Create routes for transaction operations
import express from 'express';
import { TransactionController } from '../controllers/transaction.controller';

const router = express.Router();
// Create a new transaction

router.post(
  '/',
  TransactionController.createTransaction
);

export default router;