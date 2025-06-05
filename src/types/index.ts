import { Request } from 'express';
import { User } from '@prisma/client';

// Authentication types
export interface UserPayload {
  id: number;
  email: string;
  name: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface SignupPayload {
  email: string;
  password: string;
  displayName: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RefreshTokenPayload {
  refreshToken: string;
}

export interface TokenPayload {
    id: number;
  name: string;
  userId: number;
  email: string;
}

// Transaction types
export interface TransactionPayload {
  amount: number;
  description: string;
  date: string;
  categoryId: number;
}

export interface TransactionUpdatePayload {
  amount?: number;
  description?: string;
  date?: string;
  categoryId?: number;
}

export interface VoiceAnalysisResult {
  categoryName: string;
  amountExtracted: number;
  descriptionExtracted: string;
}

// Category types
export interface CategoryPayload {
  name: string;
  type: 'INCOME' | 'EXPENSE';
}

export interface CategoryUpdatePayload {
  name?: string;
  type?: 'INCOME' | 'EXPENSE';
}

// Report types
export interface ReportQueryParams {
  startDate: string;
  endDate: string;
}

export interface CategorySummary {
  categoryName: string;
  amount: number;
}

export interface ReportSummary {
  totalIncome: number;
  totalExpense: number;
  byCategory: CategorySummary[];
}

// Extend Express Request type
export interface AuthenticatedRequest extends Request {
  user?: UserPayload;
}

// Pagination types
export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    totalPages: number;
    totalCount: number;
  };
}
