import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../common/auth/tenant.guard';
import { MembershipsService } from './memberships.service';
import { CurrentUser } from '../common/auth/current-user.decorator';
import type { AuthUser, RequestWithUser } from '../common/auth/auth.types';
import { SwitchTenantDto } from './dto/switch-tenant.dto';
import { InviteStaffDto } from './dto/invite-staff.dto';
import { AcceptInviteDto } from './dto/accept-invite.dto';
import { UpdateMembershipDto } from './dto/update-membership.dto';
import { AddDirectStaffDto } from './dto/add-direct-staff.dto';
import { AuthService } from '../auth/auth.service';

@Controller('memberships')
export class MembershipsController {
  constructor(
    private readonly membershipsService: MembershipsService,
    private readonly authService: AuthService,
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  list(@CurrentUser() user: AuthUser) {
    return this.membershipsService.listForUser(user.id);
  }

  @Get('team')
  @UseGuards(JwtAuthGuard, TenantGuard)
  listTeam(@Req() req: RequestWithUser) {
    return this.membershipsService.listTeamMembers(req.tenant!.id);
  }

  @Post('switch')
  @UseGuards(JwtAuthGuard)
  async switchTenant(
    @CurrentUser() user: AuthUser,
    @Body() body: SwitchTenantDto,
  ) {
    const { tenant } = await this.membershipsService.ensureActiveMembership(
      user.id,
      body.tenantSlug,
    );

    return {
      activeTenantId: tenant.id,
      token: this.authService.signToken(user, tenant.id),
    };
  }

  @Post('invite')
  @UseGuards(JwtAuthGuard, TenantGuard)
  inviteStaff(@Req() req: RequestWithUser, @Body() body: InviteStaffDto) {
    return this.membershipsService.inviteStaff(
      req.tenant!.id,
      req.user.id,
      body.email,
      body.role ?? 'STAFF',
      body.jobTitle,
    );
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, TenantGuard)
  updateMembership(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Body() body: UpdateMembershipDto,
  ) {
    return this.membershipsService.updateMembership(
      req.tenant!.id,
      req.user.id,
      id,
      body,
    );
  }

  @Post('add-direct')
  @UseGuards(JwtAuthGuard, TenantGuard)
  addDirect(@Req() req: RequestWithUser, @Body() body: AddDirectStaffDto) {
    return this.membershipsService.addDirectStaff(
      req.tenant!.id,
      req.user.id,
      body.identifier,
      body.role ?? 'STAFF',
      body.password,
      body.jobTitle,
    );
  }

  @Post('accept-invite')
  @HttpCode(200)
  acceptInvite(@Body() body: AcceptInviteDto) {
    return this.membershipsService.acceptInvite(body.token, body.password);
  }
}
