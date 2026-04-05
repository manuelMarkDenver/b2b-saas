import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { MovementType, Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateTransferDto } from './dto/create-transfer.dto';

@Injectable()
export class TransfersService {
  constructor(private readonly prisma: PrismaService) {}

  private async getBranchStock(tenantId: string, branchId: string) {
    const movements = await this.prisma.inventoryMovement.findMany({
      where: {
        tenantId,
        branchId,
        approvalStatus: 'APPROVED',
        type: { in: [MovementType.IN, MovementType.OUT, MovementType.TRANSFER_IN, MovementType.TRANSFER_OUT] },
      },
      select: { skuId: true, type: true, quantity: true },
    });

    const stock = new Map<string, number>();
    for (const m of movements) {
      const delta =
        m.type === MovementType.OUT || m.type === MovementType.TRANSFER_OUT
          ? -m.quantity
          : m.quantity;
      stock.set(m.skuId, (stock.get(m.skuId) ?? 0) + delta);
    }
    return stock;
  }

  async create(tenantId: string, userId: string, dto: CreateTransferDto) {
    if (dto.fromBranchId === dto.toBranchId) {
      throw new BadRequestException('Source and destination must be different branches');
    }

    if (dto.items.length === 0) {
      throw new BadRequestException('At least one item is required');
    }

    const from = await this.prisma.branch.findFirst({ where: { id: dto.fromBranchId, tenantId } });
    if (!from) throw new NotFoundException('Source branch not found');

    const to = await this.prisma.branch.findFirst({ where: { id: dto.toBranchId, tenantId } });
    if (!to) throw new NotFoundException('Destination branch not found');

    const skuIds = [...new Set(dto.items.map((i) => i.skuId))];
    const skus = await this.prisma.sku.findMany({
      where: { id: { in: skuIds }, tenantId },
      select: { id: true, stockOnHand: true, name: true, code: true },
    });

    if (skus.length !== skuIds.length) {
      throw new NotFoundException('One or more SKUs not found');
    }

    // Validate source branch stock
    const branchStock = await this.getBranchStock(tenantId, dto.fromBranchId);
    for (const item of dto.items) {
      const available = branchStock.get(item.skuId) ?? 0;
      if (available < item.quantity) {
        const sku = skus.find((s) => s.id === item.skuId)!;
        throw new BadRequestException(
          `Insufficient stock at source branch for ${sku.name} (${sku.code}): available ${available}, requested ${item.quantity}`,
        );
      }
    }

    // Create transfer as PENDING — no movements, no stock changes
    return this.prisma.stockTransferRequest.create({
      data: {
        tenantId,
        fromBranchId: dto.fromBranchId,
        toBranchId: dto.toBranchId,
        status: 'PENDING',
        requestedById: userId,
        note: dto.note ?? null,
        items: {
          create: dto.items.map((i) => ({ skuId: i.skuId, quantity: i.quantity })),
        },
      },
      include: {
        fromBranch: { select: { id: true, name: true } },
        toBranch: { select: { id: true, name: true } },
        items: { include: { sku: { select: { id: true, code: true, name: true } } } },
      },
    });
  }

  async send(tenantId: string, userId: string, transferId: string, membership: { role: string; branchIds: Prisma.JsonValue }) {
    const transfer = await this.prisma.stockTransferRequest.findFirst({
      where: { id: transferId, tenantId },
      include: { items: { include: { sku: { select: { id: true, code: true, name: true } } } } },
    });
    if (!transfer) throw new NotFoundException('Transfer not found');

    if (transfer.status !== 'PENDING') {
      throw new BadRequestException('Transfer can only be sent when PENDING');
    }

    if (!transfer.fromBranchId) {
      throw new BadRequestException('Legacy transfers without a source branch cannot be sent');
    }

    const branchIds = (membership.branchIds as string[]) ?? [];
    if (membership.role !== 'OWNER') {
      if (membership.role !== 'ADMIN' && membership.role !== 'STAFF') {
        throw new ForbiddenException('Only OWNER or members assigned to the source branch can send transfers');
      }
      if (branchIds.length > 0 && !branchIds.includes(transfer.fromBranchId!)) {
        throw new ForbiddenException('Only OWNER or members assigned to the source branch can send transfers');
      }
    }

    return this.prisma.stockTransferRequest.update({
      where: { id: transferId },
      data: { status: 'APPROVED', approvedById: userId },
      include: {
        fromBranch: { select: { id: true, name: true } },
        toBranch: { select: { id: true, name: true } },
        items: { include: { sku: { select: { id: true, code: true, name: true } } } },
      },
    });
  }

