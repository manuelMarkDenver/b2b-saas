import { Module } from '@nestjs/common';
import { PrismaModule } from '../common/prisma/prisma.module';
import { TenantController } from './tenant.controller';

@Module({
  imports: [PrismaModule],
  controllers: [TenantController],
})
export class TenantModule {}
