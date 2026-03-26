import { NestFactory } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import type { Logger as PinoLogger } from "pino";
import { AppModule } from "./app.module";
import { PINO } from "./common/logging/logger.module";
import { HttpExceptionFilter } from "./common/http/http-exception.filter";
import { requestIdMiddleware } from "./common/http/request-id.middleware";
import { requestLoggerMiddleware } from "./common/http/request-logger.middleware";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const logger = app.get<PinoLogger>(PINO);

  app.use(requestIdMiddleware);
  app.use(requestLoggerMiddleware(logger));
  app.useGlobalFilters(new HttpExceptionFilter());

  const port = config.get<number>("port") ?? 3001;
  await app.listen(port);
  logger.info({ port }, "API listening");
}
bootstrap();
