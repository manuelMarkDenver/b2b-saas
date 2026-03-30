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
        tenant: { select: { id: true, name: true, slug: true, features: true, logoUrl: true } },
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

  listTeamMembers(tenantId: string) {
    return this.prisma.tenantMembership.findMany({
      where: { tenantId },
      select: {
        id: true,
        role: true,
        status: true,
        jobTitle: true,
        username: true,
        isOwner: true,
        createdAt: true,
        user: { select: { email: true, avatarUrl: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async addDirectStaff(
    tenantId: string,
    actorUserId: string,
    identifier: string,
    role: TenantRole,
    password: string,
    jobTitle?: string,
  ) {
    const actor = await this.prisma.tenantMembership.findUnique({
      where: { tenantId_userId: { tenantId, userId: actorUserId } },
      select: { role: true },
    });
    if (!actor || (actor.role !== 'OWNER' && actor.role !== 'ADMIN')) {
      throw new ForbiddenException('Only OWNER or ADMIN can add staff');
    }

    const normalizedIdentifier = identifier.trim().toLowerCase();

    // Check username uniqueness within this tenant
    const usernameConflict = await this.prisma.tenantMembership.findUnique({
      where: { tenantId_username: { tenantId, username: normalizedIdentifier } },
      select: { id: true, status: true },
    });
    if (usernameConflict?.status === 'ACTIVE') {
      throw new BadRequestException('That username is already taken in this business');
    }

    // Get tenant slug for placeholder email
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { slug: true },
    });

    const passwordHash = await hash(password, 12);
    const placeholderEmail = `direct-${randomUUID()}@${tenant!.slug}.internal`;

    const user = await this.prisma.user.create({
      data: { email: placeholderEmail, passwordHash, status: 'ACTIVE' },
      select: { id: true },
    });

    await this.prisma.tenantMembership.upsert({
      where: { tenantId_userId: { tenantId, userId: user.id } },
      create: {
        tenantId,
        userId: user.id,
        username: normalizedIdentifier,
        role,
        jobTitle: jobTitle?.trim() || null,
        status: 'ACTIVE',
      },
      update: {
        username: normalizedIdentifier,
        role,
        jobTitle: jobTitle?.trim() || null,
        status: 'ACTIVE',
      },
    });

    return { message: 'Staff member added', identifier: normalizedIdentifier };
  }

  async updateMembership(
    tenantId: string,
    actorUserId: string,
    membershipId: string,
    dto: { role?: string; jobTitle?: string; deactivate?: boolean },
  ) {
    const actor = await this.prisma.tenantMembership.findUnique({
      where: { tenantId_userId: { tenantId, userId: actorUserId } },
      select: { role: true },
    });
    if (!actor || (actor.role !== 'OWNER' && actor.role !== 'ADMIN')) {
      throw new ForbiddenException('Only OWNER or ADMIN can update memberships');
    }

    const target = await this.prisma.tenantMembership.findFirst({
      where: { id: membershipId, tenantId },
      select: { id: true, isOwner: true },
    });
    if (!target) throw new NotFoundException('Membership not found');
    if (target.isOwner) throw new ForbiddenException('Cannot modify the tenant owner');

    return this.prisma.tenantMembership.update({
      where: { id: membershipId },
      data: {
        ...(dto.role ? { role: dto.role as TenantRole } : {}),
        ...(dto.jobTitle !== undefined ? { jobTitle: dto.jobTitle || null } : {}),
        ...(dto.deactivate === true ? { status: 'DISABLED' } : dto.deactivate === false ? { status: 'ACTIVE' } : {}),
      },
      select: {
        id: true,
        role: true,
        status: true,
        jobTitle: true,
        isOwner: true,
        user: { select: { email: true, avatarUrl: true } },
      },
    });
  }

  async inviteStaff(
    tenantId: string,
    inviterUserId: string,
    email: string,
    role: TenantRole,
    jobTitle?: string,
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
        jobTitle: jobTitle?.trim() || null,
        status: 'INVITED',
        inviteToken: token,
        inviteExpiresAt: expiresAt,
      },
      update: {
        role,
        jobTitle: jobTitle?.trim() || null,
        status: 'INVITED',
        inviteToken: token,
        inviteExpiresAt: expiresAt,
      },
      include: {
        tenant: { select: { name: true } },
      },
    });

    const baseUrl = this.config.get<string>('appFrontendUrl');
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
