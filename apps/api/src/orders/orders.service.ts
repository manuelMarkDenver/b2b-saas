import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { OrderStatus, ReferenceType, MovementType } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(private readonly prisma: PrismaService) {}

  async createOrder(tenantId: string, dto: CreateOrderDto) {
    const skuIds = dto.items.map((i) => i.skuId);

    const skus = await this.prisma.sku.findMany({
      where: { id: { in: skuIds }, tenantId },
      select: { id: true, priceCents: true, isActive: true },
    });

    if (skus.length !== skuIds.length) {
      throw new NotFoundException('One or more SKUs not found for this tenant');
    }

    const inactiveSkus = skus.filter((s) => !s.isActive);
    if (inactiveSkus.length > 0) {
      throw new BadRequestException('One or more SKUs are inactive');
    }

    const skuMap = new Map(skus.map((s) => [s.id, s]));

    let totalCents = 0;
    const itemsData = dto.items.map((item) => {
      const sku = skuMap.get(item.skuId)!;
      const priceAtTime = sku.priceCents ?? 0;
      totalCents += priceAtTime * item.quantity;
      return {
        skuId: item.skuId,
        quantity: item.quantity,
        priceAtTime,
      };
    });

    // Guard against Int overflow on the totalCents column (Postgres Int max ~2.1B cents = ~$21M)
    const INT_MAX = 2_147_483_647;
    if (totalCents > INT_MAX) {
      throw new BadRequestException(
        `Order total exceeds maximum allowed value ($${(INT_MAX / 100).toLocaleString()}). Split into multiple orders.`,
      );
    }

    const order = await this.prisma.order.create({
      data: {
        tenantId,
        totalCents,
        items: { create: itemsData },
      },
      include: {
        items: {
          include: { sku: { select: { id: true, code: true, name: true } } },
        },
      },
    });

    this.logger.log(`order.created tenantId=${tenantId} orderId=${order.id}`);
    return order;
  }

  async listOrders(tenantId: string, page: number, limit: number) {
    const skip = (page - 1) * limit;
    const where = { tenantId };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        include: {
          items: {
            include: { sku: { select: { id: true, code: true, name: true } } },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.order.count({ where }),
    ]);
    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async getOrder(tenantId: string, orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: { sku: { select: { id: true, code: true, name: true } } },
        },
      },
    });

    if (!order || order.tenantId !== tenantId) {
      throw new NotFoundException('Order not found');
    }

    return order;
  }

  async updateOrderStatus(
    tenantId: string,
    orderId: string,
    dto: UpdateOrderStatusDto,
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });

    if (!order || order.tenantId !== tenantId) {
      throw new NotFoundException('Order not found');
    }

    const validTransitions: Record<OrderStatus, OrderStatus[]> = {
      PENDING: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
      CONFIRMED: [OrderStatus.COMPLETED, OrderStatus.CANCELLED],
      COMPLETED: [],
      CANCELLED: [],
    };

    if (!validTransitions[order.status].includes(dto.status)) {
      throw new BadRequestException(
        `Cannot transition order from ${order.status} to ${dto.status}`,
      );
    }

    // CONFIRMED: check stock availability then deduct
    if (dto.status === OrderStatus.CONFIRMED) {
      return this.prisma.$transaction(async (tx) => {
        // Fetch current stock inside the transaction to prevent race conditions
        const skuIds = order.items.map((i) => i.skuId);
        const skus = await tx.sku.findMany({
          where: { id: { in: skuIds } },
          select: { id: true, name: true, stockOnHand: true },
        });
        const skuMap = new Map(skus.map((s) => [s.id, s]));

        for (const item of order.items) {
          const sku = skuMap.get(item.skuId)!;
          if (sku.stockOnHand < item.quantity) {
            throw new BadRequestException(
              `Insufficient stock for "${sku.name}": available ${sku.stockOnHand}, required ${item.quantity}`,
            );
          }
        }

        for (const item of order.items) {
          await tx.inventoryMovement.create({
            data: {
              tenantId,
              skuId: item.skuId,
              type: MovementType.OUT,
              quantity: item.quantity,
              referenceType: ReferenceType.ORDER,
              referenceId: order.id,
            },
          });

          await tx.sku.update({
            where: { id: item.skuId },
            data: { stockOnHand: { decrement: item.quantity } },
          });
        }

        const updated = await tx.order.update({
          where: { id: orderId },
          data: { status: dto.status },
          include: {
            items: {
              include: {
                sku: { select: { id: true, code: true, name: true } },
              },
            },
          },
        });

        this.logger.log(
          `order.status_changed tenantId=${tenantId} orderId=${orderId} status=${dto.status}`,
        );
        return updated;
      });
    }

    // CANCELLED from CONFIRMED: restore inventory
    if (
      dto.status === OrderStatus.CANCELLED &&
      order.status === OrderStatus.CONFIRMED
    ) {
      return this.prisma.$transaction(async (tx) => {
        for (const item of order.items) {
          await tx.inventoryMovement.create({
            data: {
              tenantId,
              skuId: item.skuId,
              type: MovementType.IN,
              quantity: item.quantity,
              referenceType: ReferenceType.ORDER,
              referenceId: order.id,
              note: 'Stock restored — order cancelled',
            },
          });

          await tx.sku.update({
            where: { id: item.skuId },
            data: { stockOnHand: { increment: item.quantity } },
          });
        }

        const updated = await tx.order.update({
          where: { id: orderId },
          data: { status: dto.status },
          include: {
            items: {
              include: {
                sku: { select: { id: true, code: true, name: true } },
              },
            },
          },
        });

        this.logger.log(
          `order.status_changed tenantId=${tenantId} orderId=${orderId} status=${dto.status} inventory_restored=true`,
        );
        return updated;
      });
    }

    // All other transitions (PENDING→CANCELLED, CONFIRMED→COMPLETED)
    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: { status: dto.status },
      include: {
        items: {
          include: { sku: { select: { id: true, code: true, name: true } } },
        },
      },
    });

    this.logger.log(
      `order.status_changed tenantId=${tenantId} orderId=${orderId} status=${dto.status}`,
    );
    return updated;
  }
}
