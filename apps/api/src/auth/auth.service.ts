import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../common/prisma/prisma.service';
import { hash, compare } from 'bcryptjs';

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
