import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TenantRole } from '@prisma/client';
import { randomUUID } from 'crypto';
import { hash } from 'bcryptjs';
import { PrismaService } from '../common/prisma/prisma.service';
import { EmailService } from '../common/email/email.service';

@Injectable()
export class MembershipsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly config: ConfigService,
  ) {}

  listForUser(userId: string) {
    return this.prisma.tenantMembership.findMany({
      where: { userId },
      include: {
        tenant: { select: { id: true, name: true, slug: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async ensureActiveMembership(userId: string, tenantSlug: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug: tenantSlug.toLowerCase() },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    const membership = await this.prisma.tenantMembership.findUnique({
      where: {
        tenantId_userId: {
          tenantId: tenant.id,
          userId,
        },
      },
    });

    if (!membership || membership.status !== 'ACTIVE') {
      throw new ForbiddenException('No access to tenant');
    }

    return { tenant, membership };
  }

  async inviteStaff(
    tenantId: string,
    inviterUserId: string,
    email: string,
    role: TenantRole,
  ) {
    const normalizedEmail = email.trim().toLowerCase();

    // Verify inviter has sufficient role (OWNER or ADMIN only)
    const inviterMembership = await this.prisma.tenantMembership.findUnique({
      where: { tenantId_userId: { tenantId, userId: inviterUserId } },
      select: { role: true },
    });
    if (
      !inviterMembership ||
      (inviterMembership.role !== 'OWNER' && inviterMembership.role !== 'ADMIN')
    ) {
      throw new ForbiddenException('Only OWNER or ADMIN can invite staff');
    }

    // Get or create the user account (invited user may not exist yet)
    let user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    });

    if (!user) {
      // Create a placeholder account — no password until they accept
      user = await this.prisma.user.create({
        data: {
          email: normalizedEmail,
          passwordHash: '', // Set on accept-invite
          status: 'ACTIVE',
        },
        select: { id: true },
      });
    }

    // Check if already a member
    const existing = await this.prisma.tenantMembership.findUnique({
      where: { tenantId_userId: { tenantId, userId: user.id } },
      select: { status: true },
    });
    if (existing?.status === 'ACTIVE') {
      throw new BadRequestException('User is already an active member of this tenant');
    }

    const token = randomUUID();
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours

    const membership = await this.prisma.tenantMembership.upsert({
      where: { tenantId_userId: { tenantId, userId: user.id } },
      create: {
        tenantId,
        userId: user.id,
        role,
        status: 'INVITED',
        inviteToken: token,
        inviteExpiresAt: expiresAt,
      },
      update: {
        role,
        status: 'INVITED',
        inviteToken: token,
        inviteExpiresAt: expiresAt,
      },
      include: {
        tenant: { select: { name: true } },
      },
    });

    const baseUrl = this.config.get<string>('appBaseUrl');
    const inviteUrl = `${baseUrl}/accept-invite?token=${token}`;
    await this.emailService.sendStaffInvite(normalizedEmail, inviteUrl, membership.tenant.name);

    return { message: 'Invitation sent', email: normalizedEmail };
  }

  async acceptInvite(token: string, password: string) {
    const membership = await this.prisma.tenantMembership.findUnique({
      where: { inviteToken: token },
      include: { user: { select: { id: true } }, tenant: { select: { id: true, name: true, slug: true } } },
    });

    if (!membership || membership.status !== 'INVITED') {
      throw new BadRequestException('Invalid or already used invitation');
    }

    if (!membership.inviteExpiresAt || membership.inviteExpiresAt < new Date()) {
      throw new BadRequestException('Invitation has expired');
    }

    const passwordHash = await hash(password, 12);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: membership.userId },
        data: { passwordHash },
      }),
      this.prisma.tenantMembership.update({
        where: { id: membership.id },
        data: { status: 'ACTIVE', inviteToken: null, inviteExpiresAt: null },
      }),
    ]);

    return { message: 'Invitation accepted', tenantSlug: membership.tenant.slug };
  }
}
