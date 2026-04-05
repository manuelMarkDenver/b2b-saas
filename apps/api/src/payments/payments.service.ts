import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PaymentMethod, PaymentStatus } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SubmitPaymentDto } from './dto/submit-payment.dto';
import { VerifyPaymentDto } from './dto/verify-payment.dto';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async submitPayment(tenantId: string, dto: SubmitPaymentDto) {
    const order = await this.prisma.order.findFirst({
      where: { id: dto.orderId, tenantId },
      select: { id: true, status: true },
    });

    if (!order) throw new NotFoundException('Order not found');

    if (order.status !== 'CONFIRMED' && order.status !== 'COMPLETED') {
      throw new BadRequestException(
        'Payment can only be recorded for confirmed or completed orders',
      );
    }

    const payment = await this.prisma.payment.create({
      data: {
        tenantId,
        orderId: dto.orderId,
        amountCents: dto.amountCents,
        method: dto.method ?? PaymentMethod.CASH,
        proofUrl: dto.proofUrl ?? null,
        status: PaymentStatus.PENDING,
      },
      include: {
        order: { select: { id: true, status: true, totalCents: true } },
      },
    });

    this.logger.log(
      `payment.submitted tenantId=${tenantId} paymentId=${payment.id} orderId=${dto.orderId}`,
    );
    void this.notifications.notifyTenant(
      tenantId,
      'PAYMENT_SUBMITTED',
      'Payment submitted',
      `A payment of ${(dto.amountCents / 100).toLocaleString('en-PH', { style: 'currency', currency: 'PHP' })} was submitted for order ${dto.orderId.slice(0, 8)}.`,
      { entityType: 'payment', entityId: payment.id },
    );
    return payment;
  }

  async listPayments(
    tenantId: string,
    page: number,
    limit: number,
    orderId?: string,
    branchId?: string,
    status?: string,
    from?: string,
    to?: string,
    method?: string,
    minCents?: number,
    maxCents?: number,
    search?: string,
  ) {
    const skip = (page - 1) * limit;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = { tenantId };
    if (orderId) where.orderId = orderId;
    if (branchId) where.order = { branchId };
    if (status) where.status = status;
    if (method) where.method = method as PaymentMethod;
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(`${from}T00:00:00.000Z`);
      if (to) where.createdAt.lte = new Date(`${to}T23:59:59.999Z`);
    }
    if (minCents !== undefined || maxCents !== undefined) {
      where.amountCents = {};
      if (minCents !== undefined) where.amountCents.gte = minCents;
      if (maxCents !== undefined) where.amountCents.lte = maxCents;
    }
    if (search) {
      where.OR = [
        { id: { contains: search, mode: 'insensitive' } },
        { order: { customerRef: { contains: search, mode: 'insensitive' } } },
      ];
    }
    const [data, total] = await this.prisma.$transaction([
      this.prisma.payment.findMany({
        where,
        include: {
          order: { select: { id: true, status: true, totalCents: true, createdAt: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.payment.count({ where }),
    ]);
    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async getPayment(tenantId: string, paymentId: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { id: paymentId, tenantId },
      include: {
        order: { select: { id: true, status: true, totalCents: true } },
      },
    });

    if (!payment) throw new NotFoundException('Payment not found');

    return payment;
  }

  async verifyPayment(tenantId: string, paymentId: string, dto: VerifyPaymentDto) {
    const payment = await this.prisma.payment.findFirst({
      where: { id: paymentId, tenantId },
      select: { id: true, status: true },
    });

    if (!payment) throw new NotFoundException('Payment not found');

    if (payment.status !== PaymentStatus.PENDING) {
      throw new BadRequestException(
        `Payment is already ${payment.status.toLowerCase()} — cannot change status`,
      );
    }

    const updated = await this.prisma.payment.update({
      where: { id: paymentId },
      data: { status: dto.status },
      include: {
        order: { select: { id: true, status: true, totalCents: true } },
      },
    });

    const event =
      dto.status === PaymentStatus.VERIFIED ? 'payment.verified' : 'payment.rejected';
    this.logger.log(`${event} tenantId=${tenantId} paymentId=${paymentId}`);

    void this.notifications.notifyTenant(
      tenantId,
      dto.status === PaymentStatus.VERIFIED ? 'PAYMENT_VERIFIED' : 'PAYMENT_REJECTED',
      dto.status === PaymentStatus.VERIFIED ? 'Payment verified' : 'Payment rejected',
      `Payment ${paymentId.slice(0, 8)} has been ${dto.status.toLowerCase()}.`,
      { entityType: 'payment', entityId: paymentId },
    );

    return updated;
  }

  /**
   * Record a payment directly as VERIFIED — for cash/on-hand payments
   * that don't need proof upload or admin approval.
   */
  async recordPayment(
    tenantId: string,
    orderId: string,
    amountCents: number,
    method: PaymentMethod = PaymentMethod.CASH,
  ) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, tenantId },
      select: { id: true, status: true, totalCents: true },
    });

    if (!order) throw new NotFoundException('Order not found');
    if (order.status !== 'CONFIRMED' && order.status !== 'COMPLETED') {
      throw new BadRequestException(
        'Payment can only be recorded for confirmed or completed orders',
      );
    }

    const paidCents = await this.prisma.payment
      .aggregate({ where: { orderId, status: 'VERIFIED' }, _sum: { amountCents: true } })
      .then((r) => r._sum.amountCents ?? 0);
    const balanceCents = order.totalCents - paidCents;

    if (amountCents > balanceCents) {
      throw new BadRequestException(
        `Payment of ${(amountCents / 100).toLocaleString('en-PH', { style: 'currency', currency: 'PHP' })} exceeds remaining balance of ${(balanceCents / 100).toLocaleString('en-PH', { style: 'currency', currency: 'PHP' })}`,
      );
    }

    const payment = await this.prisma.payment.create({
      data: { tenantId, orderId, amountCents, method, status: PaymentStatus.VERIFIED },
    });

    this.logger.log(`payment.recorded tenantId=${tenantId} paymentId=${payment.id} orderId=${orderId}`);

    return {
      payment,
      totalCents: order.totalCents,
      paidCents,
      balanceCents: Math.max(0, order.totalCents - paidCents),
    };
  }
}
