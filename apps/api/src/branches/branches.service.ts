import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';

type MutatingRole = string;

function requireOwnerOrAdmin(role: MutatingRole) {
  if (role !== 'OWNER' && role !== 'ADMIN') {
    throw new ForbiddenException('Only OWNER or ADMIN can manage branches');
  }
}

@Injectable()
export class BranchesService {
  constructor(private readonly prisma: PrismaService) {}

  list(tenantId: string) {
    return this.prisma.branch.findMany({
      where: { tenantId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
      select: { id: true, name: true, isDefault: true, status: true, type: true },
    });
  }

  async create(tenantId: string, role: MutatingRole, dto: CreateBranchDto) {
    requireOwnerOrAdmin(role);

    const nameConflict = await this.prisma.branch.findFirst({
      where: { tenantId, name: { equals: dto.name, mode: 'insensitive' } },
      select: { id: true },
    });
    if (nameConflict) {
      throw new ConflictException('A branch with that name already exists');
    }

    return this.prisma.branch.create({
      data: {
        tenantId,
        name: dto.name.trim(),
        address: dto.address?.trim(),
        ...(dto.type !== undefined && { type: dto.type }),
      },
    });
  }

  async update(tenantId: string, role: MutatingRole, branchId: string, dto: UpdateBranchDto) {
    requireOwnerOrAdmin(role);

    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, tenantId },
    });
    if (!branch) throw new NotFoundException('Branch not found');

    if (dto.name && dto.name.trim() !== branch.name) {
      const nameConflict = await this.prisma.branch.findFirst({
        where: {
          tenantId,
          name: { equals: dto.name.trim(), mode: 'insensitive' },
          id: { not: branchId },
        },
        select: { id: true },
      });
      if (nameConflict) {
        throw new ConflictException('A branch with that name already exists');
      }
    }

    if (dto.status === 'INACTIVE' && branch.isDefault) {
      throw new BadRequestException('Cannot deactivate the default branch');
    }

    return this.prisma.branch.update({
      where: { id: branchId },
      data: {
        ...(dto.name !== undefined && { name: dto.name.trim() }),
        ...(dto.address !== undefined && { address: dto.address?.trim() }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.type !== undefined && { type: dto.type }),
      },
    });
  }

  /** Called by TenantsService on tenant creation — creates the first default branch. */
  createDefault(tenantId: string, name = 'Main Branch') {
    return this.prisma.branch.create({
      data: { tenantId, name, isDefault: true },
    });
  }

  /** Resolve a branch ID from the x-branch-id header — validates it belongs to tenant. */
  async resolve(tenantId: string, branchId?: string) {
    if (!branchId) return null;
    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, tenantId, status: 'ACTIVE' },
      select: { id: true },
    });
    if (!branch) throw new NotFoundException('Branch not found or inactive');
    return branch;
  }
}
