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
    appFrontendUrl: env.APP_FRONTEND_URL,
    storage: {
      type: env.STORAGE_TYPE,
      aws: {
        region: env.AWS_REGION,
        accessKeyId: env.AWS_ACCESS_KEY_ID,
        secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
        bucket: env.AWS_S3_BUCKET,
        publicUrl: env.AWS_S3_PUBLIC_URL,
        endpoint: env.AWS_S3_ENDPOINT,
      },
    },
  };
}
