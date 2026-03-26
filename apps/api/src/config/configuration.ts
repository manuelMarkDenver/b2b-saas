import type { Env } from './env.validation';

export function configuration(env: Env) {
  return {
    env: env.NODE_ENV,
    port: env.PORT,
    databaseUrl: env.DATABASE_URL,
    log: {
      level: env.LOG_LEVEL,
      pretty: env.LOG_PRETTY,
    },
    auth: {
      jwtSecret: env.JWT_SECRET,
      jwtExpiresInSeconds: env.JWT_EXPIRES_IN_SECONDS,
    },
  };
}
