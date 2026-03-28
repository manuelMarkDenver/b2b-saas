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

  listMovements(tenantId: string, skuId?: string) {
    return this.prisma.inventoryMovement.findMany({
      where: {
        tenantId,
        ...(skuId ? { skuId } : {}),
      },
      include: {
        sku: { select: { id: true, code: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
