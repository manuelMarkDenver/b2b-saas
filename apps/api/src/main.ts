import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
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

  app.use(requestIdMiddleware);
  app.use(requestLoggerMiddleware(logger));
  app.useGlobalFilters(new HttpExceptionFilter());
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
