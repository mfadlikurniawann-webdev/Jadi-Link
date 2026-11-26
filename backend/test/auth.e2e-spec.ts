import { randomUUID } from 'node:crypto';
import { JwtService } from '@nestjs/jwt';
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import type { User } from '@prisma/client';
import { compare } from 'bcrypt';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/common/configure-app';
import { PrismaService } from '../src/prisma/prisma.service';

interface AuthPayload {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
  user: { id: string; email: string; createdAt: string };
}

describe('Phase 2 auth HTTP tests (real bcrypt/JWT, database mocked)', () => {
  let app: NestFastifyApplication;
  let jwt: JwtService;
  let ipSequence = 0;
  let remoteAddress: string;
  const accounts = new Map<string, User>();
  const credentials = {
    email: 'owner@example.com',
    password: 'test-password-at-least-12',
  };
  const publicUser = (user: User) => ({
    id: user.id,
    email: user.email,
    createdAt: user.createdAt,
  });
  const prisma = {
    user: {
      create: jest.fn(
        ({ data }: { data: { email: string; passwordHash: string } }) => {
          if (accounts.has(data.email)) {
            return Promise.reject(
              new Prisma.PrismaClientKnownRequestError('Unique violation', {
                code: 'P2002',
                clientVersion: '7.10.1',
                meta: { target: ['email'] },
              }),
            );
          }
          const user = { ...data, id: randomUUID(), createdAt: new Date() };
          accounts.set(user.email, user);
          return Promise.resolve(publicUser(user));
        },
      ),
      findUnique: jest.fn(
        ({
          where,
          select,
        }: {
          where: { id?: string; email?: string };
          select?: unknown;
        }) => {
          const user = where.email
            ? accounts.get(where.email)
            : [...accounts.values()].find((account) => account.id === where.id);
          return Promise.resolve(
            user ? (select ? publicUser(user) : user) : null,
          );
        },
      ),
    },
  };

  const post = (url: string, payload: Record<string, unknown>) =>
    app.inject({ method: 'POST', url, payload, remoteAddress });

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();
    app = module.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
    );
    app.useLogger(false);
    await configureApp(app);
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    jwt = app.get(JwtService);
  });

  beforeEach(() => {
    accounts.clear();
    remoteAddress = `198.51.100.${++ipSequence}`;
  });

  afterAll(async () => {
    await app.close();
  });

  it('registers with a hashed password and returns a short-lived access token', async () => {
    const response = await post('/api/auth/register', credentials);
    expect(response.statusCode).toBe(201);
    expect(response.headers['cache-control']).toBe('no-store');
    const payload = response.json<AuthPayload>();
    expect(payload).toMatchObject({
      tokenType: 'Bearer',
      expiresIn: 900,
      user: { email: credentials.email },
    });
    expect(Object.keys(payload.user).sort()).toEqual([
      'createdAt',
      'email',
      'id',
    ]);
    expect(response.body).not.toContain('passwordHash');
    expect(response.body).not.toContain(credentials.password);
    const saved = accounts.get(credentials.email);
    expect(saved).toBeDefined();
    await expect(
      compare(credentials.password, saved!.passwordHash),
    ).resolves.toBe(true);
    const claims = await jwt.verifyAsync<{
      sub: string;
      exp: number;
      iat: number;
    }>(payload.accessToken);
    expect(claims.sub).toBe(payload.user.id);
    expect(claims.exp - claims.iat).toBe(900);
  });

  it('normalizes email, logs in, and uses the JWT for both profile routes', async () => {
    const registration = await post('/api/auth/register', {
      ...credentials,
      email: '  OWNER@Example.COM  ',
    });
    expect(registration.statusCode).toBe(201);
    const login = await post('/api/auth/login', credentials);
    expect(login.statusCode).toBe(200);
    const payload = login.json<AuthPayload>();
    expect(payload.user.email).toBe('owner@example.com');
    for (const url of ['/api/auth/me', '/api/users/me']) {
      const profile = await app.inject({
        method: 'GET',
        url,
        headers: { authorization: `Bearer ${payload.accessToken}` },
        remoteAddress,
      });
      expect(profile.statusCode).toBe(200);
      expect(profile.json<AuthPayload['user']>()).toEqual(payload.user);
      expect(profile.headers['cache-control']).toBe('no-store');
      expect(profile.body).not.toContain('passwordHash');
    }
  });

  it('returns 409 for a duplicate normalized email', async () => {
    expect((await post('/api/auth/register', credentials)).statusCode).toBe(
      201,
    );
    const duplicate = await post('/api/auth/register', {
      ...credentials,
      email: ' OWNER@EXAMPLE.COM ',
    });
    expect(duplicate.statusCode).toBe(409);
    expect(accounts.size).toBe(1);
    expect(duplicate.body).not.toContain('passwordHash');
  });

  it('accepts a Unicode password exactly at the 72-byte bcrypt limit', async () => {
    const unicodeCredentials = {
      ...credentials,
      password: '🔑'.repeat(18),
    };
    const registration = await post('/api/auth/register', unicodeCredentials);
    expect(registration.statusCode).toBe(201);
    expect((await post('/api/auth/login', unicodeCredentials)).statusCode).toBe(
      200,
    );
  });

  it.each([
    { email: 'not-an-email', password: credentials.password },
    { email: credentials.email, password: 'short' },
    { email: credentials.email, password: 'a'.repeat(73) },
    { email: credentials.email, password: '🔑'.repeat(19) },
    { email: credentials.email, password: 123456789012 },
    { ...credentials, role: 'admin' },
    {},
  ])('rejects invalid registration without saving: %j', async (payload) => {
    const response = await post('/api/auth/register', payload);
    expect(response.statusCode).toBe(400);
    expect(accounts.size).toBe(0);
    expect(response.body).not.toContain(credentials.password);
  });

  it('returns the same 401 message for a wrong password or nonexistent email', async () => {
    await post('/api/auth/register', credentials);
    const incorrect = await post('/api/auth/login', {
      ...credentials,
      password: 'incorrect-password-123',
    });
    const missing = await post('/api/auth/login', {
      ...credentials,
      email: 'missing@example.com',
    });
    expect(incorrect.statusCode).toBe(401);
    expect(missing.statusCode).toBe(401);
    expect(incorrect.json<{ message: string }>().message).toBe(
      'Invalid email or password',
    );
    expect(missing.json<{ message: string }>().message).toBe(
      incorrect.json<{ message: string }>().message,
    );
  });

  it('rejects unauthenticated access to protected profiles', async () => {
    for (const url of ['/api/auth/me', '/api/users/me']) {
      const response = await app.inject({ method: 'GET', url, remoteAddress });
      expect(response.statusCode).toBe(401);
    }
  });

  it('rejects expired tokens, unexpected algorithms, issuers, audiences, and signatures', async () => {
    const userId = randomUUID();
    const invalidTokens = [
      await jwt.signAsync({ sub: userId }, { expiresIn: -1 }),
      await jwt.signAsync({ sub: userId }, { algorithm: 'HS384' }),
      await jwt.signAsync({ sub: userId }, { issuer: 'another-app' }),
      await jwt.signAsync({ sub: userId }, { audience: 'another-api' }),
      await jwt.signAsync(
        { sub: userId },
        { secret: 'not-the-configured-signing-secret' },
      ),
    ];
    for (const token of invalidTokens) {
      const response = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: { authorization: `Bearer ${token}` },
        remoteAddress,
      });
      expect(response.statusCode).toBe(401);
      expect(response.json<{ message: string }>().message).toBe(
        'Invalid or expired access token',
      );
      expect(response.body).not.toContain(token);
    }
  });

  it('does not revive a deleted account with an otherwise valid JWT', async () => {
    const registration = await post('/api/auth/register', credentials);
    const { accessToken } = registration.json<AuthPayload>();
    accounts.clear();
    const response = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { authorization: `Bearer ${accessToken}` },
      remoteAddress,
    });
    expect(response.statusCode).toBe(401);
  });

  it.each([
    { route: '/api/auth/register', limit: 3 },
    { route: '/api/auth/login', limit: 5 },
  ])(
    'throttles $route after $limit attempts from one IP',
    async ({ route, limit }) => {
      for (let attempt = 0; attempt < limit; attempt++) {
        expect((await post(route, {})).statusCode).toBe(400);
      }
      const blocked = await post(route, {});
      expect(blocked.statusCode).toBe(429);
      expect(blocked.headers['retry-after']).toBeDefined();
      // Another IP must have a separate quota.
      remoteAddress = `198.51.100.${++ipSequence}`;
      expect((await post(route, {})).statusCode).toBe(400);
    },
  );
});
