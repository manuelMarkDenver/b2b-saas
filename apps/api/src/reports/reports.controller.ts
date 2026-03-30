import { Controller, Get, Query, Req, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../common/auth/tenant.guard';
import { ReportsService } from './reports.service';
import type { RequestWithUser } from '../common/auth/auth.types';

function startOfDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
}

function endOfDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999));
}

@Controller('reports')
@UseGuards(JwtAuthGuard, TenantGuard)
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('orders')
  async getOrdersReport(
    @Req() req: RequestWithUser,
    @Query('from') fromStr?: string,
    @Query('to') toStr?: string,
    @Query('format') format?: string,
    @Res({ passthrough: true }) res?: Response,
  ) {
    const branchId = req.headers['x-branch-id'] as string | undefined;

    const now = new Date();
    const to = toStr ? endOfDay(new Date(toStr)) : endOfDay(now);
    const from = fromStr ? startOfDay(new Date(fromStr)) : startOfDay(new Date(now.getFullYear(), now.getMonth(), 1));

    const orders = await this.reports.getOrdersReport({
      tenantId: req.tenant!.id,
      from,
      to,
      branchId,
    });

    if (format === 'csv') {
      const csv = this.reports.generateOrdersCsv(orders);
      const filename = `orders-report-${from.toISOString().split('T')[0]}-${to.toISOString().split('T')[0]}.csv`;
      res!.setHeader('Content-Type', 'text/csv');
      res!.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res!.send(csv);
      return;
    }

    return { data: orders, meta: { from: from.toISOString(), to: to.toISOString() } };
  }
}
