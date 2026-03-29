import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class UploadsService {
  private readonly storageType: string;
  private s3Client?: S3Client;
  private s3Bucket?: string;
  private s3PublicUrl?: string;

  constructor(private readonly config: ConfigService) {
    this.storageType = this.config.get<string>('storage.type') ?? 'local';

    if (this.storageType === 's3') {
      this.s3Client = new S3Client({
        region: this.config.get<string>('storage.aws.region') ?? 'us-east-1',
        credentials: {
          accessKeyId: this.config.get<string>('storage.aws.accessKeyId') ?? '',
          secretAccessKey: this.config.get<string>('storage.aws.secretAccessKey') ?? '',
        },
      });
      this.s3Bucket = this.config.get<string>('storage.aws.bucket');
      this.s3PublicUrl = this.config.get<string>('storage.aws.publicUrl');
    }
  }

  /**
   * Takes a multer file (already on disk when storageType=local) and either:
   *  - local: returns the public URL for the file already written to /uploads
   *  - s3: uploads the buffer to S3 and returns the public URL
   */
  async handleUpload(file: Express.Multer.File): Promise<string> {
    if (this.storageType === 's3') {
      return this.uploadToS3(file);
    }
    return this.getLocalUrl(file);
  }

  private getLocalUrl(file: Express.Multer.File): string {
    const apiBaseUrl = this.config.get<string>('appBaseUrl') ?? 'http://localhost:3001';
    // file.filename is set by multer diskStorage
    return `${apiBaseUrl}/uploads/${file.filename}`;
  }

  private async uploadToS3(file: Express.Multer.File): Promise<string> {
    if (!this.s3Client || !this.s3Bucket) {
      throw new InternalServerErrorException('S3 storage not configured');
    }

    const ext = path.extname(file.originalname);
    const key = `uploads/${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;

    // Read from disk (multer diskStorage) or use buffer (memoryStorage)
    const body = file.buffer ?? fs.readFileSync(file.path);

    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.s3Bucket,
        Key: key,
        Body: body,
        ContentType: file.mimetype,
        ACL: 'public-read',
      }),
    );

    const base = this.s3PublicUrl ?? `https://${this.s3Bucket}.s3.amazonaws.com`;
    return `${base}/${key}`;
  }
}
