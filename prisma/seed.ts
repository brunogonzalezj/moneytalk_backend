/**
 * Initial data for a fresh database: the shared categories every user starts
 * with. Idempotent, so it is safe to run again: `npm run seed`.
 * The app itself only reads categories from the database.
 */
import { PrismaClient, TransactionType } from '@prisma/client';

const BASE_CATEGORIES: { name: string; type: TransactionType }[] = [
  { name: 'Salario', type: 'INCOME' },
  { name: 'Freelance', type: 'INCOME' },
  { name: 'Venta de productos', type: 'INCOME' },
  { name: 'Inversiones', type: 'INCOME' },
  { name: 'Regalos', type: 'INCOME' },
  { name: 'Otros ingresos', type: 'INCOME' },
  { name: 'Alimentación', type: 'EXPENSE' },
  { name: 'Transporte', type: 'EXPENSE' },
  { name: 'Alquiler', type: 'EXPENSE' },
  { name: 'Servicios básicos', type: 'EXPENSE' },
  { name: 'Salud', type: 'EXPENSE' },
  { name: 'Educación', type: 'EXPENSE' },
  { name: 'Entretenimiento', type: 'EXPENSE' },
  { name: 'Ropa', type: 'EXPENSE' },
  { name: 'Suscripciones', type: 'EXPENSE' },
  { name: 'Deudas', type: 'EXPENSE' },
  { name: 'Ahorros', type: 'EXPENSE' },
  { name: 'Otros gastos', type: 'EXPENSE' },
];

const prisma = new PrismaClient();

const main = async () => {
  let created = 0;
  for (const { name, type } of BASE_CATEGORIES) {
    const exists = await prisma.category.findFirst({ where: { name, type } });
    if (!exists) {
      await prisma.category.create({ data: { name, type } });
      created++;
    }
  }
  console.log(`Categorías base: ${created} creadas, ${BASE_CATEGORIES.length - created} ya existían`);
};

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
