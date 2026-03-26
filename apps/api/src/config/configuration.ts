import type { Env } from "./env.validation";

export function configuration(env: Env) {
  return {
    env: env.NODE_ENV,
    port: env.PORT,
    databaseUrl: env.DATABASE_URL,
    log: {
      level: env.LOG_LEVEL,
      pretty: env.LOG_PRETTY,
    },
  };
}
