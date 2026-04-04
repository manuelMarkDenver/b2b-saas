import {
  Controller,
  MaxFileSizeValidator,
  FileTypeValidator,
  ParseFilePipe,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as path from 'path';
import * as fs from 'fs';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../common/auth/tenant.guard';
import { UploadsService } from './uploads.service';

// Ensure uploads dir exists at startup
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

@Controller('uploads')
@UseGuards(JwtAuthGuard, TenantGuard)
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: uploadsDir,
        filename: (_req, file, cb) => {
          const ext = path.extname(file.originalname);
          const name = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
          cb(null, name);
        },
      }),
    }),
  )
  async upload(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }), // 5 MB
          new FileTypeValidator({ fileType: /image\/(jpeg|png|webp|gif)/, fallbackToMimetype: true }),
        ],
      }),
    )
    file: Express.Multer.File,
    @Req() req: Request & { tenant?: { id: string } },
    @Query('resourceType') resourceType?: string,
    @Query('branchId') branchId?: string,
  ) {
    const url = await this.uploadsService.handleUpload(file, {
      tenantId: req.tenant?.id,
      resourceType,
      branchId,
    });
    return { url };
  }
}
