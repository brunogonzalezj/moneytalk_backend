import { Request, Response } from 'express';
import { TransactionType } from '../generated/prisma/client';
import { CategoryService } from '../services/category.service';

export class CategoryController {
  static async list(req: Request, res: Response) {
    const type = req.query.type as TransactionType | undefined;
    res.json(await CategoryService.listForUser(req.user!.id, type));
  }

  static async create(req: Request, res: Response) {
    const { name, type } = req.body as { name: string; type: TransactionType };
    const { category, created } = await CategoryService.create(req.user!.id, name, type);
    res.status(created ? 201 : 200).json(category);
  }
}
