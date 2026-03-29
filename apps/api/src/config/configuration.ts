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
    throttle: {
      ttl: env.THROTTLE_TTL,
      limit: env.THROTTLE_LIMIT,
    },
    corsAllowedOrigins: env.CORS_ALLOWED_ORIGINS,
    smtp: {
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
      from: env.SMTP_FROM,
    },
    appBaseUrl: env.APP_BASE_URL,
  };
}
