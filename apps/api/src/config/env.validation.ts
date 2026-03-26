import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_URL: z.string().min(1),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace'])
    .default('info'),
  LOG_PRETTY: z.coerce.boolean().optional().default(false),
  JWT_SECRET: z.string().min(16),
  JWT_EXPIRES_IN_SECONDS: z.coerce.number().int().positive().default(604800),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(raw: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    console.error(
      'Invalid environment variables',
      parsed.error.flatten().fieldErrors,
    );
    throw new Error('Invalid environment variables');
  }
  return parsed.data;
}
