import { PrismaClient } from '@prisma/client';
import { CategoryPayload, CategoryUpdatePayload } from '../types';

const prisma = new PrismaClient();

export class CategoryService {
    static async createCategory(data: CategoryPayload, userId: number) {
        const { name, type } = data;
        if (!userId) {
            throw new Error('ID de usuario no proporcionado');
        }
        if (!name) {
            throw new Error('Nombre de categoría requerido');
        }
        if (!type) {
            throw new Error('Tipo de categoría requerido');
        }

        // Verificar si la categoría ya existe con el mismo nombre y tipo
        const existingCategory = await prisma.category.findFirst({
            where: {
                name: {
                    equals: name
                },
                type: type
            }
        });

        if (existingCategory) {
            // Si la categoría ya existe con el mismo nombre y tipo, devolverla
            return existingCategory;
        }

        // Si no existe, crearla (ahora el constraint permite mismo nombre con diferente tipo)
        return await prisma.category.create({
            data: {
                name,
                type,
            },
        });
    }

    static async createCategories(data: CategoryPayload[]) {
        const createMany = await prisma.category.createMany({
            data: [...data],
            skipDuplicates: true, // Ignora duplicados
        })
    };
    static async getCategories() {
        return await prisma.category.findMany({
            orderBy: { name: 'asc' },
        });
    }

    static async updateCategory(id: number, data: CategoryUpdatePayload, userId: number) {
        return await prisma.category.updateMany({
            where: { id },
            data,
        });
    }

    static async deleteCategory(id: number, userId: number) {
        return await prisma.category.deleteMany({
            where: { id },
        });
    }
}