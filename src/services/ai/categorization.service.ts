import { TransactionType } from '../../generated/prisma/client';
import {
  buildCategorizeSystemPrompt,
  buildCategorizeUserMessage,
  categorizeResponseSchema,
  CategorizedTransaction,
} from '../../prompts/categorize.prompt';
import { addDaysToIsoDate, toLocalIsoDate, weekdayName } from '../../utils/dates';
import { normalizeName, sanitizeFreeText } from '../../utils/text';
import { CategoryService } from '../category.service';
import { chatJson } from './chatJson';

export const MAX_CATEGORIZE_TEXT_LENGTH = 500;

/** Shape the frontend's NewTransaction screen consumes. */
export interface CategorizeResult {
  isValidFinancialTransaction: boolean;
  confidence: number;
  transactionTypeExtracted: TransactionType;
  amountExtracted: number;
  descriptionExtracted: string;
  dateExtracted?: string;
  categoryName: string;
  suggestedCategory?: string;
  rejectionReason?: string;
}

/**
 * The first transaction's fields at the top level (what a single-transaction client reads), plus every
 * valid transaction found in the text when the user dictated several at once.
 */
export interface CategorizeResponseBody extends CategorizeResult {
  transactions: CategorizeResult[];
}

const RECENT_DAYS = 8;

export class CategorizationService {
  static async categorize(userId: number, rawText: string): Promise<CategorizeResponseBody> {
    const text = sanitizeFreeText(rawText, MAX_CATEGORIZE_TEXT_LENGTH);
    const categories = await CategoryService.listForUser(userId);

    const today = toLocalIsoDate(new Date());
    const recentDays = Array.from({ length: RECENT_DAYS }, (_, offset) => {
      const date = addDaysToIsoDate(today, -offset);
      return { date, weekday: weekdayName(date) };
    });

    const answer = await chatJson({
      system: buildCategorizeSystemPrompt({
        today,
        recentDays,
        incomeCategories: categories.filter((c) => c.type === 'INCOME').map((c) => c.name),
        expenseCategories: categories.filter((c) => c.type === 'EXPENSE').map((c) => c.name),
      }),
      user: buildCategorizeUserMessage(text),
      schema: categorizeResponseSchema,
      temperature: 0.1,
      maxTokens: 1200,
    });

    const results = answer.transactions.map((item) => CategorizationService.toResult(item, categories, today, text));
    const valid = results.filter((result) => result.isValidFinancialTransaction);
    // Nothing usable: report why, from the first entry
    if (!valid.length) return { ...results[0], transactions: [] };
    return { ...valid[0], transactions: valid };
  }

  private static toResult(
    answer: CategorizedTransaction,
    categories: { name: string; type: TransactionType }[],
    today: string,
    text: string
  ): CategorizeResult {
    if (!answer.isValidFinancialTransaction || !answer.amount || !answer.transactionType) {
      return {
        isValidFinancialTransaction: false,
        confidence: answer.confidence,
        transactionTypeExtracted: 'EXPENSE',
        amountExtracted: 0,
        descriptionExtracted: '',
        categoryName: '',
        rejectionReason:
          answer.rejectionReason ??
          (answer.isValidFinancialTransaction
            ? 'No se encontró un monto en el texto'
            : 'El texto no parece describir un gasto o un ingreso'),
      };
    }

    const type = answer.transactionType;
    // Match against the user's categories of that type, ignoring case and accents
    const proposed = answer.category ?? answer.suggestedCategory;
    const match = proposed
      ? categories.find((c) => c.type === type && normalizeName(c.name) === normalizeName(proposed))
      : undefined;

    // The model may only date transactions in the past or today
    const date = answer.date && answer.date <= today ? answer.date : today;

    return {
      isValidFinancialTransaction: true,
      confidence: answer.confidence,
      transactionTypeExtracted: type,
      amountExtracted: Math.round(answer.amount * 100) / 100,
      descriptionExtracted: answer.description?.trim() || text,
      dateExtracted: date,
      categoryName: match?.name ?? '',
      suggestedCategory: match ? undefined : proposed?.trim() || undefined,
    };
  }
}
