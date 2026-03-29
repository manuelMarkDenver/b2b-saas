import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { PaginationDto } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../common/auth/admin.guard';
import { TenantGuard } from '../common/auth/tenant.guard';
import type { RequestWithUser } from '../common/auth/auth.types';
import { Req } from '@nestjs/common';
import { CatalogService } from './catalog.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { CreateSkuDto } from './dto/create-sku.dto';
import { UpdateSkuDto } from './dto/update-sku.dto';

@Controller()
@UseGuards(JwtAuthGuard)
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

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

  // SKUs (tenant-scoped)
  @Get('skus')
  @UseGuards(TenantGuard)
  listSkus(@Req() req: RequestWithUser, @Query() pagination: PaginationDto) {
    return this.catalogService.listSkus(req.tenant!.id, pagination.page ?? 1, pagination.limit ?? 20);
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
}
