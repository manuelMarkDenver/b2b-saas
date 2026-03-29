import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import * as path from 'path';
import * as fs from 'fs';
import { createTestApp, loginAs } from './helpers/app.helper';

// Minimal 1×1 PNG (67 bytes)
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI6QAAAABJRU5ErkJggg==',
  'base64',
);

describe('Uploads (e2e)', () => {
  let app: INestApplication<App>;
  let peakToken: string;

  beforeAll(async () => {
    app = await createTestApp();
    peakToken = await loginAs(app, 'owner@peak-hardware.test');
  });

  afterAll(async () => {
    // Clean up any test upload files from the uploads directory
    const uploadsDir = path.join(process.cwd(), 'uploads');
    if (fs.existsSync(uploadsDir)) {
      const files = fs.readdirSync(uploadsDir).filter((f) => f.startsWith('test-'));
      files.forEach((f) => fs.unlinkSync(path.join(uploadsDir, f)));
    }
    await app.close();
  });

  describe('POST /uploads', () => {
    it('uploads a valid PNG and returns a url', async () => {
      // Write to a temp file so multer reads it from disk (required for diskStorage)
      const tmpFile = path.join(require('os').tmpdir(), `test-upload-${Date.now()}.png`);
      fs.writeFileSync(tmpFile, TINY_PNG);

      const res = await request(app.getHttpServer())
        .post('/uploads')
        .set('Authorization', `Bearer ${peakToken}`)
        .attach('file', tmpFile);

      fs.unlinkSync(tmpFile);

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('url');
      expect(typeof res.body.url).toBe('string');
      expect(res.body.url).toMatch(/\/uploads\//);
    });

    it('returns 401 without a token', async () => {
      const res = await request(app.getHttpServer())
        .post('/uploads')
        .attach('file', TINY_PNG, { filename: 'test-image.png', contentType: 'image/png' });

      expect(res.status).toBe(401);
    });

    it('returns 400 for a non-image file type', async () => {
      const res = await request(app.getHttpServer())
        .post('/uploads')
        .set('Authorization', `Bearer ${peakToken}`)
        .attach('file', Buffer.from('not an image'), {
          filename: 'test-doc.txt',
          contentType: 'text/plain',
        });

      expect(res.status).toBe(400);
    });

    it('returns 400 when no file is attached', async () => {
      const res = await request(app.getHttpServer())
        .post('/uploads')
        .set('Authorization', `Bearer ${peakToken}`);

      expect(res.status).toBe(400);
    });
  });
});
