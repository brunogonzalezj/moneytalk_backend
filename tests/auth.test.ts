import { api, createUser, prisma, resetDatabase } from './helpers';

beforeEach(resetDatabase);
afterAll(() => prisma.$disconnect());

describe('signup', () => {
  it('creates the account with the `name` the frontend sends', async () => {
    const res = await api()
      .post('/api/auth/signup')
      .send({ name: 'Ana Pérez', email: 'ana@test.com', password: 'Clave1234' })
      .expect(201);

    expect(res.body.user).toMatchObject({ email: 'ana@test.com', name: 'Ana Pérez' });
    expect(res.body.accessToken).toEqual(expect.any(String));
    expect(res.body.refreshToken).toEqual(expect.any(String));
  });

  it('still accepts the older `displayName` field', async () => {
    const res = await api()
      .post('/api/auth/signup')
      .send({ displayName: 'Luis', email: 'luis@test.com', password: 'Clave1234' })
      .expect(201);
    expect(res.body.user.name).toBe('Luis');
  });

  it('returns 409 for an email that is already registered', async () => {
    await createUser({ email: 'dup@test.com' });
    const res = await api()
      .post('/api/auth/signup')
      .send({ name: 'Otro', email: 'dup@test.com', password: 'Clave1234' })
      .expect(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('validates email and password strength', async () => {
    const res = await api().post('/api/auth/signup').send({ name: 'X', email: 'no-es-email', password: '123' }).expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    const fields = res.body.error.details.map((d: { field: string }) => d.field);
    expect(fields).toEqual(expect.arrayContaining(['email', 'password']));
  });
});

describe('login', () => {
  it('returns 401 (not 500) for wrong credentials', async () => {
    await createUser({ email: 'login@test.com', password: 'Clave1234' });
    const res = await api().post('/api/auth/login').send({ email: 'login@test.com', password: 'Incorrecta1' }).expect(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('signs in with valid credentials and keeps other sessions alive', async () => {
    const user = await createUser({ email: 'multi@test.com', password: 'Clave1234' });
    await api().post('/api/auth/login').send({ email: 'multi@test.com', password: 'Clave1234' }).expect(200);

    // The first session's refresh token still works after a second login
    await api().post('/api/auth/refresh').send({ refreshToken: user.refreshToken }).expect(200);
  });
});

describe('refresh and logout', () => {
  it('rotates the refresh token and rejects the old one', async () => {
    const user = await createUser();
    const res = await api().post('/api/auth/refresh').send({ refreshToken: user.refreshToken }).expect(200);

    expect(res.body.refreshToken).not.toBe(user.refreshToken);
    await api().post('/api/auth/refresh').send({ refreshToken: user.refreshToken }).expect(401);
    await api().post('/api/auth/refresh').send({ refreshToken: res.body.refreshToken }).expect(200);
  });

  it('logout invalidates the refresh token, even without an access token', async () => {
    const user = await createUser();
    await api().post('/api/auth/logout').send({ refreshToken: user.refreshToken }).expect(204);
    const res = await api().post('/api/auth/refresh').send({ refreshToken: user.refreshToken }).expect(401);
    expect(res.body.error.code).toBe('REFRESH_INVALID');
  });
});

describe('protected routes', () => {
  it('requires a valid access token', async () => {
    await api().get('/api/auth/me').expect(401);
    await api().get('/api/auth/me').set('Authorization', 'Bearer basura').expect(401);
  });

  it('returns the current user', async () => {
    const user = await createUser({ name: 'Yo' });
    const res = await api().get('/api/auth/me').set(user.auth).expect(200);
    expect(res.body.user).toMatchObject({ id: user.id, name: 'Yo', email: user.email });
  });
});

describe('change password', () => {
  it('rejects a wrong current password with 400', async () => {
    const user = await createUser();
    const res = await api()
      .put('/api/auth/change-password')
      .set(user.auth)
      .send({ currentPassword: 'Incorrecta1', newPassword: 'NuevaClave1' })
      .expect(400);
    expect(res.body.error.code).toBe('INVALID_PASSWORD');
  });

  it('changes it and signs out other sessions', async () => {
    const user = await createUser();
    await api()
      .put('/api/auth/change-password')
      .set(user.auth)
      .send({ currentPassword: user.password, newPassword: 'NuevaClave1' })
      .expect(204);
    await api().post('/api/auth/refresh').send({ refreshToken: user.refreshToken }).expect(401);
    await api().post('/api/auth/login').send({ email: user.email, password: 'NuevaClave1' }).expect(200);
  });
});

describe('delete account', () => {
  it('needs the password and then removes the user and their data', async () => {
    const user = await createUser();
    const category = await prisma.category.create({ data: { name: 'Comida', type: 'EXPENSE' } });
    await api()
      .post('/api/transactions')
      .set(user.auth)
      .send({ amount: 10, description: 'Pan', date: '2026-01-10', categoryId: category.id })
      .expect(201);

    await api().delete('/api/auth/account').set(user.auth).send({ password: 'Incorrecta1' }).expect(400);
    await api().delete('/api/auth/account').set(user.auth).send({ password: user.password }).expect(204);

    expect(await prisma.user.findUnique({ where: { id: user.id } })).toBeNull();
    expect(await prisma.transaction.count({ where: { userId: user.id } })).toBe(0);
  });
});
