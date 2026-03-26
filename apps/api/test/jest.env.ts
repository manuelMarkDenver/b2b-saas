// Jest e2e runs without loading .env; set minimal env required to boot.

process.env.NODE_ENV = process.env.NODE_ENV ?? 'test';
process.env.PORT = process.env.PORT ?? '3001';

// Uses the local Docker Postgres host port (default 5442 in this repo).
process.env.DATABASE_URL =
  process.env.DATABASE_URL ??
  'postgresql://postgres:postgres@localhost:5442/b2b_saas?schema=public';

process.env.LOG_LEVEL = process.env.LOG_LEVEL ?? 'fatal';
process.env.LOG_PRETTY = process.env.LOG_PRETTY ?? '0';