  async receive(tenantId: string, userId: string, transferId: string, membership: { role: string; branchIds: Prisma.JsonValue }) {
    const transfer = await this.prisma.stockTransferRequest.findFirst({
      where: { id: transferId, tenantId },
      include: { items: { include: { sku: { select: { id: true, code: true, name: true } } } } },
    });
    if (!transfer) throw new NotFoundException('Transfer not found');

    if (transfer.status !== 'PENDING' && transfer.status !== 'APPROVED') {
      throw new BadRequestException('Transfer can only be received when PENDING or IN_TRANSIT');
    }

    if (!transfer.fromBranchId) {
      throw new BadRequestException('Legacy transfers without a source branch cannot be received');
    }

    const branchIds = (membership.branchIds as string[]) ?? [];
    if (membership.role !== 'OWNER') {
      if (membership.role !== 'ADMIN' && membership.role !== 'STAFF') {
        throw new ForbiddenException('Only OWNER or members assigned to the destination branch can receive transfers');
      }
      if (branchIds.length > 0 && !branchIds.includes(transfer.toBranchId)) {
        throw new ForbiddenException('Only OWNER or members assigned to the destination branch can receive transfers');
      }
    }

    // Re-validate source branch stock at receive time
    if (transfer.fromBranchId) {
      const branchStock = await this.getBranchStock(tenantId, transfer.fromBranchId);
      for (const item of transfer.items) {
        const available = branchStock.get(item.skuId) ?? 0;
        if (available < item.quantity) {
          throw new BadRequestException(
            `Insufficient stock at source branch for ${item.sku.name} (${item.sku.code}): available ${available}, required ${item.quantity}. Transfer cannot be received.`,
          );
        }
      }
    }

    // Create movements and update stock in one transaction
    return this.prisma.$transaction(async (tx) => {
      await tx.stockTransferRequest.update({
        where: { id: transferId },
        data: { status: 'FULFILLED' },
      });

      for (const item of transfer.items) {
        const pairId = randomUUID();

        if (transfer.fromBranchId) {
          await tx.inventoryMovement.create({
            data: {
              tenantId,
              skuId: item.skuId,
              type: 'TRANSFER_OUT',
              quantity: item.quantity,
              referenceType: 'TRANSFER',
              referenceId: transfer.id,
              branchId: transfer.fromBranchId,
              transferPairId: pairId,
              actorId: userId,
            },
          });
          await tx.sku.update({
            where: { id: item.skuId },
            data: { stockOnHand: { decrement: item.quantity } },
          });
        }

        await tx.inventoryMovement.create({
          data: {
            tenantId,
            skuId: item.skuId,
            type: 'TRANSFER_IN',
            quantity: item.quantity,
            referenceType: 'TRANSFER',
            referenceId: transfer.id,
            branchId: transfer.toBranchId,
            transferPairId: pairId,
            actorId: userId,
          },
        });
        await tx.sku.update({
          where: { id: item.skuId },
          data: { stockOnHand: { increment: item.quantity } },
        });
      }

      return tx.stockTransferRequest.findUnique({
        where: { id: transferId },
        include: {
          fromBranch: { select: { id: true, name: true } },
          toBranch: { select: { id: true, name: true } },
          items: { include: { sku: { select: { id: true, code: true, name: true } } } },
        },
      });
    });
  }

  async cancel(tenantId: string, userId: string, transferId: string, membership: { role: string }) {
    const transfer = await this.prisma.stockTransferRequest.findFirst({
      where: { id: transferId, tenantId },
    });
    if (!transfer) throw new NotFoundException('Transfer not found');

    if (transfer.status !== 'PENDING' && transfer.status !== 'APPROVED') {
      throw new BadRequestException('Transfer can only be cancelled when PENDING or IN_TRANSIT');
    }

    if (membership.role === 'OWNER') {
      // OWNER can always cancel
    } else if (transfer.status === 'PENDING' && transfer.requestedById === userId) {
      // Requester can cancel PENDING
    } else if (transfer.status === 'PENDING') {
      throw new ForbiddenException('Only OWNER or the requester can cancel a pending transfer');
    } else {
      throw new ForbiddenException('Only OWNER can cancel an in-transit transfer');
    }

    return this.prisma.stockTransferRequest.update({
      where: { id: transferId },
      data: { status: 'REJECTED' },
      include: {
        fromBranch: { select: { id: true, name: true } },
        toBranch: { select: { id: true, name: true } },
        items: { include: { sku: { select: { id: true, code: true, name: true } } } },
      },
    });
  }

  async list(
    tenantId: string,
    opts: {
      from?: string;
      to?: string;
      fromBranchId?: string;
      toBranchId?: string;
      skuSearch?: string;
      page?: number;
      limit?: number;
    } = {},
  ) {
    const page = Math.max(1, opts.page ?? 1);
    const limit = Math.min(100, opts.limit ?? 20);
    const skip = (page - 1) * limit;

    const where: Prisma.StockTransferRequestWhereInput = {
      tenantId,
    };
    if (opts.from) where.createdAt = { ...(where.createdAt as object), gte: new Date(opts.from) };
    if (opts.to) {
      const toEnd = new Date(opts.to);
      toEnd.setHours(23, 59, 59, 999);
      where.createdAt = { ...(where.createdAt as object), lte: toEnd };
    }
    if (opts.fromBranchId) where.fromBranchId = opts.fromBranchId;
    if (opts.toBranchId) where.toBranchId = opts.toBranchId;
    if (opts.skuSearch) {
      const q = opts.skuSearch;
      where.items = {
        some: {
          sku: {
            OR: [
              { code: { contains: q, mode: 'insensitive' } },
              { name: { contains: q, mode: 'insensitive' } },
            ],
          },
        },
      };
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.stockTransferRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          fromBranch: { select: { id: true, name: true } },
          toBranch: { select: { id: true, name: true } },
          requestedBy: { select: { id: true, email: true } },
          items: { include: { sku: { select: { id: true, code: true, name: true } } } },
        },
      }),
      this.prisma.stockTransferRequest.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }
}
