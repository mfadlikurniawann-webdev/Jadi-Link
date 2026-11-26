import { Test } from '@nestjs/testing';
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/common/configure-app';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Phase 1 HTTP smoke test (database mocked)', () => {
  let app: NestFastifyApplication;
  const queryRaw = jest.fn();

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({
        $queryRaw: queryRaw,
        link: { findUnique: jest.fn().mockResolvedValue(null) },
      })
      .compile();
    app = module.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
    );
    // The intentional 503 case is asserted below; do not print a scary error log.
    app.useLogger(false);
    await configureApp(app);
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/health returns status and security headers', async () => {
    queryRaw.mockResolvedValue([{ '?column?': 1 }]);
    const response = await app.inject({ method: 'GET', url: '/api/health' });
    expect(response.statusCode).toBe(200);
    expect(response.json<{ status: string }>()).toMatchObject({
      status: 'ok',
      database: 'up',
    });
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-powered-by']).toBeUndefined();
  });

  it('returns a consistent 503 when the database fails', async () => {
    queryRaw.mockRejectedValue(new Error('private database error'));
    const response = await app.inject({ method: 'GET', url: '/api/health' });
    expect(response.statusCode).toBe(503);
    expect(response.json<{ statusCode: number }>()).toMatchObject({
      statusCode: 503,
      message: 'Database is unavailable',
      path: '/api/health',
      requestId: expect.any(String) as string,
    });
    expect(response.body).not.toContain('private database error');
  });

  it('does not expose health without the API prefix', async () => {
    const response = await app.inject({ method: 'GET', url: '/health' });
    expect(response.statusCode).toBe(404);
  });

  it('never echoes query string secrets in the default 404 response', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/missing?token=private-token',
    });
    expect(response.statusCode).toBe(404);
    expect(response.body).not.toContain('private-token');
  });

  it('sets CORS origin only to the configured frontend', async () => {
    const response = await app.inject({
      method: 'OPTIONS',
      url: '/api/health',
      headers: {
        origin: 'https://untrusted.example',
        'access-control-request-method': 'GET',
      },
    });
    expect(response.headers['access-control-allow-origin']).toBe(
      'http://localhost:3000',
    );
    expect(response.headers['access-control-allow-origin']).not.toBe(
      'https://untrusted.example',
    );
  });
});
