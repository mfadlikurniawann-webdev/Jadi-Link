import { ConfigService } from '@nestjs/config';
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify';
import type {
  OpenAPIObject,
  SchemaObject,
} from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import type { EnvironmentVariables } from '../src/common/config/environment';
import { configureApp } from '../src/common/configure-app';
import { PrismaService } from '../src/prisma/prisma.service';

async function createApp(production = false): Promise<NestFastifyApplication> {
  const builder = Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(PrismaService)
    .useValue({
      $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
      link: { findUnique: jest.fn().mockResolvedValue(null) },
    });
  if (production) {
    builder.overrideProvider(ConfigService).useValue(
      new ConfigService<EnvironmentVariables, true>({
        ...process.env,
        NODE_ENV: 'production',
        FRONTEND_ORIGIN: 'https://app.example.com',
        SHORT_LINK_BASE_URL: 'https://s.example.com',
        JWT_EXPIRES_IN_SECONDS: 900,
      }),
    );
  }
  const module = await builder.compile();
  const app = module.createNestApplication<NestFastifyApplication>(
    new FastifyAdapter(),
  );
  app.useLogger(false);
  await configureApp(app);
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
  return app;
}

describe('Development Swagger HTTP contract', () => {
  let app: NestFastifyApplication;
  let document: OpenAPIObject;
  beforeAll(async () => {
    app = await createApp();
    const response = await app.inject({
      method: 'GET',
      url: '/docs/openapi.json',
    });
    expect(response.statusCode).toBe(200);
    document = response.json<OpenAPIObject>();
  });
  afterAll(async () => {
    await app.close();
  });

  it('serves UI and local assets without a token', async () => {
    const html = await app.inject({ method: 'GET', url: '/docs' });
    expect(html.statusCode).toBe(200);
    expect(html.headers['content-type']).toContain('text/html');
    expect(html.body).toContain('swagger-ui');
    expect(html.headers['content-security-policy']).toBeDefined();
    const script = await app.inject({
      method: 'GET',
      url: '/docs/swagger-ui-bundle.js',
    });
    expect(script.statusCode).toBe(200);
    expect(script.headers['content-type']).toContain('javascript');
  });

  it('documents the API prefix and only the public redirect without that prefix', () => {
    expect(document.info.title).toBe('Jadi Link API');
    expect(document.paths['/api/health']?.get).toBeDefined();
    expect(document.paths['/api/links']?.get).toBeDefined();
    expect(document.paths['/api/links/{id}/analytics']?.get).toBeDefined();
    expect(document.paths['/{code}']?.get).toBeDefined();
    expect(document.paths['/api/{code}']).toBeUndefined();
  });

  it('requires bearer auth on private operations, not register/login/health/redirect', () => {
    expect(document.paths['/api/links']?.post?.security).toEqual([
      { 'access-token': [] },
    ]);
    expect(document.paths['/api/links/{id}/analytics']?.get?.security).toEqual([
      { 'access-token': [] },
    ]);
    expect(document.paths['/api/auth/me']?.get?.security).toEqual([
      { 'access-token': [] },
    ]);
    expect(document.paths['/api/users/me']?.get?.security).toEqual([
      { 'access-token': [] },
    ]);
    for (const operation of [
      document.paths['/api/auth/register']?.post,
      document.paths['/api/auth/login']?.post,
      document.paths['/api/health']?.get,
      document.paths['/{code}']?.get,
    ]) {
      expect(operation).toBeDefined();
      expect(operation?.security ?? []).toEqual([]);
    }
  });

  it('documents nested DTOs, password write-only rules, nullable expiry, and immutable fields', () => {
    const schemas = document.components!.schemas!;
    const user = schemas['UserResponseDto'] as SchemaObject;
    expect(Object.keys(user.properties!).sort()).toEqual([
      'createdAt',
      'email',
      'id',
    ]);
    const registration = schemas['RegisterDto'] as SchemaObject;
    expect(registration.properties?.['password']).toMatchObject({
      writeOnly: true,
      example: 'development-only-password-123',
      minLength: 12,
      maxLength: 72,
    });
    const create = schemas['CreateLinkDto'] as SchemaObject;
    expect(create.required).toEqual(['targetUrl']);
    expect(create.properties?.['expiresAt']).toMatchObject({
      nullable: true,
      format: 'date-time',
    });
    const update = schemas['UpdateLinkDto'] as SchemaObject;
    expect(update.properties).not.toHaveProperty('alias');
    expect(update.properties).not.toHaveProperty('code');
    expect(update.properties).not.toHaveProperty('userId');
    const analytics = schemas['AnalyticsResponseDto'] as SchemaObject;
    expect(analytics.properties?.['dailyClicks']).toMatchObject({
      type: 'array',
      minItems: 30,
      maxItems: 30,
    });
    expect(analytics.properties).not.toHaveProperty('visitorHash');
  });

  it('documents redirect headers, empty delete and consistent errors', () => {
    expect(document.paths['/{code}']?.get?.responses['302']).toMatchObject({
      headers: { Location: { schema: { type: 'string', format: 'uri' } } },
    });
    expect(
      document.paths['/api/links/{id}']?.delete?.responses['204'],
    ).toBeDefined();
    expect(document.paths['/{code}']?.get?.responses['200']).toBeUndefined();
    expect(
      document.paths['/api/links/{id}']?.patch?.responses['404'],
    ).toMatchObject({
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/HttpErrorResponseDto' },
        },
      },
    });
  });
});

describe('Production Swagger exclusion', () => {
  let app: NestFastifyApplication;
  beforeAll(async () => {
    app = await createApp(true);
  });
  afterAll(async () => {
    await app.close();
  });

  it.each([
    '/docs',
    '/docs/',
    '/docs/openapi.json',
    '/docs/swagger-ui-bundle.js',
    '/docs/swagger-ui.css',
  ])('does not register %s in production', async (url) => {
    expect((await app.inject({ method: 'GET', url })).statusCode).toBe(404);
  });

  it('keeps health and protected API routes working with docs disabled', async () => {
    expect(
      (await app.inject({ method: 'GET', url: '/api/health' })).statusCode,
    ).toBe(200);
    expect(
      (await app.inject({ method: 'GET', url: '/api/links' })).statusCode,
    ).toBe(401);
  });
});
