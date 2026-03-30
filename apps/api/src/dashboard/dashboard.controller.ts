import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../common/auth/tenant.guard';
import { DashboardService } from './dashboard.service';
import type { RequestWithUser } from '../common/auth/auth.types';

@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('branches')
  getBranchBreakdown(
    @Req() req: RequestWithUser,
    @Query('from') fromStr?: string,
    @Query('to') toStr?: string,
  ) {
    const to = toStr ? new Date(toStr) : endOfDay(new Date());
    const from = fromStr ? new Date(fromStr) : subDays(to, 6);
    return this.dashboard.getBranchBreakdown({ tenantId: req.tenant!.id, from, to });
  }

  @Get()
  getSummary(
    @Req() req: RequestWithUser,
    @Query('from') fromStr?: string,
    @Query('to') toStr?: string,
  ) {
    const branchId = req.headers['x-branch-id'] as string | undefined;

    // Default: last 7 days
    const to = toStr ? new Date(toStr) : endOfDay(new Date());
    const from = fromStr ? new Date(fromStr) : subDays(to, 6);

    return this.dashboard.getSummary({
      tenantId: req.tenant!.id,
      from,
      to,
      branchId,
    });
  }
}

function endOfDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999));
}

function subDays(d: Date, days: number): Date {
  const result = new Date(d);
  result.setUTCDate(result.getUTCDate() - days);
  result.setUTCHours(0, 0, 0, 0);
  return result;
}
