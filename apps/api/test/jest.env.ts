// Jest e2e runs without loading .env; set minimal env required to boot.

process.env.NODE_ENV = process.env.NODE_ENV ?? 'test';
process.env.PORT = process.env.PORT ?? '3001';

// E2E tests use a separate test database to avoid polluting dev data.
// Run: createdb -U postgres -p 5442 b2b_saas_test (once, to create it)
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  'postgresql://postgres:postgres@localhost:5442/b2b_saas_test?schema=public';

process.env.LOG_LEVEL = process.env.LOG_LEVEL ?? 'fatal';
process.env.LOG_PRETTY = process.env.LOG_PRETTY ?? '0';
process.env.JWT_SECRET =
  process.env.JWT_SECRET ?? 'test_secret_32_chars_minimum';
process.env.JWT_EXPIRES_IN_SECONDS =
  process.env.JWT_EXPIRES_IN_SECONDS ?? '3600';
