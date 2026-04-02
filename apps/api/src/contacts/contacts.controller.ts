import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ContactType } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../common/auth/tenant.guard';
import type { RequestWithUser } from '../common/auth/auth.types';
import { ContactsService } from './contacts.service';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';

@Controller('contacts')
@UseGuards(JwtAuthGuard, TenantGuard)
export class ContactsController {
  constructor(private readonly contacts: ContactsService) {}

  @Post()
  create(@Req() req: RequestWithUser, @Body() dto: CreateContactDto) {
    return this.contacts.create(req.tenant!.id, req.membership!.role, dto);
  }

  @Get()
  list(
    @Req() req: RequestWithUser,
    @Query('page') page = '1',
    @Query('limit') limit = '50',
    @Query('type') type?: ContactType,
    @Query('search') search?: string,
    @Query('isActive') isActive?: string,
  ) {
    const active = isActive === undefined ? undefined : isActive !== 'false';
    return this.contacts.list(req.tenant!.id, +page, +limit, type, search, active);
  }

  @Get('ar-overview')
  arOverview(@Req() req: RequestWithUser) {
    return this.contacts.getArOverview(req.tenant!.id, req.membership!.role);
  }

  @Get(':id')
  get(@Req() req: RequestWithUser, @Param('id') id: string) {
    return this.contacts.get(req.tenant!.id, id);
  }

  @Get(':id/ar')
  arSummary(@Req() req: RequestWithUser, @Param('id') id: string) {
    return this.contacts.getArSummary(req.tenant!.id, req.membership!.role, id);
  }

  @Patch(':id')
  update(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Body() dto: UpdateContactDto,
  ) {
    return this.contacts.update(req.tenant!.id, req.membership!.role, id, dto);
  }
}
