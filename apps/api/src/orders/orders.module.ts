import { Module } from '@nestjs/common';
import { PrismaModule } from '../common/prisma/prisma.module';
import { FeatureFlagGuard } from '../common/auth/feature-flag.guard';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [PrismaModule],
  controllers: [OrdersController],
  providers: [OrdersService, FeatureFlagGuard],
  exports: [OrdersService],
})
export class OrdersModule {}
