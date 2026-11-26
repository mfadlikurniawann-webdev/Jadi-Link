// Tests never use the developer's Neon connection or local .env credentials.
Object.assign(process.env, {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://test:test@127.0.0.1:1/not_a_real_database',
  DIRECT_URL: 'postgresql://test:test@127.0.0.1:1/not_a_real_database',
  FRONTEND_ORIGIN: 'http://localhost:3000',
  SHORT_LINK_BASE_URL: 'http://localhost:3001',
  TRUST_PROXY: '127.0.0.1,::1',
  JWT_SECRET: 'test-jwt-secret-that-is-long-enough',
  VISITOR_HASH_SECRET: 'test-visitor-secret-that-is-long-enough',
});
