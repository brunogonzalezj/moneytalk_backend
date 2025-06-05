import { Request, Response } from 'express';
import { CategoryService } from '../services/category.service';
import { AuthenticatedRequest } from '../types';

export class CategoryController {
    static async createCategory(req: AuthenticatedRequest, res: Response) {
        try {
            const userId = req.user?.id;
            const category = await CategoryService.createCategory(req.body, userId!);
            res.status(201).json(category);
        } catch (error: any) {
            res.status(400).json({ error: error.message });
        }
    }

    static async createCategories(req: AuthenticatedRequest, res: Response) {
        try {
            const categories = await CategoryService.createCategories(req.body);
            res.status(201).json(categories);
        } catch (error: any) {
            res.status(400).json({ error: error.message });
        }
    }

    static async getCategories(req: Request, res: Response) {
        try {
            const categories = await CategoryService.getCategories();
            res.json(categories);
        } catch (error: any) {
            res.status(400).json({ error: error.message });
        }
    }

    static async updateCategory(req: AuthenticatedRequest, res: Response) {
        try {
            const userId = req.user?.id;
            const { id } = req.params;
            const updated = await CategoryService.updateCategory(Number(id), req.body, userId!);
            res.json(updated);
        } catch (error: any) {
            res.status(400).json({ error: error.message });
        }
    }

    static async deleteCategory(req: AuthenticatedRequest, res: Response) {
        try {
            const userId = req.user?.id;
            const { id } = req.params;
            const deleted = await CategoryService.deleteCategory(Number(id), userId!);
            res.json(deleted);
        } catch (error: any) {
            res.status(400).json({ error: error.message });
        }
    }
}