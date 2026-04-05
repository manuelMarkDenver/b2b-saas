import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';

@Injectable()
export class SuppliersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string, page: number, limit: number, search?: string, isActive?: boolean) {
    const skip = (page - 1) * limit;
    const where: Prisma.SupplierWhereInput = { tenantId };
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { contactName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (isActive !== undefined) where.isActive = isActive;

    const [data, total] = await this.prisma.$transaction([
      this.prisma.supplier.findMany({ where, orderBy: { name: 'asc' }, skip, take: limit }),
      this.prisma.supplier.count({ where }),
    ]);
    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async create(tenantId: string, role: string, dto: CreateSupplierDto) {
    if (role !== 'OWNER' && role !== 'ADMIN') {
      throw new ForbiddenException('Only OWNER or ADMIN can manage suppliers');
    }

    try {
      return await this.prisma.supplier.create({
        data: { tenantId, name: dto.name, contactName: dto.contactName ?? null, phone: dto.phone ?? null, email: dto.email ?? null, address: dto.address ?? null, isActive: dto.isActive ?? true },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('A supplier with that name already exists');
      }
      throw e;
    }
  }

  async update(tenantId: string, role: string, id: string, dto: UpdateSupplierDto) {
    if (role !== 'OWNER' && role !== 'ADMIN') {
      throw new ForbiddenException('Only OWNER or ADMIN can manage suppliers');
    }

    const existing = await this.prisma.supplier.findFirst({ where: { id, tenantId } });
    if (!existing) throw new NotFoundException('Supplier not found');

    try {
      return await this.prisma.supplier.update({
        where: { id },
        data: {
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.contactName !== undefined && { contactName: dto.contactName }),
          ...(dto.phone !== undefined && { phone: dto.phone }),
          ...(dto.email !== undefined && { email: dto.email }),
          ...(dto.address !== undefined && { address: dto.address }),
          ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('A supplier with that name already exists');
      }
      throw e;
    }
  }
}
