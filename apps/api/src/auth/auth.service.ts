import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'crypto';
import { hash, compare } from 'bcryptjs';
import { PrismaService } from '../common/prisma/prisma.service';
import { EmailService } from '../common/email/email.service';

type AuthUser = {
  id: string;
  email: string;
  isPlatformAdmin: boolean;
  status: 'ACTIVE' | 'DISABLED';
};

type LoginResult = {
  user: AuthUser;
  token: string;
  activeTenantId?: string | null;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly emailService: EmailService,
    private readonly config: ConfigService,
  ) {}

  async register(email: string, password: string): Promise<LoginResult> {
    const normalizedEmail = email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await hash(password, 12);
    const user = await this.prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
      },
    });

    const activeTenantId = await this.getDefaultTenantId(user.id);
    const token = this.signToken(user, activeTenantId);

    return { user: this.mapUser(user), token, activeTenantId };
  }

  async login(email: string, password: string): Promise<LoginResult> {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Invalid credentials');
    }

    const ok = await compare(password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const activeTenantId = await this.getDefaultTenantId(user.id);
    const token = this.signToken(user, activeTenantId);

    return { user: this.mapUser(user), token, activeTenantId };
  }

  async forgotPassword(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
      select: { id: true, email: true },
    });
    // Always return success — don't leak whether email exists
    if (!user) return;

    const token = randomUUID();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await this.prisma.user.update({
      where: { id: user.id },
      data: { resetToken: token, resetTokenExpiresAt: expiresAt },
    });

    const baseUrl = this.config.get<string>('appBaseUrl');
    const resetUrl = `${baseUrl}/reset-password?token=${token}`;
    await this.emailService.sendPasswordReset(user.email, resetUrl);
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { resetToken: token },
      select: { id: true, resetTokenExpiresAt: true },
    });

    if (!user || !user.resetTokenExpiresAt || user.resetTokenExpiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const passwordHash = await hash(newPassword, 12);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, resetToken: null, resetTokenExpiresAt: null },
    });
  }

  signToken(user: AuthUser, activeTenantId?: string | null): string {
    return this.jwtService.sign({
      sub: user.id,
      email: user.email,
      isPlatformAdmin: user.isPlatformAdmin,
      activeTenantId: activeTenantId ?? null,
    });
  }

  private async getDefaultTenantId(userId: string): Promise<string | null> {
    const membership = await this.prisma.tenantMembership.findFirst({
      where: { userId, status: 'ACTIVE' },
      orderBy: { createdAt: 'asc' },
      select: { tenantId: true },
    });
    return membership?.tenantId ?? null;
  }

  private mapUser(user: AuthUser): AuthUser {
    return {
      id: user.id,
      email: user.email,
      isPlatformAdmin: user.isPlatformAdmin,
      status: user.status,
    };
  }
}
