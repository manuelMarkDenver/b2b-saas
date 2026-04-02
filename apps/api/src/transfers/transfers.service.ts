import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { MovementType } from '@prisma/client';
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
    if (dto.fromBranchId && dto.fromBranchId === dto.toBranchId) {
      throw new BadRequestException('Source and destination must be different branches');
    }

    if (dto.items.length === 0) {
      throw new BadRequestException('At least one item is required');
    }

    if (dto.fromBranchId) {
      const from = await this.prisma.branch.findFirst({ where: { id: dto.fromBranchId, tenantId } });
      if (!from) throw new NotFoundException('Source branch not found');
    }

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

    if (dto.fromBranchId) {
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
    } else {
      for (const item of dto.items) {
        const sku = skus.find((s) => s.id === item.skuId)!;
        if (sku.stockOnHand < item.quantity) {
          throw new BadRequestException(
            `Insufficient stock for ${sku.name} (${sku.code}): available ${sku.stockOnHand}, requested ${item.quantity}`,
          );
        }
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const transfer = await tx.stockTransferRequest.create({
        data: {
          tenantId,
          fromBranchId: dto.fromBranchId ?? null,
          toBranchId: dto.toBranchId,
          status: 'FULFILLED',
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

      for (const item of dto.items) {
        const pairId = randomUUID();

        if (dto.fromBranchId) {
          await tx.inventoryMovement.create({
            data: {
              tenantId,
              skuId: item.skuId,
              type: 'TRANSFER_OUT',
              quantity: item.quantity,
              referenceType: 'TRANSFER',
              referenceId: transfer.id,
              branchId: dto.fromBranchId,
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
            branchId: dto.toBranchId,
            transferPairId: pairId,
            actorId: userId,
          },
        });
        await tx.sku.update({
          where: { id: item.skuId },
          data: { stockOnHand: { increment: item.quantity } },
        });
      }

      return transfer;
    });
  }

  list(tenantId: string) {
    return this.prisma.stockTransferRequest.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      include: {
        fromBranch: { select: { id: true, name: true } },
        toBranch: { select: { id: true, name: true } },
        requestedBy: { select: { id: true, email: true } },
        items: { include: { sku: { select: { id: true, code: true, name: true } } } },
      },
    });
  }
}
