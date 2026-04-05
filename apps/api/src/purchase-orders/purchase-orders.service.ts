import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { MovementType, Prisma, PurchaseOrderStatus } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreatePurchaseOrderDto } from './dto/create-po.dto';
import { UpdatePurchaseOrderDto } from './dto/update-po.dto';
import { ReceivePurchaseOrderDto } from './dto/receive-po.dto';

@Injectable()
export class PurchaseOrdersService {
  constructor(private readonly prisma: PrismaService) {}

  private async checkBranchAccess(tenantId: string, branchId: string, membership: { role: string; branchIds: Prisma.JsonValue }) {
    const branchIds = (membership.branchIds as string[]) ?? [];
    if (branchIds.length > 0 && !branchIds.includes(branchId)) {
      throw new ForbiddenException('You do not have access to this branch');
    }
  }

  private async getNextPoNumber(tenantId: string): Promise<number> {
    const maxPo = await this.prisma.purchaseOrder.aggregate({
      where: { tenantId },
      _max: { poNumber: true },
    });
    return (maxPo._max.poNumber ?? 1000) + 1;
  }

  async list(tenantId: string, branchId: string, membership: { role: string; branchIds: Prisma.JsonValue }, page: number, limit: number, status?: string, search?: string) {
    await this.checkBranchAccess(tenantId, branchId, membership);

    const where: Prisma.PurchaseOrderWhereInput = { tenantId, branchId };
    if (status) where.status = status as PurchaseOrderStatus;
    if (search) {
      where.OR = [
        { poNumber: { equals: parseInt(search, 10) || -1 } },
        { supplier: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.purchaseOrder.findMany({
        where,
        include: {
          supplier: { select: { id: true, name: true } },
          items: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.purchaseOrder.count({ where }),
    ]);

    return {
      data: data.map((po) => ({ ...po, itemsCount: po.items.length })),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async create(tenantId: string, branchId: string, userId: string, membership: { role: string; branchIds: Prisma.JsonValue }, dto: CreatePurchaseOrderDto) {
    if (membership.role !== 'OWNER' && membership.role !== 'ADMIN') {
      throw new ForbiddenException('Only OWNER or ADMIN can manage purchase orders');
    }
    await this.checkBranchAccess(tenantId, branchId, membership);

    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('At least one item is required');
    }

    const supplier = await this.prisma.supplier.findFirst({ where: { id: dto.supplierId, tenantId } });
    if (!supplier) throw new NotFoundException('Supplier not found');

    const skuIds = [...new Set(dto.items.map((i) => i.skuId))];
    const skus = await this.prisma.sku.findMany({ where: { id: { in: skuIds }, tenantId }, select: { id: true } });
    if (skus.length !== skuIds.length) throw new NotFoundException('One or more items not found');

    // Generate poNumber with retry on conflict
    for (let attempt = 0; attempt < 2; attempt++) {
      const poNumber = await this.getNextPoNumber(tenantId);
      try {
        return this.prisma.purchaseOrder.create({
          data: {
            tenantId,
            branchId,
            supplierId: dto.supplierId,
            poNumber,
            status: 'DRAFT',
            note: dto.note ?? null,
            createdById: userId,
            items: {
              create: dto.items.map((i) => ({ skuId: i.skuId, orderedQty: i.orderedQty })),
            },
          },
          include: {
            supplier: { select: { id: true, name: true } },
            items: { include: { sku: { select: { id: true, code: true, name: true } } } },
          },
        });
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002' && attempt === 0) {
          continue; // retry
        }
        throw e;
      }
    }
    throw new ConflictException('Failed to generate unique PO number');
  }

  async update(tenantId: string, branchId: string, userId: string, membership: { role: string; branchIds: Prisma.JsonValue }, id: string, dto: UpdatePurchaseOrderDto) {
    if (membership.role !== 'OWNER' && membership.role !== 'ADMIN') {
      throw new ForbiddenException('Only OWNER or ADMIN can manage purchase orders');
    }
    await this.checkBranchAccess(tenantId, branchId, membership);

    const po = await this.prisma.purchaseOrder.findFirst({ where: { id, tenantId, branchId } });
    if (!po) throw new NotFoundException('Purchase order not found');
    if (po.status !== 'DRAFT') throw new BadRequestException('Only draft purchase orders can be edited');

    if (dto.supplierId) {
      const supplier = await this.prisma.supplier.findFirst({ where: { id: dto.supplierId, tenantId } });
      if (!supplier) throw new NotFoundException('Supplier not found');
    }

    if (dto.items && dto.items.length === 0) {
      throw new BadRequestException('At least one item is required');
    }

    if (dto.items) {
      const skuIds = [...new Set(dto.items.map((i) => i.skuId))];
      const skus = await this.prisma.sku.findMany({ where: { id: { in: skuIds }, tenantId }, select: { id: true } });
      if (skus.length !== skuIds.length) throw new NotFoundException('One or more items not found');
    }

    return this.prisma.$transaction(async (tx) => {
      // Delete existing items if updating
      if (dto.items) {
        await tx.purchaseOrderItem.deleteMany({ where: { purchaseOrderId: id } });
      }

      return tx.purchaseOrder.update({
        where: { id },
        data: {
          ...(dto.supplierId && { supplierId: dto.supplierId }),
          ...(dto.note !== undefined && { note: dto.note }),
          ...(dto.items && {
            items: {
              create: dto.items.map((i) => ({ skuId: i.skuId, orderedQty: i.orderedQty })),
            },
          }),
        },
        include: {
          supplier: { select: { id: true, name: true } },
          items: { include: { sku: { select: { id: true, code: true, name: true } } } },
        },
      });
    });
  }

  async order(tenantId: string, branchId: string, userId: string, membership: { role: string; branchIds: Prisma.JsonValue }, id: string) {
    if (membership.role !== 'OWNER' && membership.role !== 'ADMIN') {
      throw new ForbiddenException('Only OWNER or ADMIN can manage purchase orders');
    }
    await this.checkBranchAccess(tenantId, branchId, membership);

    const po = await this.prisma.purchaseOrder.findFirst({ where: { id, tenantId, branchId } });
    if (!po) throw new NotFoundException('Purchase order not found');
    if (po.status !== 'DRAFT') throw new BadRequestException('Purchase order can only be ordered when DRAFT');

    return this.prisma.purchaseOrder.update({
      where: { id },
      data: { status: 'ORDERED', orderedAt: new Date() },
      include: {
        supplier: { select: { id: true, name: true } },
        items: { include: { sku: { select: { id: true, code: true, name: true } } } },
      },
    });
  }

  async receive(tenantId: string, branchId: string, userId: string, membership: { role: string; branchIds: Prisma.JsonValue }, id: string, dto: ReceivePurchaseOrderDto) {
    if (membership.role !== 'OWNER' && membership.role !== 'ADMIN') {
      throw new ForbiddenException('Only OWNER or ADMIN can manage purchase orders');
    }
    await this.checkBranchAccess(tenantId, branchId, membership);

    const po = await this.prisma.purchaseOrder.findFirst({
      where: { id, tenantId, branchId },
      include: { items: { include: { sku: { select: { id: true, code: true, name: true } } } } },
    });
    if (!po) throw new NotFoundException('Purchase order not found');
    if (po.status !== 'ORDERED') throw new BadRequestException('Purchase order can only be received when ORDERED');

    // Validate received items
    const poItemMap = new Map(po.items.map((item) => [item.skuId, item]));
    for (const receiveItem of dto.items) {
      const poItem = poItemMap.get(receiveItem.skuId);
      if (!poItem) throw new BadRequestException(`SKU ${receiveItem.skuId} not found in this purchase order`);
      if (receiveItem.receivedQty > poItem.orderedQty) {
        throw new BadRequestException(`Received quantity for ${poItem.sku.name} exceeds ordered quantity`);
      }
    }

    return this.prisma.$transaction(async (tx) => {
      // Update PO
      await tx.purchaseOrder.update({
        where: { id },
        data: { status: 'RECEIVED', receivedAt: new Date(), receivedById: userId },
      });

      // Update items and create movements
      for (const receiveItem of dto.items) {
        const poItem = poItemMap.get(receiveItem.skuId);
        if (!poItem) continue;

        await tx.purchaseOrderItem.update({
          where: { purchaseOrderId_skuId: { purchaseOrderId: id, skuId: receiveItem.skuId } },
          data: { receivedQty: receiveItem.receivedQty },
        });

        if (receiveItem.receivedQty > 0) {
          const pairId = randomUUID();
          await tx.inventoryMovement.create({
            data: {
              tenantId,
              skuId: receiveItem.skuId,
              type: MovementType.IN,
              quantity: receiveItem.receivedQty,
              referenceType: 'MANUAL',
              referenceId: id,
              reason: `Purchase order PO${po.poNumber}`,
              note: `PO${po.poNumber}`,
              branchId,
              actorId: userId,
              transferPairId: pairId,
            },
          });
          await tx.sku.update({
            where: { id: receiveItem.skuId },
            data: { stockOnHand: { increment: receiveItem.receivedQty } },
          });
        }
      }

      return tx.purchaseOrder.findUnique({
        where: { id },
        include: {
          supplier: { select: { id: true, name: true } },
          items: { include: { sku: { select: { id: true, code: true, name: true } } } },
        },
      });
    });
  }

  async close(tenantId: string, branchId: string, userId: string, membership: { role: string; branchIds: Prisma.JsonValue }, id: string) {
    if (membership.role !== 'OWNER' && membership.role !== 'ADMIN') {
      throw new ForbiddenException('Only OWNER or ADMIN can manage purchase orders');
    }
    await this.checkBranchAccess(tenantId, branchId, membership);

    const po = await this.prisma.purchaseOrder.findFirst({ where: { id, tenantId, branchId } });
    if (!po) throw new NotFoundException('Purchase order not found');
    if (po.status !== 'RECEIVED') throw new BadRequestException('Purchase order can only be closed when RECEIVED');

    return this.prisma.purchaseOrder.update({
      where: { id },
      data: { status: 'CLOSED', closedAt: new Date() },
      include: {
        supplier: { select: { id: true, name: true } },
        items: { include: { sku: { select: { id: true, code: true, name: true } } } },
      },
    });
  }
}
