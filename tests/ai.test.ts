import { api, createCategory, createUser, prisma, resetDatabase } from './helpers';
import { toLocalIsoDate } from '../src/utils/dates';

// Replaces the OpenAI client: each test sets what the "model" answers
const create = jest.fn();
jest.mock('../src/lib/openai', () => ({
  getOpenAI: () => ({ chat: { completions: { create } } }),
}));

const answer = (json: unknown) => ({ choices: [{ message: { content: typeof json === 'string' ? json : JSON.stringify(json) } }] });

beforeEach(resetDatabase);
afterAll(() => prisma.$disconnect());

describe('POST /gpt/categorize', () => {
  it('maps the answer to an existing category ignoring case and accents', async () => {
    const user = await createUser();
    await createCategory('Alimentación', 'EXPENSE');
    create.mockResolvedValue(
      answer({
        isValidFinancialTransaction: true,
        confidence: 0.92,
        transactionType: 'EXPENSE',
        amount: 45.5,
        description: 'Almuerzo',
        date: '2000-01-01',
        category: 'alimentacion',
        suggestedCategory: null,
        rejectionReason: null,
      })
    );

    const res = await api().post('/api/gpt/categorize').set(user.auth).send({ text: 'ayer gasté 45.50 en almuerzo' }).expect(200);

    expect(res.body).toMatchObject({
      isValidFinancialTransaction: true,
      categoryName: 'Alimentación',
      amountExtracted: 45.5,
      transactionTypeExtracted: 'EXPENSE',
      descriptionExtracted: 'Almuerzo',
      dateExtracted: '2000-01-01',
    });

    const request = create.mock.calls[0][0];
    expect(request.response_format).toEqual({ type: 'json_object' });
    // The user's text travels as delimited data in its own message, not inside the instructions
    expect(request.messages[1].content).toContain('<texto_usuario>');
    expect(request.messages[0].content).not.toContain('almuerzo');
  });

  it('never returns a future date', async () => {
    const user = await createUser();
    create.mockResolvedValue(
      answer({ isValidFinancialTransaction: true, confidence: 0.8, transactionType: 'INCOME', amount: 100, description: 'Pago', date: '2999-12-31', category: null, suggestedCategory: 'Bonos', rejectionReason: null })
    );
    const res = await api().post('/api/gpt/categorize').set(user.auth).send({ text: 'me pagaron 100' }).expect(200);
    expect(res.body.dateExtracted <= new Date().toISOString().slice(0, 10)).toBe(true);
    expect(res.body.suggestedCategory).toBe('Bonos');
  });

  it('answers 502 without leaking the raw model output when the JSON is invalid', async () => {
    const user = await createUser();
    create.mockResolvedValue(answer('esto no es JSON {secreto}'));
    const res = await api().post('/api/gpt/categorize').set(user.auth).send({ text: 'gasté 10 en pan' }).expect(502);
    expect(res.body.error.code).toBe('AI_BAD_RESPONSE');
    expect(JSON.stringify(res.body)).not.toContain('secreto');
  });

  it('validates the text before calling the model', async () => {
    const user = await createUser();
    await api().post('/api/gpt/categorize').set(user.auth).send({ text: 'x'.repeat(501) }).expect(400);
    await api().post('/api/gpt/categorize').set(user.auth).send({}).expect(400);
    expect(create).not.toHaveBeenCalled();
  });
});

describe('POST /ai/recommendations', () => {
  it('skips the model when the user has no data yet', async () => {
    const user = await createUser();
    const res = await api().post('/api/ai/recommendations').set(user.auth).send({}).expect(200);
    expect(res.body.recommendations).toHaveLength(1);
    expect(create).not.toHaveBeenCalled();
  });

  it('sends consistent figures and caches the result', async () => {
    const user = await createUser();
    const [food, salary] = await Promise.all([createCategory('Comida', 'EXPENSE'), createCategory('Sueldo', 'INCOME')]);
    const today = toLocalIsoDate(new Date());
    await api().post('/api/transactions').set(user.auth).send({ amount: 1000, description: 'Sueldo', categoryId: salary.id, date: today });
    await api().post('/api/transactions').set(user.auth).send({ amount: 250, description: 'Súper', categoryId: food.id, date: today });

    create.mockResolvedValue(
      answer({
        recommendations: [
          { title: 'Buen ahorro', description: 'Ahorras el 75% de tus ingresos de los últimos 30 días.', type: 'success' },
          { title: 'Controla la comida', description: 'La comida es el 100% de tu gasto reciente; fija un tope.', type: 'info' },
          { title: 'Fondo de emergencia', description: 'Destina una parte fija cada mes a un fondo de emergencia.', type: 'info' },
        ],
      })
    );

    const first = await api().post('/api/ai/recommendations').set(user.auth).send({}).expect(200);
    expect(first.body.recommendations).toHaveLength(3);

    const prompt: string = create.mock.calls[0][0].messages[1].content;
    expect(prompt).toContain('Comida: Bs 250,00 (100.0%)');
    const shares = [...prompt.matchAll(/\((\d+(?:\.\d+)?)%\)/g)].map((match) => Number(match[1]));
    expect(shares.length).toBeGreaterThan(0);
    expect(Math.max(...shares)).toBeLessThanOrEqual(100);

    const second = await api().post('/api/ai/recommendations').set(user.auth).send({ forceRefresh: true }).expect(200);
    expect(second.body.cached).toBe(true);
    expect(create).toHaveBeenCalledTimes(1);
  });
});
