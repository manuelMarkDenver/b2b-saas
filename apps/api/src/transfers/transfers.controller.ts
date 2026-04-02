import { Body, Controller, ForbiddenException, Get, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../common/auth/tenant.guard';
import type { RequestWithUser } from '../common/auth/auth.types';
import { TransfersService } from './transfers.service';
import { CreateTransferDto } from './dto/create-transfer.dto';

@Controller('transfers')
@UseGuards(JwtAuthGuard, TenantGuard)
export class TransfersController {
  constructor(private readonly transfersService: TransfersService) {}

  @Get()
  list(@Req() req: RequestWithUser) {
    return this.transfersService.list(req.tenant!.id);
  }

  @Post()
  create(@Req() req: RequestWithUser, @Body() dto: CreateTransferDto) {
    const role = req.membership!.role;
    if (role !== 'OWNER' && role !== 'ADMIN') {
      throw new ForbiddenException('Only OWNER or ADMIN can create stock transfers');
    }
    return this.transfersService.create(req.tenant!.id, req.user!.id, dto);
  }
}
