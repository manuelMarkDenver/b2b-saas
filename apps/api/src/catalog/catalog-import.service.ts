import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

export type ImportResult = {
  imported: number;
  updated: number;
  skipped: number;
  errors: Array<{ row: number; reason: string }>;
};

type CsvRow = Record<string, string>;

const REQUIRED_FIELDS = ['skuCode', 'skuName', 'productName', 'categorySlug'] as const;

function toCents(raw: string | undefined): number | null {
  if (!raw?.trim()) return null;
  const n = parseFloat(raw.trim());
  if (isNaN(n)) return null;
  return Math.round(n * 100);
}

function normalizeHeaders(row: CsvRow): CsvRow {
  // Support both camelCase and snake_case column names
  const aliases: Record<string, string> = {
    sku_code: 'skuCode',
    sku_name: 'skuName',
    product_name: 'productName',
    category_slug: 'categorySlug',
    price_cents: 'priceCents',
    price_php: 'pricePhp',
    cost_cents: 'costCents',
    cost_php: 'costPhp',
    low_stock_threshold: 'lowStockThreshold',
  };
  const out: CsvRow = {};
  for (const [k, v] of Object.entries(row)) {
    out[aliases[k.trim()] ?? k.trim()] = v;
  }
  return out;
}

@Injectable()
export class CatalogImportService {
  constructor(private readonly prisma: PrismaService) {}

  async importCsv(tenantId: string, fileBuffer: Buffer): Promise<ImportResult> {
    const text = fileBuffer.toString('utf-8');
    const rows = this.parseCsv(text);

    if (rows.length === 0) {
      return { imported: 0, updated: 0, skipped: 0, errors: [{ row: 0, reason: 'File is empty or has no data rows' }] };
    }

    // Pre-fetch all categories (slug → id)
    const categories = await this.prisma.category.findMany({ select: { id: true, slug: true } });
    const categoryMap = new Map(categories.map((c) => [c.slug, c.id]));

    // Pre-fetch existing products for this tenant (name → id)
    const existingProducts = await this.prisma.product.findMany({
      where: { tenantId },
      select: { id: true, name: true },
    });
    const productMap = new Map(existingProducts.map((p) => [p.name.trim().toLowerCase(), p.id]));

    // Pre-fetch existing SKU codes for this tenant
    const existingSkus = await this.prisma.sku.findMany({
      where: { tenantId },
      select: { id: true, code: true },
    });
    const skuMap = new Map(existingSkus.map((s) => [s.code.trim().toLowerCase(), s.id]));

    // Detect duplicate skuCodes within the file itself
    const seenCodes = new Set<string>();

    const result: ImportResult = { imported: 0, updated: 0, skipped: 0, errors: [] };

    for (let i = 0; i < rows.length; i++) {
      const rowNum = i + 2; // 1-indexed, +1 for header
      const raw = normalizeHeaders(rows[i]);

      // Required field check
      const missing = REQUIRED_FIELDS.filter((f) => !raw[f]?.trim());
      if (missing.length > 0) {
        result.errors.push({ row: rowNum, reason: `Missing required fields: ${missing.join(', ')}` });
        result.skipped++;
        continue;
      }

      const skuCode = raw.skuCode.trim();
      const skuCodeKey = skuCode.toLowerCase();

      // Duplicate within file
      if (seenCodes.has(skuCodeKey)) {
        result.errors.push({ row: rowNum, reason: `Duplicate SKU code in file: ${skuCode}` });
        result.skipped++;
        continue;
      }
      seenCodes.add(skuCodeKey);

      // Category validation
      const categoryId = categoryMap.get(raw.categorySlug.trim().toLowerCase());
      if (!categoryId) {
        result.errors.push({ row: rowNum, reason: `Unknown category slug: ${raw.categorySlug.trim()}` });
        result.skipped++;
        continue;
      }

      // Resolve price/cost — prefer explicit cents, fall back to PHP × 100
      const priceCents = raw.priceCents ? toCents(raw.priceCents) : toCents(raw.pricePhp);
      const costCents = raw.costCents ? toCents(raw.costCents) : toCents(raw.costPhp);
      const lowStockThreshold = raw.lowStockThreshold ? parseInt(raw.lowStockThreshold.trim(), 10) : 0;

      const productName = raw.productName.trim();
      const productKey = productName.toLowerCase();

      try {
        // Upsert product
        let productId = productMap.get(productKey);
        if (!productId) {
          const product = await this.prisma.product.create({
            data: { tenantId, categoryId, name: productName },
            select: { id: true },
          });
          productId = product.id;
          productMap.set(productKey, productId);
        }

        // Upsert SKU
        const existingSkuId = skuMap.get(skuCodeKey);
        if (existingSkuId) {
          await this.prisma.sku.update({
            where: { id: existingSkuId },
            data: {
              name: raw.skuName.trim(),
              priceCents: priceCents ?? undefined,
              costCents: costCents ?? undefined,
              lowStockThreshold: isNaN(lowStockThreshold) ? 0 : lowStockThreshold,
              productId,
            },
          });
          result.updated++;
        } else {
          const newSku = await this.prisma.sku.create({
            data: {
              tenantId,
              productId,
              code: skuCode,
              name: raw.skuName.trim(),
              priceCents: priceCents ?? null,
              costCents: costCents ?? null,
              lowStockThreshold: isNaN(lowStockThreshold) ? 0 : lowStockThreshold,
              stockOnHand: 0,
            },
            select: { id: true, code: true },
          });
          skuMap.set(newSku.code.toLowerCase(), newSku.id);
          result.imported++;
        }
      } catch {
        result.errors.push({ row: rowNum, reason: `Failed to import row — check for duplicate SKU code` });
        result.skipped++;
      }
    }

    return result;
  }

  private parseCsv(text: string): CsvRow[] {
    const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter((l) => l.trim());
    if (lines.length < 2) return [];

    const headers = this.splitCsvLine(lines[0]);
    const rows: CsvRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = this.splitCsvLine(lines[i]);
      const row: CsvRow = {};
      headers.forEach((h, idx) => {
        row[h.trim()] = values[idx]?.trim() ?? '';
      });
      rows.push(row);
    }

    return rows;
  }

  private splitCsvLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
    result.push(current);
    return result;
  }
}
