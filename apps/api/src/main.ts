import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
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
  app.use(requestIdMiddleware);
  app.use(requestLoggerMiddleware(logger));
  app.useGlobalFilters(new HttpExceptionFilter());

  const rawOrigins = config.get<string>('corsAllowedOrigins');
  const allowedOrigins = rawOrigins
    ? rawOrigins.split(',').map((o) => o.trim())
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
