import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ContactType } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';

@Injectable()
export class ContactsService {
  constructor(private readonly prisma: PrismaService) {}

  private requireAdminOrOwner(role: string) {
    if (role !== 'OWNER' && role !== 'ADMIN') throw new ForbiddenException();
  }

  async create(tenantId: string, role: string, dto: CreateContactDto) {
    this.requireAdminOrOwner(role);
    return this.prisma.contact.create({
      data: {
        tenantId,
        name: dto.name.trim(),
        type: dto.type ?? ContactType.CUSTOMER,
        phone: dto.phone?.trim() ?? null,
        address: dto.address?.trim() ?? null,
        creditLimitCents: dto.creditLimitCents ?? 0,
      },
    });
  }

  async list(
    tenantId: string,
    page: number,
    limit: number,
    type?: ContactType,
    search?: string,
    isActive?: boolean,
  ) {
    const skip = (page - 1) * limit;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = { tenantId };
    if (type) where.type = type;
    if (isActive !== undefined) where.isActive = isActive;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [contacts, total] = await this.prisma.$transaction([
      this.prisma.contact.findMany({
        where,
        orderBy: { name: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.contact.count({ where }),
    ]);

    return { data: contacts, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async get(tenantId: string, contactId: string) {
    const contact = await this.prisma.contact.findFirst({
      where: { id: contactId, tenantId },
    });
    if (!contact) throw new NotFoundException('Contact not found');
    return contact;
  }

  async update(tenantId: string, role: string, contactId: string, dto: UpdateContactDto) {
    this.requireAdminOrOwner(role);
    const contact = await this.prisma.contact.findFirst({ where: { id: contactId, tenantId } });
    if (!contact) throw new NotFoundException('Contact not found');

    return this.prisma.contact.update({
      where: { id: contactId },
      data: {
        ...(dto.name !== undefined && { name: dto.name.trim() }),
        ...(dto.type !== undefined && { type: dto.type }),
        ...(dto.phone !== undefined && { phone: dto.phone?.trim() ?? null }),
        ...(dto.address !== undefined && { address: dto.address?.trim() ?? null }),
        ...(dto.creditLimitCents !== undefined && { creditLimitCents: dto.creditLimitCents }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
  }

  /**
   * AR summary for a single contact.
   * Returns total billed, total paid (verified payments), and outstanding balance.
   */
  async getArSummary(tenantId: string, role: string, contactId: string) {
    this.requireAdminOrOwner(role);
    const contact = await this.prisma.contact.findFirst({
      where: { id: contactId, tenantId },
    });
    if (!contact) throw new NotFoundException('Contact not found');

    const orders = await this.prisma.order.findMany({
      where: { tenantId, contactId },
      select: {
        id: true,
        totalCents: true,
        status: true,
        createdAt: true,
        paymentDueDate: true,
        payments: {
          where: { status: 'VERIFIED' },
          select: { amountCents: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const totalBilledCents = orders.reduce((sum, o) => sum + o.totalCents, 0);
    const totalPaidCents = orders.reduce(
      (sum, o) => sum + o.payments.reduce((ps, p) => ps + p.amountCents, 0),
      0,
    );
    const balanceCents = totalBilledCents - totalPaidCents;

    return {
      contact,
      totalBilledCents,
      totalPaidCents,
      balanceCents,
      orders,
    };
  }

  /**
   * Tenant-wide AR overview — all contacts with outstanding balances.
   * Used for the Customers report tab.
   */
  async getArOverview(tenantId: string, role: string) {
    this.requireAdminOrOwner(role);
    const contacts = await this.prisma.contact.findMany({
      where: { tenantId, isActive: true },
      include: {
        orders: {
          where: { status: { not: 'CANCELLED' } },
          select: {
            totalCents: true,
            createdAt: true,
            paymentDueDate: true,
            payments: {
              where: { status: 'VERIFIED' },
              select: { amountCents: true },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    const rows = contacts.map((c) => {
      const totalBilledCents = c.orders.reduce((s, o) => s + o.totalCents, 0);
      const totalPaidCents = c.orders.reduce(
        (s, o) => s + o.payments.reduce((ps, p) => ps + p.amountCents, 0),
        0,
      );
      const balanceCents = totalBilledCents - totalPaidCents;
      const now = new Date();
      const overdueOrders = c.orders.filter(
        (o) => o.paymentDueDate && o.paymentDueDate < now,
      );
      const overdueCents = overdueOrders.reduce((s, o) => {
        const paid = o.payments.reduce((ps, p) => ps + p.amountCents, 0);
        return s + Math.max(0, o.totalCents - paid);
      }, 0);

      return {
        id: c.id,
        name: c.name,
        type: c.type,
        phone: c.phone,
        creditLimitCents: c.creditLimitCents,
        totalBilledCents,
        totalPaidCents,
        balanceCents,
        overdueCents,
        orderCount: c.orders.length,
      };
    });

    // Sort by outstanding balance descending
    rows.sort((a, b) => b.balanceCents - a.balanceCents);
    return rows;
  }
}
