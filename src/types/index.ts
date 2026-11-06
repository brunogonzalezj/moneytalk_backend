import { Request } from 'express';

export interface UserPayload {
  id: number;
  email: string;
  name: string;
  avatar?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

// Claims carried by access and refresh tokens
export interface TokenPayload {
  id: number;
  email: string;
  name: string;
}

// authMiddleware sets req.user from the access token
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: UserPayload;
    }
  }
}

export type AuthenticatedRequest = Request;

export interface TransactionListItem {
  id: string;
  description: string;
  amount: number;
  category: string; // category.name
  categoryId: number;
  type: 'INCOME' | 'EXPENSE'; // category.type
  date: string; // YYYY-MM-DD
  createdAt: string; // ISO
}

export type ExportFormat = 'CSV' | 'XLSX';

export interface TransactionsListResponse {
  transactions: TransactionListItem[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}
