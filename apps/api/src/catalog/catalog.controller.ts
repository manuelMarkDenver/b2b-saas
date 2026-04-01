import { Body, Controller, Get, Param, Patch, Post, Query, Req, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { PaginationDto } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../common/auth/admin.guard';
import { TenantGuard } from '../common/auth/tenant.guard';
import type { RequestWithUser } from '../common/auth/auth.types';
import { CatalogService } from './catalog.service';
import { CatalogImportService } from './catalog-import.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { CreateSkuDto } from './dto/create-sku.dto';
import { UpdateSkuDto } from './dto/update-sku.dto';

@Controller()
@UseGuards(JwtAuthGuard)
export class CatalogController {
  constructor(
    private readonly catalogService: CatalogService,
    private readonly importService: CatalogImportService,
  ) {}

  // Categories (platform-managed)
  @Get('categories')
  listCategories() {
    return this.catalogService.listCategories();
  }

  @Post('categories')
  @UseGuards(AdminGuard)
  createCategory(@Body() body: CreateCategoryDto) {
    return this.catalogService.createCategory(body.name, body.slug);
  }

  // Products (tenant-scoped)
  @Get('products')
  @UseGuards(TenantGuard)
  listProducts(@Req() req: RequestWithUser) {
    return this.catalogService.listProducts(req.tenant!.id);
  }

  @Post('products')
  @UseGuards(TenantGuard)
  createProduct(@Req() req: RequestWithUser, @Body() body: CreateProductDto) {
    return this.catalogService.createProduct(req.tenant!.id, body.categoryId, {
      name: body.name,
      description: body.description,
    });
  }

  @Patch('products/:id')
  @UseGuards(TenantGuard)
  updateProduct(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Body() body: UpdateProductDto,
  ) {
    return this.catalogService.updateProduct(req.tenant!.id, id, body);
  }

  @Patch('products/:id/archive')
  @UseGuards(TenantGuard)
  archiveProduct(@Req() req: RequestWithUser, @Param('id') id: string) {
    return this.catalogService.archiveProduct(req.tenant!.id, id, req.membership!.role);
  }

  // Auto-generate next SKU code preview
  @Get('skus/next-code')
  @UseGuards(TenantGuard)
  async getNextSkuCode(@Req() req: RequestWithUser, @Query('categoryId') categoryId: string) {
    const code = await this.catalogService.generateNextSkuCode(req.tenant!.id, categoryId);
    return { code };
  }

  // Create product + SKU + initial stock movement in one transaction
  @Post('products/with-stock')
  @UseGuards(TenantGuard)
  createProductWithStock(@Req() req: RequestWithUser, @Body() body: {
    categoryId: string;
    name: string;
    priceCents?: number;
    costCents?: number;
    initialQty?: number;
    note?: string;
    imageUrl?: string;
  }) {
    return this.catalogService.createProductWithStock(req.tenant!.id, body);
  }

  // SKUs (tenant-scoped)
  @Get('skus')
  @UseGuards(TenantGuard)
  listSkus(
    @Req() req: RequestWithUser,
    @Query() pagination: PaginationDto,
    @Query('search') search?: string,
    @Query('categoryId') categoryId?: string,
    @Query('lowStock') lowStock?: string,
  ) {
    return this.catalogService.listSkus(
      req.tenant!.id,
      pagination.page ?? 1,
      pagination.limit ?? 20,
      { search, categoryId, lowStock: lowStock === 'true' },
    );
  }

  @Post('skus')
  @UseGuards(TenantGuard)
  createSku(@Req() req: RequestWithUser, @Body() body: CreateSkuDto) {
    return this.catalogService.createSku(req.tenant!.id, body);
  }

  @Patch('skus/:id')
  @UseGuards(TenantGuard)
  updateSku(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Body() body: UpdateSkuDto,
  ) {
    return this.catalogService.updateSku(req.tenant!.id, id, body);
  }

  @Patch('skus/:id/archive')
  @UseGuards(TenantGuard)
  archiveSku(@Req() req: RequestWithUser, @Param('id') id: string) {
    return this.catalogService.archiveSku(req.tenant!.id, id, req.membership!.role);
  }

  @Post('catalog/import')
  @UseGuards(TenantGuard)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  importCsv(
    @Req() req: RequestWithUser,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      return { imported: 0, updated: 0, skipped: 0, errors: [{ row: 0, reason: 'No file uploaded' }] };
    }
    return this.importService.importCsv(req.tenant!.id, file.buffer);
  }
}
