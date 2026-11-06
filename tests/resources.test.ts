import { api, createCategory, createUser, prisma, resetDatabase } from './helpers';
import { addDaysToIsoDate, toLocalIsoDate } from '../src/utils/dates';

beforeEach(resetDatabase);
afterAll(() => prisma.$disconnect());

describe('categories', () => {
  it('requires authentication to list', async () => {
    await api().get('/api/categories').expect(401);
  });

  it('returns an existing category instead of creating a near-duplicate', async () => {
    const user = await createUser();
    await createCategory('Alimentación', 'EXPENSE');

    const res = await api().post('/api/categories').set(user.auth).send({ name: '  alimentacion ', type: 'EXPENSE' }).expect(200);
    expect(res.body.name).toBe('Alimentación');
    expect(await prisma.category.count()).toBe(1);

    await api().post('/api/categories').set(user.auth).send({ name: 'Mascotas', type: 'EXPENSE' }).expect(201);
  });
});

describe('recurring payments', () => {
  const today = () => toLocalIsoDate(new Date());

  const create = async (auth: { Authorization: string }, categoryId: number, startDate: string) =>
    (
      await api()
        .post('/api/recurring-payments')
        .set(auth)
        .send({ name: 'Internet', amount: 199, frequency: 'MONTHLY', startDate, categoryId })
        .expect(201)
    ).body;

  it('requires a start date', async () => {
    const user = await createUser();
    const category = await createCategory('Servicios', 'EXPENSE');
    const res = await api()
      .post('/api/recurring-payments')
      .set(user.auth)
      .send({ name: 'Internet', amount: 199, frequency: 'MONTHLY', categoryId: category.id })
      .expect(400);
    expect(res.body.error.details.map((d: { field: string }) => d.field)).toContain('startDate');
  });

  it('charges first on the start date and defaults the description to the name', async () => {
    const user = await createUser();
    const category = await createCategory('Servicios', 'EXPENSE');
    const payment = await create(user.auth, category.id, addDaysToIsoDate(today(), 3));
    expect(payment.nextDate.slice(0, 10)).toBe(addDaysToIsoDate(today(), 3));
    expect(payment.description).toBe('Internet');
  });

  it('stays deleted after a delete, and keeps the transactions it created', async () => {
    const user = await createUser();
    const category = await createCategory('Servicios', 'EXPENSE');
    const payment = await create(user.auth, category.id, today());
    await api().post(`/api/recurring-payments/${payment.id}/execute`).set(user.auth).expect(201);

    await api().delete(`/api/recurring-payments/${payment.id}`).set(user.auth).expect(204);

    const list = await api().get('/api/recurring-payments').set(user.auth).expect(200);
    expect(list.body.recurringPayments).toHaveLength(0);
    const history = await prisma.transaction.findMany({ where: { userId: user.id } });
    expect(history).toHaveLength(1);
    expect(history[0].recurringPaymentId).toBeNull();
  });

  it('updates start date and category and recalculates the next charge', async () => {
    const user = await createUser();
    const [services, other] = await Promise.all([
      createCategory('Servicios', 'EXPENSE'),
      createCategory('Suscripciones', 'EXPENSE'),
    ]);
    const payment = await create(user.auth, services.id, today());
    const newStart = addDaysToIsoDate(today(), 10);

    const res = await api()
      .put(`/api/recurring-payments/${payment.id}`)
      .set(user.auth)
      .send({ startDate: newStart, categoryId: other.id })
      .expect(200);
    expect(res.body.categoryId).toBe(other.id);
    expect(res.body.nextDate.slice(0, 10)).toBe(newStart);
  });

  it('processes due payments once and moves the schedule forward', async () => {
    const user = await createUser();
    const category = await createCategory('Servicios', 'EXPENSE');
    const payment = await create(user.auth, category.id, today());

    const { RecurringPaymentService } = await import('../src/services/recurringPayment.service');
    const first = await RecurringPaymentService.processAllRecurringPayments();
    expect(first.results).toEqual([expect.objectContaining({ recurringPaymentId: payment.id, created: 1, success: true })]);

    // A second run on the same day creates nothing new
    const second = await RecurringPaymentService.processAllRecurringPayments();
    expect(second.processed).toBe(0);
    expect(await prisma.transaction.count({ where: { recurringPaymentId: payment.id } })).toBe(1);
  });

  it('only lets admins trigger processing for everyone', async () => {
    const user = await createUser();
    await api().post('/api/recurring-payments/process-all').expect(401);
    await api().post('/api/recurring-payments/process-all').set(user.auth).expect(403);

    await prisma.user.update({ where: { id: user.id }, data: { role: 'admin' } });
    await api().post('/api/recurring-payments/process-all').set(user.auth).expect(200);
  });
});

