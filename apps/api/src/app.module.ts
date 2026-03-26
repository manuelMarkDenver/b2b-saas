import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { LoggerModule } from './common/logging/logger.module';
import { PrismaModule } from './common/prisma/prisma.module';
import { ConfigModule } from './config/config.module';
import { HealthModule } from './health/health.module';
import { MembershipsModule } from './memberships/memberships.module';
import { TenantsModule } from './tenants/tenants.module';
import { UsersModule } from './users/users.module';
import { TenantModule } from './tenant/tenant.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    ConfigModule,
    LoggerModule,
    PrismaModule,
    HealthModule,
    UsersModule,
    AuthModule,
    TenantsModule,
    MembershipsModule,
    TenantModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
