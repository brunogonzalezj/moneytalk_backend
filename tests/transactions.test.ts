import { api, createCategory, createUser, prisma, resetDatabase } from './helpers';

beforeEach(resetDatabase);
afterAll(() => prisma.$disconnect());

const setup = async () => {
  const [food, salary] = await Promise.all([createCategory('Comida', 'EXPENSE'), createCategory('Sueldo', 'INCOME')]);
  const owner = await createUser();
  const other = await createUser();
  return { food, salary, owner, other };
};

describe('POST /transactions', () => {
  it('requires authentication', async () => {
    await api().post('/api/transactions').send({ amount: 10, description: 'x', date: '2026-01-01', categoryId: 1 }).expect(401);
  });

  it('always uses the user from the token, ignoring a userId in the body', async () => {
    const { food, owner, other } = await setup();
    const res = await api()
      .post('/api/transactions')
      .set(owner.auth)
      .send({ amount: 25.5, description: 'Almuerzo', date: '2026-01-10', categoryId: food.id, userId: other.id })
      .expect(201);

    expect(res.body).toMatchObject({ amount: 25.5, description: 'Almuerzo', date: '2026-01-10', type: 'EXPENSE', category: 'Comida' });
    const stored = await prisma.transaction.findUniqueOrThrow({ where: { id: Number(res.body.id) } });
    expect(stored.userId).toBe(owner.id);
  });

  it('keeps the calendar day of a full timestamp sent by the client', async () => {
    const { food, owner } = await setup();
    // Local midnight in Bolivia (UTC-4), as the frontend used to send
    const res = await api()
      .post('/api/transactions')
      .set(owner.auth)
      .send({ amount: 5, description: 'Café', date: '2026-03-15T04:00:00.000Z', categoryId: food.id })
      .expect(201);
    expect(res.body.date).toBe('2026-03-15');
  });

  it('rejects a type that does not match the category', async () => {
    const { food, owner } = await setup();
    await api()
      .post('/api/transactions')
      .set(owner.auth)
      .send({ amount: 5, description: 'x', date: '2026-01-01', categoryId: food.id, type: 'INCOME' })
      .expect(400);
  });
});

describe('PUT and DELETE /transactions/:id', () => {
  const createFor = async (auth: { Authorization: string }, categoryId: number) =>
    (
      await api()
        .post('/api/transactions')
        .set(auth)
        .send({ amount: 100, description: 'Original', date: '2026-02-01', categoryId })
        .expect(201)
    ).body;

  it('lets the owner update only the allowed fields', async () => {
    const { food, owner, other } = await setup();
    const tx = await createFor(owner.auth, food.id);

    const res = await api()
      .put(`/api/transactions/${tx.id}`)
      .set(owner.auth)
      .send({ amount: 80, description: 'Editada', userId: other.id, id: 999 })
      .expect(200);

    expect(res.body).toMatchObject({ id: tx.id, amount: 80, description: 'Editada' });
    const stored = await prisma.transaction.findUniqueOrThrow({ where: { id: Number(tx.id) } });
    expect(stored.userId).toBe(owner.id);
  });

  it("returns 404 when another user edits or deletes someone else's transaction", async () => {
    const { food, owner, other } = await setup();
    const tx = await createFor(owner.auth, food.id);

    await api().put(`/api/transactions/${tx.id}`).set(other.auth).send({ amount: 1 }).expect(404);
    await api().delete(`/api/transactions/${tx.id}`).set(other.auth).expect(404);
    expect(await prisma.transaction.count({ where: { id: Number(tx.id) } })).toBe(1);
  });

  it('deletes for the owner', async () => {
    const { food, owner } = await setup();
    const tx = await createFor(owner.auth, food.id);
    await api().delete(`/api/transactions/${tx.id}`).set(owner.auth).expect(204);
    await api().delete(`/api/transactions/${tx.id}`).set(owner.auth).expect(404);
  });
});

describe('GET /transactions', () => {
  it('caps the page size', async () => {
    const { owner } = await setup();
    const res = await api().get('/api/transactions?limit=999999').set(owner.auth).expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it("filters on the server and never returns another user's rows", async () => {
    const { food, salary, owner, other } = await setup();
    const add = (auth: { Authorization: string }, amount: number, description: string, categoryId: number, date: string) =>
      api().post('/api/transactions').set(auth).send({ amount, description, categoryId, date }).expect(201);

    await add(owner.auth, 10, 'Pan', food.id, '2026-01-05');
    await add(owner.auth, 3000, 'Sueldo enero', salary.id, '2026-01-31');
    await add(owner.auth, 20, 'Pan integral', food.id, '2026-02-10');
    await add(other.auth, 999, 'Pan ajeno', food.id, '2026-01-06');

    const all = await api().get('/api/transactions').set(owner.auth).expect(200);
    expect(all.body.pagination.totalItems).toBe(3);

    const expenses = await api().get('/api/transactions?type=EXPENSE&search=pan').set(owner.auth).expect(200);
    expect(expenses.body.transactions.map((t: { description: string }) => t.description)).toEqual(['Pan integral', 'Pan']);

    const january = await api().get('/api/transactions?dateFrom=2026-01-01&dateTo=2026-01-31').set(owner.auth).expect(200);
    expect(january.body.pagination.totalItems).toBe(2);
  });
});

describe('GET /transactions/summary', () => {
  it('aggregates totals, categories and a filled daily series on the server', async () => {
    const { food, salary, owner, other } = await setup();
    const add = (auth: { Authorization: string }, amount: number, categoryId: number, date: string) =>
      api().post('/api/transactions').set(auth).send({ amount, description: 'x', categoryId, date }).expect(201);

    await add(owner.auth, 1000, salary.id, '2026-04-01');
    await add(owner.auth, 150.25, food.id, '2026-04-01');
    await add(owner.auth, 49.75, food.id, '2026-04-03');
    await add(owner.auth, 77, food.id, '2026-05-01'); // outside the range
    await add(other.auth, 500, food.id, '2026-04-02'); // another user

    const res = await api()
      .get('/api/transactions/summary?from=2026-04-01&to=2026-04-03&groupBy=day')
      .set(owner.auth)
      .expect(200);

    expect(res.body.totals).toEqual({ income: 1000, expense: 200, balance: 800, count: 3 });
    expect(res.body.byCategory).toEqual([
      expect.objectContaining({ name: 'Sueldo', type: 'INCOME', total: 1000, count: 1, percentage: 100 }),
      expect.objectContaining({ name: 'Comida', type: 'EXPENSE', total: 200, count: 2, percentage: 100 }),
    ]);
    expect(res.body.series).toEqual([
      { period: '2026-04-01', income: 1000, expense: 150.25 },
      { period: '2026-04-02', income: 0, expense: 0 },
      { period: '2026-04-03', income: 0, expense: 49.75 },
    ]);
  });

  it('groups by month', async () => {
    const { food, owner } = await setup();
    await api().post('/api/transactions').set(owner.auth).send({ amount: 10, description: 'x', categoryId: food.id, date: '2026-01-15' });
    await api().post('/api/transactions').set(owner.auth).send({ amount: 30, description: 'x', categoryId: food.id, date: '2026-03-02' });

    const res = await api()
      .get('/api/transactions/summary?from=2026-01-01&to=2026-03-31&groupBy=month')
      .set(owner.auth)
      .expect(200);
    expect(res.body.series).toEqual([
      { period: '2026-01-01', income: 0, expense: 10 },
      { period: '2026-02-01', income: 0, expense: 0 },
      { period: '2026-03-01', income: 0, expense: 30 },
    ]);
  });
});
