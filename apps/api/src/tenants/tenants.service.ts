import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class TenantsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(name: string, slug: string, createdByUserId: string) {
    const normalizedSlug = slug.trim().toLowerCase();
    const existing = await this.prisma.tenant.findUnique({
      where: { slug: normalizedSlug },
    });

    if (existing) {
      throw new ConflictException('Tenant slug already in use');
    }

    return this.prisma.tenant.create({
      data: {
        name: name.trim(),
        slug: normalizedSlug,
        createdByUserId,
      },
    });
  }

  list() {
    return this.prisma.tenant.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }
}