describe('savings goals', () => {
  it('adds contributions with exact decimal math and completes the goal', async () => {
    const user = await createUser();
    const goal = (
      await api()
        .post('/api/savings-goals')
        .set(user.auth)
        .send({ name: 'Viaje', type: 'VACATION', targetAmount: 0.3 })
        .expect(201)
    ).body;

    await api().post(`/api/savings-goals/${goal.id}/add`).set(user.auth).send({ amount: 0.1 }).expect(200);
    const res = await api().post(`/api/savings-goals/${goal.id}/add`).set(user.auth).send({ amount: 0.2 }).expect(200);

    // 0.1 + 0.2 is exactly 0.3 with Decimal, so the goal completes
    expect(res.body.goal).toMatchObject({ currentAmount: 0.3, status: 'COMPLETED' });
    expect(await prisma.transaction.count({ where: { userId: user.id } })).toBe(2);
  });

  it("rejects invalid enums with 400 and hides other users' goals", async () => {
    const [owner, other] = await Promise.all([createUser(), createUser()]);
    await api().get('/api/savings-goals?type=NOPE').set(owner.auth).expect(400);

    const goal = (
      await api().post('/api/savings-goals').set(owner.auth).send({ name: 'Auto', type: 'PURCHASE_GOAL', targetAmount: 100 })
    ).body;
    await api().get(`/api/savings-goals/${goal.id}`).set(other.auth).expect(404);
  });
});

describe('notifications', () => {
  it('saves flat settings and reads them back', async () => {
    const user = await createUser();
    await api()
      .post('/api/notifications/settings')
      .set(user.auth)
      .send({ dailyReminder: true, dailyTime: '21:30', timezone: 'America/La_Paz', unknownField: 'ignored' })
      .expect(200);

    const res = await api().get('/api/notifications/settings').set(user.auth).expect(200);
    expect(res.body.settings).toMatchObject({ dailyReminder: true, dailyTime: '21:30', timezone: 'America/La_Paz' });
    expect(res.body.settings).not.toHaveProperty('unknownField');
  });

  it('validates the settings values', async () => {
    const user = await createUser();
    await api().post('/api/notifications/settings').set(user.auth).send({ dailyTime: '25:99' }).expect(400);
    await api().post('/api/notifications/settings').set(user.auth).send({ timezone: 'Marte/Olimpo' }).expect(400);
  });

  it('rejects subscription keys sent as byte arrays', async () => {
    const user = await createUser();
    const res = await api()
      .post('/api/notifications/subscribe')
      .set(user.auth)
      .send({ subscription: { endpoint: 'https://push.example.com/abc', keys: { p256dh: [1, 2, 3], auth: [4, 5] } } })
      .expect(400);
    expect(res.body.error.details.map((d: { field: string }) => d.field)).toEqual(
      expect.arrayContaining(['subscription.keys.p256dh', 'subscription.keys.auth'])
    );
  });

  it('stores a valid subscription and keeps settings on unsubscribe', async () => {
    const user = await createUser();
    await api()
      .post('/api/notifications/subscribe')
      .set(user.auth)
      .send({
        subscription: { endpoint: 'https://push.example.com/abc', keys: { p256dh: 'BNcRdreALRFX_aB-1', auth: 'tBHItJI5svbpez7KI4CCXg' } },
        settings: { weeklyReminder: true },
      })
      .expect(204);

    let status = await api().get('/api/notifications/status').set(user.auth).expect(200);
    expect(status.body).toMatchObject({ hasSubscription: true, settings: { weeklyReminder: true } });

    await api().post('/api/notifications/unsubscribe').set(user.auth).expect(204);
    status = await api().get('/api/notifications/status').set(user.auth).expect(200);
    expect(status.body).toMatchObject({ hasSubscription: false, settings: { weeklyReminder: true } });
  });
});
