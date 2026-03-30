import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

export interface OrdersReportQuery {
  tenantId: string;
  from: Date;
  to: Date;
  branchId?: string;
}

export interface OrderReportRow {
  id: string;
  createdAt: Date;
  customerRef: string | null;
  totalCents: number;
  status: string;
  itemCount: number;
  branchName: string | null;
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getOrdersReport({ tenantId, from, to, branchId }: OrdersReportQuery) {
    const branchFilter = branchId ? { branchId } : {};

    const orders = await this.prisma.order.findMany({
      where: {
        tenantId,
        ...branchFilter,
        createdAt: { gte: from, lte: to },
      },
      orderBy: { createdAt: 'desc' },
      take: 1000,
      include: {
        items: { select: { quantity: true } },
        branch: { select: { name: true } },
      },
    });

    return orders.map((order): OrderReportRow => ({
      id: order.id,
      createdAt: order.createdAt,
      customerRef: order.customerRef,
      totalCents: order.totalCents,
      status: order.status,
      itemCount: order.items.reduce((sum, i) => sum + i.quantity, 0),
      branchName: order.branch?.name ?? null,
    }));
  }

  generateOrdersCsv(orders: OrderReportRow[]): string {
    const headers = ['Order ID', 'Date', 'Customer Ref', 'Total (₱)', 'Status', 'Item Count', 'Branch'];
    const rows = orders.map((o) => [
      o.id,
      o.createdAt.toISOString().split('T')[0],
      o.customerRef ?? '',
      (o.totalCents / 100).toFixed(2),
      o.status,
      o.itemCount.toString(),
      o.branchName ?? '',
    ]);

    const csvContent = [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n');
    return csvContent;
  }
}
