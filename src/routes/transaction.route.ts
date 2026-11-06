//Create routes for transaction operations
import express from 'express';
import { TransactionController } from '../controllers/transaction.controller';
import { authMiddleware } from '../middlewares/authMiddleware';

const router = express.Router();

// Proteger todas las rutas de transacciones

// Get transactions con paginación, filtros y ordenamiento
router.get(
  '/',
    authMiddleware ,TransactionController.getTransactions
);

// Protected export route for transactions
router.get(
  '/export',
  authMiddleware,
  TransactionController.exportTransactions
);

// Crear una nueva transacción
router.post(
  '/',
  TransactionController.createTransaction
);

export default router;