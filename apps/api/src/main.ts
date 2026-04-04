import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import * as express from 'express';
import * as path from 'path';
import * as fs from 'fs';
import type { Logger as PinoLogger } from 'pino';
import { HttpExceptionFilter } from './common/http/http-exception.filter';
import { requestIdMiddleware } from './common/http/request-id.middleware';
import { requestLoggerMiddleware } from './common/http/request-logger.middleware';
import { PINO } from './common/logging/logger.module';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const logger = app.get<PinoLogger>(PINO);

  app.use(helmet());

  // Serve local uploads as static files (local storage only — S3 serves from CDN)
  const uploadsDir = path.join(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
  app.use('/uploads', express.static(uploadsDir));

  app.use(requestIdMiddleware);
  app.use(requestLoggerMiddleware(logger));
  app.useGlobalFilters(new HttpExceptionFilter());

  const rawOrigins = config.get<string>('corsAllowedOrigins');
  // Browser "Origin" never includes a trailing slash; normalize config input to avoid
  // accidental mismatches (e.g. "https://foo.vercel.app/" or "https://foo.vercel.app/login").
  const allowedOrigins = rawOrigins
    ? rawOrigins
        .split(',')
        .map((o) => o.trim())
        .map((o) => {
          if (!o) return '';
          // If a full URL is provided, reduce it to origin so paths don't break matching.
          if (o.includes('://')) {
            try {
              return new URL(o).origin;
            } catch {
              // fall through and keep best-effort normalization
            }
          }
          return o.replace(/\/+$/, '');
        })
        .filter(Boolean)
    : [];
  app.enableCors({
    origin:
      allowedOrigins.length > 0
        ? allowedOrigins
        : config.get('env') === 'development'
          ? true
          : false,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidUnknownValues: true,
    }),
  );

  const port = config.get<number>('port') ?? 3001;
  await app.listen(port);
  logger.info({ port }, 'API listening');
}

void bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
