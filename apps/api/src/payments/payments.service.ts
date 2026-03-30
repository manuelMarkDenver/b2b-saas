import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PaymentStatus } from '@prisma/client';
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

    if (order.status === 'CANCELLED') {
      throw new BadRequestException('Cannot submit payment for a cancelled order');
    }

    const pendingPayment = await this.prisma.payment.findFirst({
      where: { orderId: dto.orderId, tenantId, status: 'PENDING' },
      select: { id: true },
    });

    if (pendingPayment) {
      throw new BadRequestException(
        'A pending payment already exists for this order. Reject it before submitting a new one.',
      );
    }

    const payment = await this.prisma.payment.create({
      data: {
        tenantId,
        orderId: dto.orderId,
        amountCents: dto.amountCents,
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

  async listPayments(tenantId: string, page: number, limit: number, orderId?: string, branchId?: string) {
    const skip = (page - 1) * limit;
    const where = {
      tenantId,
      ...(orderId ? { orderId } : {}),
      ...(branchId ? { order: { branchId } } : {}),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.payment.findMany({
        where,
        include: {
          order: { select: { id: true, status: true, totalCents: true } },
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
}
