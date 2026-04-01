import { Module } from '@nestjs/common';
import { PrismaModule } from '../common/prisma/prisma.module';
import { FeatureFlagGuard } from '../common/auth/feature-flag.guard';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [PrismaModule, NotificationsModule],
  controllers: [InventoryController],
  providers: [InventoryService, FeatureFlagGuard],
  exports: [InventoryService],
})
export class InventoryModule {}
