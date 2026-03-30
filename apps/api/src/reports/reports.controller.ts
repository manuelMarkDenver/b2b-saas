import { Controller, Get, Query, Req, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../common/auth/tenant.guard';
import { ReportsService } from './reports.service';
import type { RequestWithUser } from '../common/auth/auth.types';

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
    @Res() res?: Response,
  ) {
    const branchId = req.headers['x-branch-id'] as string | undefined;

    const now = new Date();
    const to = toStr ? new Date(toStr) : now;
    const from = fromStr ? new Date(fromStr) : new Date(now.getFullYear(), now.getMonth(), 1);

    const orders = await this.reports.getOrdersReport({
      tenantId: req.tenant!.id,
      from,
      to,
      branchId,
    });

    if (format === 'csv') {
      const csv = this.reports.generateOrdersCsv(orders);
      const filename = `orders-report-${from.toISOString().split('T')[0]}-${to.toISOString().split('T')[0]}.csv`;

      res?.setHeader('Content-Type', 'text/csv');
      res?.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res?.send(csv);
      return;
    }

    return { data: orders, meta: { from: from.toISOString(), to: to.toISOString() } };
  }
}
