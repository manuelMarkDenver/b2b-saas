import { Module } from '@nestjs/common';
import { LoggerModule } from './common/logging/logger.module';
import { PrismaModule } from './common/prisma/prisma.module';
import { ConfigModule } from './config/config.module';
import { HealthModule } from './health/health.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [ConfigModule, LoggerModule, PrismaModule, HealthModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
