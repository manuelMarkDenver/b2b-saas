import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PaymentStatus } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { SubmitPaymentDto } from './dto/submit-payment.dto';
import { VerifyPaymentDto } from './dto/verify-payment.dto';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async submitPayment(tenantId: string, dto: SubmitPaymentDto) {
    const order = await this.prisma.order.findUnique({
      where: { id: dto.orderId },
      select: { id: true, tenantId: true, status: true },
    });

    if (!order || order.tenantId !== tenantId) {
      throw new NotFoundException('Order not found');
    }

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
    return payment;
  }

  listPayments(tenantId: string, orderId?: string) {
    return this.prisma.payment.findMany({
      where: {
        tenantId,
        ...(orderId ? { orderId } : {}),
      },
      include: {
        order: { select: { id: true, status: true, totalCents: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getPayment(tenantId: string, paymentId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        order: { select: { id: true, status: true, totalCents: true } },
      },
    });

    if (!payment || payment.tenantId !== tenantId) {
      throw new NotFoundException('Payment not found');
    }

    return payment;
  }

  async verifyPayment(tenantId: string, paymentId: string, dto: VerifyPaymentDto) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      select: { id: true, tenantId: true, status: true },
    });

    if (!payment || payment.tenantId !== tenantId) {
      throw new NotFoundException('Payment not found');
    }

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

    return updated;
  }
}
