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

  async getPaymentsReport({ tenantId, from, to, branchId }: OrdersReportQuery) {
    const payments = await this.prisma.payment.findMany({
      where: {
        tenantId,
        createdAt: { gte: from, lte: to },
        ...(branchId ? { order: { branchId } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 1000,
      include: {
        order: { select: { id: true, status: true, totalCents: true, customerRef: true } },
      },
    });
    return payments.map((p) => ({
      id: p.id,
      orderId: p.orderId,
      amountCents: p.amountCents,
      status: p.status,
      proofUrl: p.proofUrl,
      createdAt: p.createdAt,
      orderStatus: p.order.status,
      orderTotalCents: p.order.totalCents,
      customerRef: p.order.customerRef,
    }));
  }

  async getInventoryReport({ tenantId, from, to }: OrdersReportQuery) {
    const movements = await this.prisma.inventoryMovement.findMany({
      where: { tenantId, createdAt: { gte: from, lte: to } },
      orderBy: { createdAt: 'desc' },
      take: 1000,
      include: {
        sku: {
          select: {
            code: true, name: true, stockOnHand: true,
            product: { select: { category: { select: { name: true } } } },
          },
        },
      },
    });
    return movements.map((m) => ({
      id: m.id,
      skuCode: m.sku.code,
      skuName: m.sku.name,
      category: m.sku.product.category.name,
      type: m.type,
      quantity: m.quantity,
      approvalStatus: m.approvalStatus,
      note: m.note,
      reason: m.reason,
      createdAt: m.createdAt,
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
