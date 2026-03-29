import {
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../common/auth/tenant.guard';
import type { RequestWithUser } from '../common/auth/auth.types';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
@UseGuards(JwtAuthGuard, TenantGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  list(@Req() req: RequestWithUser) {
    return this.notificationsService.listForUser(req.user.id, req.tenant!.id);
  }

  @Patch(':id/read')
  markRead(@Req() req: RequestWithUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.notificationsService.markRead(req.user.id, req.tenant!.id, id);
  }

  @Patch('read-all')
  markAllRead(@Req() req: RequestWithUser) {
    return this.notificationsService.markAllRead(req.user.id, req.tenant!.id);
  }

  @Delete(':id')
  dismiss(@Req() req: RequestWithUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.notificationsService.dismiss(req.user.id, req.tenant!.id, id);
  }
}
