import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  listCategories() {
    return this.prisma.category.findMany({ orderBy: { name: 'asc' } });
  }

  async createCategory(name: string, slug: string) {
    const normalized = slug.trim().toLowerCase();
    try {
      return await this.prisma.category.create({
        data: { name: name.trim(), slug: normalized },
      });
    } catch {
      throw new ConflictException('Category slug already exists');
    }
  }

  listProducts(tenantId: string) {
    return this.prisma.product.findMany({
      where: { tenantId, isArchived: false },
      include: {
        category: { select: { id: true, name: true, slug: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createProduct(tenantId: string, categoryId: string, data: {
    name: string;
    description?: string;
  }) {
    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
      select: { id: true },
    });
    if (!category) throw new NotFoundException('Category not found');

    return this.prisma.product.create({
      data: {
        tenantId,
        categoryId,
        name: data.name.trim(),
        description: data.description?.trim() || null,
      },
    });
  }

  async updateProduct(tenantId: string, productId: string, data: {
    categoryId?: string;
    name?: string;
    description?: string;
    isActive?: boolean;
  }) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, tenantId: true },
    });
    if (!product) throw new NotFoundException('Product not found');
    if (product.tenantId !== tenantId) throw new ForbiddenException();

    if (data.categoryId) {
      const category = await this.prisma.category.findUnique({
        where: { id: data.categoryId },
        select: { id: true },
      });
      if (!category) throw new NotFoundException('Category not found');
    }

    return this.prisma.product.update({
      where: { id: productId },
      data: {
        categoryId: data.categoryId,
        name: data.name?.trim(),
        description:
          data.description === undefined
            ? undefined
            : data.description?.trim() || null,
        isActive: data.isActive,
      },
    });
  }

  async listSkus(tenantId: string, page: number, limit: number) {
    const skip = (page - 1) * limit;
    const where = { tenantId, isArchived: false };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.sku.findMany({
        where,
        include: {
          product: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.sku.count({ where }),
    ]);
    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async createSku(tenantId: string, data: {
    productId: string;
    code: string;
    name: string;
    priceCents?: number;
    costCents?: number;
    barcode?: string;
    lowStockThreshold?: number;
  }) {
    const product = await this.prisma.product.findUnique({
      where: { id: data.productId },
      select: { id: true, tenantId: true },
    });
    if (!product) throw new NotFoundException('Product not found');
    if (product.tenantId !== tenantId) throw new ForbiddenException();

    const code = data.code.trim();
    try {
      return await this.prisma.sku.create({
        data: {
          tenantId,
          productId: data.productId,
          code,
          name: data.name.trim(),
          priceCents: data.priceCents ?? null,
          costCents: data.costCents ?? null,
          barcode: data.barcode?.trim() || null,
          stockOnHand: 0,
          lowStockThreshold: data.lowStockThreshold ?? 0,
        },
      });
    } catch {
      throw new ConflictException('SKU code already exists for tenant');
    }
  }

  async updateSku(tenantId: string, skuId: string, data: {
    name?: string;
    priceCents?: number;
    costCents?: number;
    barcode?: string;
    lowStockThreshold?: number;
    isActive?: boolean;
  }) {
    const sku = await this.prisma.sku.findUnique({
      where: { id: skuId },
      select: { id: true, tenantId: true },
    });
    if (!sku) throw new NotFoundException('SKU not found');
    if (sku.tenantId !== tenantId) throw new ForbiddenException();

    return this.prisma.sku.update({
      where: { id: skuId },
      data: {
        name: data.name?.trim(),
        priceCents: data.priceCents === undefined ? undefined : data.priceCents ?? null,
        costCents: data.costCents === undefined ? undefined : data.costCents ?? null,
        barcode: data.barcode === undefined ? undefined : data.barcode?.trim() || null,
        lowStockThreshold: data.lowStockThreshold,
        isActive: data.isActive,
      },
    });
  }

  async archiveSku(tenantId: string, skuId: string, role: string) {
    if (role !== 'OWNER' && role !== 'ADMIN') {
      throw new ForbiddenException('Only OWNER or ADMIN can archive SKUs');
    }
    const sku = await this.prisma.sku.findUnique({
      where: { id: skuId },
      select: { id: true, tenantId: true },
    });
    if (!sku) throw new NotFoundException('SKU not found');
    if (sku.tenantId !== tenantId) throw new ForbiddenException();

    return this.prisma.sku.update({
      where: { id: skuId },
      data: { isArchived: true, isActive: false },
    });
  }

  async archiveProduct(tenantId: string, productId: string, role: string) {
    if (role !== 'OWNER' && role !== 'ADMIN') {
      throw new ForbiddenException('Only OWNER or ADMIN can archive products');
    }
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, tenantId: true },
    });
    if (!product) throw new NotFoundException('Product not found');
    if (product.tenantId !== tenantId) throw new ForbiddenException();

    await this.prisma.$transaction([
      this.prisma.product.update({
        where: { id: productId },
        data: { isArchived: true, isActive: false },
      }),
      this.prisma.sku.updateMany({
        where: { productId, tenantId },
        data: { isArchived: true, isActive: false },
      }),
    ]);

    return this.prisma.product.findUnique({ where: { id: productId } });
  }

}
