import { api, prisma } from './helpers';

afterAll(() => prisma.$disconnect());

describe('app', () => {
  it('responds to the health check', async () => {
    await api().get('/api/health').expect(200, { status: 'ok' });
  });

  it('returns unknown routes as 404 in the uniform error shape', async () => {
    const res = await api().get('/api/no-existe').expect(404);
    expect(res.body).toEqual({ error: { code: 'NOT_FOUND', message: expect.stringContaining('/api/no-existe') } });
  });

  it('rejects malformed JSON with 400 instead of 500', async () => {
    const res = await api()
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email": ')
      .expect(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
  });

  it('exposes Content-Disposition to the browser for exports', async () => {
    const res = await api().get('/api/health').set('Origin', 'http://localhost:5173').expect(200);
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    expect(res.headers['access-control-expose-headers']).toContain('Content-Disposition');
  });
});
