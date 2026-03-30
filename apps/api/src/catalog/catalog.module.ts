import { Module } from '@nestjs/common';
import { PrismaModule } from '../common/prisma/prisma.module';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';
import { CatalogImportService } from './catalog-import.service';

@Module({
  imports: [PrismaModule],
  controllers: [CatalogController],
  providers: [CatalogService, CatalogImportService],
})
export class CatalogModule {}
