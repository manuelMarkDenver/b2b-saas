import { Injectable } from '@nestjs/common';
import { OrderStatus, PaymentStatus } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';

export interface DashboardQuery {
  tenantId: string;
  from: Date;
  to: Date;
  branchId?: string;
}

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary({ tenantId, from, to, branchId }: DashboardQuery) {
    const branchFilter = branchId ? { branchId } : {};
    const todayStart = startOfDay(new Date());
    const todayEnd = endOfDay(new Date());

    const [
      ordersToday,
      pendingPayments,
      revenueAgg,
      ordersByStatus,
      ordersPerDay,
      revenuePerDay,
      topLowStock,
      lowStockCount,
    ] = await Promise.all([
      this.prisma.order.count({
        where: { tenantId, ...branchFilter, createdAt: { gte: todayStart, lte: todayEnd } },
      }),

      this.prisma.order.count({
        where: {
          tenantId,
          ...branchFilter,
          status: OrderStatus.CONFIRMED,
          payments: { none: { status: PaymentStatus.VERIFIED } },
        },
      }),

      this.prisma.payment.aggregate({
        where: {
          tenantId,
          status: PaymentStatus.VERIFIED,
          createdAt: { gte: from, lte: to },
          ...(branchId ? { order: { branchId } } : {}),
        },
        _sum: { amountCents: true },
      }),

      this.prisma.order.groupBy({
        by: ['status'],
        where: { tenantId, ...branchFilter, createdAt: { gte: from, lte: to } },
        _count: { _all: true },
      }),

      // Orders per day — raw for date bucketing
      this.prisma.$queryRaw<Array<{ date: string; count: number }>>`
        SELECT DATE("createdAt" AT TIME ZONE 'UTC')::text AS date, COUNT(*)::int AS count
        FROM "Order"
        WHERE "tenantId" = ${tenantId}::uuid
          AND "createdAt" >= ${from}
          AND "createdAt" <= ${to}
          AND (${branchId ?? null}::uuid IS NULL OR "branchId" = ${branchId ?? null}::uuid)
        GROUP BY DATE("createdAt" AT TIME ZONE 'UTC')
        ORDER BY date ASC
      `,

      // Revenue per day — raw for date bucketing
      this.prisma.$queryRaw<Array<{ date: string; amountCents: number }>>`
        SELECT DATE(p."createdAt" AT TIME ZONE 'UTC')::text AS date,
               SUM(p."amountCents")::int AS "amountCents"
        FROM "Payment" p
        LEFT JOIN "Order" o ON o.id = p."orderId"
        WHERE p."tenantId" = ${tenantId}::uuid
          AND p."status" = 'VERIFIED'
          AND p."createdAt" >= ${from}
          AND p."createdAt" <= ${to}
          AND (${branchId ?? null}::uuid IS NULL OR o."branchId" = ${branchId ?? null}::uuid)
        GROUP BY DATE(p."createdAt" AT TIME ZONE 'UTC')
        ORDER BY date ASC
      `,

      this.prisma.sku.findMany({
        where: { tenantId, isActive: true },
        orderBy: { stockOnHand: 'asc' },
        take: 10,
        select: { id: true, code: true, name: true, stockOnHand: true, lowStockThreshold: true },
      }),

      this.prisma.$queryRaw<[{ count: number }]>`
        SELECT COUNT(*)::int AS count
        FROM "Sku"
        WHERE "tenantId" = ${tenantId}::uuid
          AND "isActive" = true
          AND "stockOnHand" <= "lowStockThreshold"
      `,
    ]);

    const statusMap: Record<string, number> = {};
    for (const row of ordersByStatus) {
      statusMap[row.status] = row._count._all;
    }

    return {
      summary: {
        ordersToday,
        pendingPayments,
        lowStockSkus: lowStockCount[0]?.count ?? 0,
        revenueRangeCents: revenueAgg._sum.amountCents ?? 0,
      },
      charts: {
        ordersByStatus: statusMap,
        ordersPerDay,
        revenuePerDay,
        topLowStock,
      },
    };
  }
}

function startOfDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
}

function endOfDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999));
}
