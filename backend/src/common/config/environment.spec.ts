import { validateEnvironment } from './environment';

describe('validateEnvironment', () => {
  const valid = {
    DATABASE_URL: 'postgresql://user:password@localhost:5432/jadi_link',
    FRONTEND_ORIGIN: 'http://localhost:3000',
    SHORT_LINK_BASE_URL: 'http://localhost:3001',
    JWT_SECRET: 'test-jwt-secret-that-is-long-enough',
    VISITOR_HASH_SECRET: 'test-visitor-secret-that-is-long-enough',
  };

  it('applies defaults and converts numeric environment variables', () => {
    expect(validateEnvironment({ ...valid, PORT: '4000' })).toMatchObject({
      PORT: 4000,
      DATABASE_POOL_MAX: 5,
      NODE_ENV: 'development',
    });
  });

  it.each([
    { DATABASE_URL: 'https://not-postgres.example' },
    { JWT_SECRET: 'short' },
    { FRONTEND_ORIGIN: '*' },
    { FRONTEND_ORIGIN: 'http://localhost:3000/dashboard' },
    { SHORT_LINK_BASE_URL: 'javascript:alert(1)' },
    { PORT: 'not-a-number' },
    { TRUST_PROXY: '*' },
    { TRUST_PROXY: '0.0.0.0/0' },
    { TRUST_PROXY: '::/0' },
    { TRUST_PROXY: 'not-an-ip' },
    { TRUST_PROXY: 'fe80::1%eth0' },
    { DATABASE_POOL_MAX: '100' },
  ])('rejects invalid config without exposing values: %j', (override) => {
    expect(() => validateEnvironment({ ...valid, ...override })).toThrow(
      'Invalid environment variables:',
    );
    try {
      validateEnvironment({ ...valid, ...override });
    } catch (error) {
      expect((error as Error).message).not.toContain('user:password');
    }
  });

  it('rejects insecure production configuration', () => {
    expect(() =>
      validateEnvironment({
        ...valid,
        NODE_ENV: 'production',
        JWT_SECRET: 'replace-with-a-random-secret-at-least-32-characters',
      }),
    ).toThrow('Invalid environment variables:');
  });

  it('allows a specific proxy CIDR and an optional direct database URL', () => {
    expect(
      validateEnvironment({
        ...valid,
        DIRECT_URL: '',
        TRUST_PROXY: '127.0.0.1,::1,10.0.0.0/24',
      }),
    ).toMatchObject({ DIRECT_URL: undefined });
  });

  it('requires the database URL and secrets', () => {
    expect(() => validateEnvironment({})).toThrow(
      'Invalid environment variables:',
    );
  });
});
