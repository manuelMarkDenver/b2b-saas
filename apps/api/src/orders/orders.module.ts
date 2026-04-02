import { Module } from '@nestjs/common';
import { PrismaModule } from '../common/prisma/prisma.module';
import { FeatureFlagGuard } from '../common/auth/feature-flag.guard';
import { NotificationsModule } from '../notifications/notifications.module';
import { PaymentsModule } from '../payments/payments.module';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [PrismaModule, NotificationsModule, PaymentsModule],
  controllers: [OrdersController],
  providers: [OrdersService, FeatureFlagGuard],
  exports: [OrdersService],
})
export class OrdersModule {}
