import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MovementType, ReferenceType } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  async logMovement(
    tenantId: string,
    data: {
      skuId: string;
      type: MovementType;
      quantity: number;
      referenceType: ReferenceType;
      referenceId?: string;
      note?: string;
    },
  ) {
    const sku = await this.prisma.sku.findUnique({
      where: { id: data.skuId },
      select: { id: true, tenantId: true, stockOnHand: true },
    });
    if (!sku) throw new NotFoundException('SKU not found');
    if (sku.tenantId !== tenantId) throw new ForbiddenException();

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

    const delta =
      data.type === MovementType.IN
        ? data.quantity
        : data.type === MovementType.OUT
          ? -data.quantity
          : data.quantity; // ADJUSTMENT: signed delta

    return this.prisma.$transaction(async (tx) => {
      const movement = await tx.inventoryMovement.create({
        data: {
          tenantId,
          skuId: data.skuId,
          type: data.type,
          quantity: data.quantity,
          referenceType: data.referenceType,
          referenceId: data.referenceId ?? null,
          note: data.note ?? null,
        },
      });

      await tx.sku.update({
        where: { id: data.skuId },
        data: { stockOnHand: { increment: delta } },
      });

      return movement;
    });
  }

  async listMovements(tenantId: string, page: number, limit: number, skuId?: string) {
    const skip = (page - 1) * limit;
    const where = { tenantId, ...(skuId ? { skuId } : {}) };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.inventoryMovement.findMany({
        where,
        include: {
          sku: { select: { id: true, code: true, name: true } },
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
