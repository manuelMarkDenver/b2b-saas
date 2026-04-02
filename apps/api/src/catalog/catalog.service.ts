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
    const product = await this.prisma.product.findFirst({
      where: { id: productId, tenantId },
      select: { id: true },
    });
    if (!product) throw new NotFoundException('Product not found');

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

  async listSkus(
    tenantId: string,
    page: number,
    limit: number,
    filters: { search?: string; categoryId?: string; lowStock?: boolean } = {},
  ) {
    const skip = (page - 1) * limit;

    const andClauses: object[] = [{ tenantId }, { isArchived: false }];

    if (filters.search) {
      andClauses.push({
        OR: [
          { name: { contains: filters.search, mode: 'insensitive' } },
          { code: { contains: filters.search, mode: 'insensitive' } },
          { product: { name: { contains: filters.search, mode: 'insensitive' } } },
        ],
      });
    }
    if (filters.categoryId) {
      andClauses.push({ product: { categoryId: filters.categoryId } });
    }
    if (filters.lowStock) {
      // Items with stock at or below their low-stock threshold (minimum 1 to exclude zero-threshold SKUs)
      andClauses.push({ lowStockThreshold: { gt: 0 }, stockOnHand: { lte: 10 } });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where = { AND: andClauses } as any;

    const [data, total] = await this.prisma.$transaction([
      this.prisma.sku.findMany({
        where,
        include: {
          product: {
            select: {
              id: true,
              name: true,
              category: { select: { id: true, name: true, slug: true } },
            },
          },
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
    imageUrl?: string;
  }) {
    const sku = await this.prisma.sku.findFirst({
      where: { id: skuId, tenantId },
      select: { id: true },
    });
    if (!sku) throw new NotFoundException('SKU not found');

    return this.prisma.sku.update({
      where: { id: skuId },
      data: {
        name: data.name?.trim(),
        priceCents: data.priceCents === undefined ? undefined : data.priceCents ?? null,
        costCents: data.costCents === undefined ? undefined : data.costCents ?? null,
        barcode: data.barcode === undefined ? undefined : data.barcode?.trim() || null,
        lowStockThreshold: data.lowStockThreshold,
        isActive: data.isActive,
        imageUrl: data.imageUrl === undefined ? undefined : data.imageUrl ?? null,
      },
    });
  }

  async archiveSku(tenantId: string, skuId: string, role: string) {
    if (role !== 'OWNER' && role !== 'ADMIN') {
      throw new ForbiddenException('Only OWNER or ADMIN can archive SKUs');
    }
    const sku = await this.prisma.sku.findFirst({
      where: { id: skuId, tenantId },
      select: { id: true },
    });
    if (!sku) throw new NotFoundException('SKU not found');

    return this.prisma.sku.update({
      where: { id: skuId },
      data: { isArchived: true, isActive: false },
    });
  }

  async archiveProduct(tenantId: string, productId: string, role: string) {
    if (role !== 'OWNER' && role !== 'ADMIN') {
      throw new ForbiddenException('Only OWNER or ADMIN can archive products');
    }
    const product = await this.prisma.product.findFirst({
      where: { id: productId, tenantId },
      select: { id: true },
    });
    if (!product) throw new NotFoundException('Product not found');

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

  async generateNextSkuCode(tenantId: string, categoryId: string): Promise<string> {
    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
      select: { slug: true },
    });
    if (!category) throw new NotFoundException('Category not found');

    // Derive a 3-char prefix from slug (e.g. "food-beverage" → "FOO", "hardware" → "HRD")
    const slug = category.slug.replace(/-/g, '').toUpperCase();
    const prefix = (slug.length >= 3 ? `${slug[0]}${slug[1]}${slug[2]}` : slug.padEnd(3, 'X'));

    const count = await this.prisma.sku.count({
      where: { tenantId, code: { startsWith: `${prefix}-` } },
    });
    return `${prefix}-${String(count + 1).padStart(4, '0')}`;
  }

  async createProductWithStock(
    tenantId: string,
    data: {
      categoryId: string;
      name: string;
      code?: string;
      priceCents?: number;
      costCents?: number;
      lowStockThreshold?: number;
      initialQty?: number;
      note?: string;
      imageUrl?: string;
    },
    branchId?: string,
  ) {
    const category = await this.prisma.category.findUnique({
      where: { id: data.categoryId },
      select: { id: true },
    });
    if (!category) throw new NotFoundException('Category not found');

    // Use custom code if provided, otherwise auto-generate
    let code: string;
    if (data.code?.trim()) {
      code = data.code.trim();
      // Check for uniqueness
      const existing = await this.prisma.sku.findFirst({
        where: { tenantId, code },
        select: { id: true },
      });
      if (existing) throw new ConflictException('SKU code already exists for tenant');
    } else {
      code = await this.generateNextSkuCode(tenantId, data.categoryId);
    }

    return this.prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: { tenantId, categoryId: data.categoryId, name: data.name.trim() },
      });

      const sku = await tx.sku.create({
        data: {
          tenantId,
          productId: product.id,
          code,
          name: data.name.trim(),
          priceCents: data.priceCents ?? null,
          costCents: data.costCents ?? null,
          imageUrl: data.imageUrl ?? null,
          stockOnHand: 0,
          lowStockThreshold: data.lowStockThreshold ?? 0,
        },
      });

      if (data.initialQty && data.initialQty > 0) {
        await tx.inventoryMovement.create({
          data: {
            tenantId,
            skuId: sku.id,
            type: 'IN',
            quantity: data.initialQty,
            referenceType: 'MANUAL',
            note: data.note ?? 'Initial stock',
            branchId: branchId ?? null,
          },
        });
        await tx.sku.update({
          where: { id: sku.id },
          data: { stockOnHand: data.initialQty },
        });
      }

      return { product, sku };
    });
  }

}
