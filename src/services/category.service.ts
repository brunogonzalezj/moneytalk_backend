import { TransactionType } from '@prisma/client';
import prisma from '../lib/prisma';
import { AppError } from '../utils/AppError';
import { normalizeName } from '../utils/text';

const categorySelect = { id: true, name: true, type: true, createdAt: true } as const;


export class CategoryService {
  /** Returns the shared category with this exact name and type, creating it if needed. */
  static async ensureGlobal(name: string, type: TransactionType) {
    const existing = await prisma.category.findFirst({ where: { name, type }, select: categorySelect });
    return existing ?? prisma.category.create({ data: { name, type }, select: categorySelect });
  }

  /** Categories a user can pick from, sorted by name. */
  static async listForUser(_userId: number, type?: TransactionType) {
    return prisma.category.findMany({
      where: { ...(type && { type }) },
      select: categorySelect,
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Creates a category, or returns the existing one when a category with the
   * same name (ignoring case and accents) and type already exists.
   */
  static async create(userId: number, name: string, type: TransactionType) {
    const cleanName = name.trim().replace(/\s+/g, ' ');
    const existing = (await this.listForUser(userId, type)).find(
      (category) => normalizeName(category.name) === normalizeName(cleanName)
    );
    if (existing) return { category: existing, created: false };

    const category = await prisma.category.create({ data: { name: cleanName, type }, select: categorySelect });
    return { category, created: true };
  }

  /** Throws 404 unless the category exists and the user may use it. */
  static async assertAccessible(_userId: number, categoryId: number) {
    const category = await prisma.category.findUnique({ where: { id: categoryId }, select: categorySelect });
    if (!category) throw AppError.notFound('Categoría no encontrada');
    return category;
  }
}
