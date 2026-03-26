import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { ConfigModule } from "./config/config.module";
import { LoggerModule } from "./common/logging/logger.module";
import { PrismaModule } from "./common/prisma/prisma.module";
import { HealthModule } from "./health/health.module";

@Module({
  imports: [ConfigModule, LoggerModule, PrismaModule, HealthModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
