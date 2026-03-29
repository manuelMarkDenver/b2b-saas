import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../common/auth/tenant.guard';
import { MembershipsService } from './memberships.service';
import { CurrentUser } from '../common/auth/current-user.decorator';
import type { AuthUser, RequestWithUser } from '../common/auth/auth.types';
import { SwitchTenantDto } from './dto/switch-tenant.dto';
import { AuthService } from '../auth/auth.service';

@Controller('memberships')
@UseGuards(JwtAuthGuard)
export class MembershipsController {
  constructor(
    private readonly membershipsService: MembershipsService,
    private readonly authService: AuthService,
  ) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.membershipsService.listForUser(user.id);
  }

  @Get('team')
  @UseGuards(TenantGuard)
  listTeam(@Req() req: RequestWithUser) {
    return this.membershipsService.listTeamMembers(req.tenant!.id);
  }

  @Post('switch')
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
}
