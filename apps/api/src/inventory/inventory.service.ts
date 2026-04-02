import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ApprovalStatus, MovementType, ReferenceType } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Get stock per branch, derived from movements (IN - OUT - TRANSFER_OUT + TRANSFER_IN). */
  async getBranchStock(tenantId: string, branchId?: string, skuId?: string) {
    const where: Record<string, unknown> = {
      tenantId,
      approvalStatus: ApprovalStatus.APPROVED,
      type: { in: [MovementType.IN, MovementType.OUT, MovementType.TRANSFER_IN, MovementType.TRANSFER_OUT] },
    };
    if (branchId) where.branchId = branchId;
    if (skuId) where.skuId = skuId;

    const movements = await this.prisma.inventoryMovement.findMany({
      where,
      select: { branchId: true, skuId: true, type: true, quantity: true },
    });

    const branchStock = new Map<string, Map<string, number>>();
    for (const m of movements) {
      if (!m.branchId) continue;
      if (!branchStock.has(m.branchId)) branchStock.set(m.branchId, new Map());
      const current = branchStock.get(m.branchId)!.get(m.skuId) ?? 0;
      const delta =
        m.type === MovementType.OUT || m.type === MovementType.TRANSFER_OUT
          ? -m.quantity
          : m.quantity;
      branchStock.get(m.branchId)!.set(m.skuId, current + delta);
    }
    return branchStock;
  }

  async logMovement(
    tenantId: string,
    data: {
      skuId: string;
      type: MovementType;
      quantity: number;
      referenceType: ReferenceType;
      referenceId?: string;
      note?: string;
      reason?: string;
      actorId?: string;
    },
    branchId?: string,
    role?: string,
  ) {
    const sku = await this.prisma.sku.findFirst({
      where: { id: data.skuId, tenantId },
      select: { id: true, name: true, code: true, stockOnHand: true },
    });
    if (!sku) throw new NotFoundException('SKU not found');

    if (data.type !== MovementType.ADJUSTMENT && data.quantity <= 0) {
      throw new BadRequestException('Quantity must be positive for IN and OUT movements');
    }
    if (data.type === MovementType.ADJUSTMENT && data.quantity === 0) {
      throw new BadRequestException('Adjustment quantity cannot be zero');
    }

    if (data.type === MovementType.OUT && sku.stockOnHand < data.quantity) {
      throw new BadRequestException(
        `Insufficient stock: available ${sku.stockOnHand}, requested ${data.quantity}`,
      );
    }

    if (data.type === MovementType.ADJUSTMENT && data.quantity < 0 && sku.stockOnHand + data.quantity < 0) {
      throw new BadRequestException(
        `Adjustment would result in negative stock: current ${sku.stockOnHand}, delta ${data.quantity}`,
      );
    }

    const isStaff = role === 'STAFF';
    const approvalStatus: ApprovalStatus = isStaff ? ApprovalStatus.PENDING : ApprovalStatus.APPROVED;

    const delta =
      data.type === MovementType.IN
        ? data.quantity
        : data.type === MovementType.OUT
          ? -data.quantity
          : data.quantity; // ADJUSTMENT: signed delta

    const movement = await this.prisma.$transaction(async (tx) => {
      const mov = await tx.inventoryMovement.create({
        data: {
          tenantId,
          skuId: data.skuId,
          type: data.type,
          quantity: data.quantity,
          referenceType: data.referenceType,
          referenceId: data.referenceId ?? null,
          note: data.note ?? null,
          reason: data.reason ?? null,
          approvalStatus,
          actorId: data.actorId ?? null,
          branchId: branchId ?? null,
        },
      });

      // Only update stock immediately for approved movements
      if (!isStaff) {
        await tx.sku.update({
          where: { id: data.skuId },
          data: { stockOnHand: { increment: delta } },
        });
      }

      return mov;
    });

    // Notify admins/owners about pending staff adjustments
    if (isStaff) {
      const admins = await this.prisma.tenantMembership.findMany({
        where: { tenantId, status: 'ACTIVE', role: { in: ['OWNER', 'ADMIN'] } },
        select: { userId: true },
      });
      if (admins.length > 0) {
        await this.prisma.notification.createMany({
          data: admins.map((m) => ({
            tenantId,
            userId: m.userId,
            type: 'PLATFORM_ALERT' as const,
            title: 'Stock adjustment pending approval',
            body: `A staff member requested a ${data.type} of ${data.quantity} for ${sku.name} (${sku.code}).`,
            entityType: 'InventoryMovement',
            entityId: movement.id,
          })),
        });
      }
    }

    return { ...movement, approvalStatus };
  }

  async approveMovement(tenantId: string, movementId: string, role: string) {
    if (role !== 'OWNER' && role !== 'ADMIN') throw new ForbiddenException();

    const movement = await this.prisma.inventoryMovement.findFirst({
      where: { id: movementId, tenantId, approvalStatus: ApprovalStatus.PENDING },
    });
    if (!movement) throw new NotFoundException('Pending movement not found');

    const delta =
      movement.type === MovementType.IN
        ? movement.quantity
        : movement.type === MovementType.OUT
          ? -movement.quantity
          : movement.quantity;

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.inventoryMovement.update({
        where: { id: movementId },
        data: { approvalStatus: ApprovalStatus.APPROVED },
      });
      await tx.sku.update({
        where: { id: movement.skuId },
        data: { stockOnHand: { increment: delta } },
      });
      return updated;
    });
  }

  async rejectMovement(tenantId: string, movementId: string, role: string) {
    if (role !== 'OWNER' && role !== 'ADMIN') throw new ForbiddenException();

    const movement = await this.prisma.inventoryMovement.findFirst({
      where: { id: movementId, tenantId, approvalStatus: ApprovalStatus.PENDING },
    });
    if (!movement) throw new NotFoundException('Pending movement not found');

    return this.prisma.inventoryMovement.update({
      where: { id: movementId },
      data: { approvalStatus: ApprovalStatus.REJECTED },
    });
  }

  async listMovements(
    tenantId: string,
    page: number,
    limit: number,
    skuId?: string,
    branchId?: string,
    approvalStatus?: string,
    skuSearch?: string,
  ) {
    const skip = (page - 1) * limit;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {
      tenantId,
      ...(skuId ? { skuId } : {}),
      ...(branchId ? { branchId } : {}),
      ...(approvalStatus ? { approvalStatus: approvalStatus as ApprovalStatus } : {}),
    };
    if (skuSearch) {
      where.sku = {
        OR: [
          { code: { contains: skuSearch, mode: 'insensitive' } },
          { name: { contains: skuSearch, mode: 'insensitive' } },
        ],
      };
    }
    const [data, total] = await this.prisma.$transaction([
      this.prisma.inventoryMovement.findMany({
        where,
        include: {
          sku: { select: { id: true, code: true, name: true, imageUrl: true } },
          actor: { select: { id: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.inventoryMovement.count({ where }),
    ]);
    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }
}
