/**
 * Client-side CSV parsing and validation utilities.
 *
 * Used by the Inventory panel CSV import dialog to give users instant
 * feedback before the file ever hits the API.
 */

/** Column definitions for the product catalog import template. */
export const CATALOG_CSV_COLUMNS = [
  {
    key: 'productName',
    label: 'Product Name',
    required: true,
    example: "Manager's Pizza Dough",
    description: 'Name of the parent product group.',
  },
  {
    key: 'categorySlug',
    label: 'Category',
    required: true,
    example: 'ingredients',
    description: 'Lowercase slug matching an existing category (e.g. ingredients, packaging).',
  },
  {
    key: 'skuCode',
    label: 'SKU Code',
    required: true,
    example: 'DOUGH-500G',
    description: 'Unique identifier for this variant. Must be unique across your catalog.',
  },
  {
    key: 'skuName',
    label: 'SKU Name',
    required: true,
    example: '500g bag',
    description: 'Variant description (size, colour, unit, etc.).',
  },
  {
    key: 'pricePhp',
    label: 'Price (₱)',
    required: true,
    example: '120.00',
    description: 'Selling price in Philippine Peso. Use decimal notation.',
  },
  {
    key: 'costPhp',
    label: 'Cost (₱)',
    required: true,
    example: '60.00',
    description: 'Purchase / production cost. Used for margin reporting.',
  },
  {
    key: 'lowStockThreshold',
    label: 'Low Stock Alert',
    required: true,
    example: '10',
    description: 'Whole number. Stock alert fires when quantity falls to or below this value. Use 0 to disable.',
  },
] as const;

export type CatalogCsvColumnKey = (typeof CATALOG_CSV_COLUMNS)[number]['key'];
export const REQUIRED_CSV_HEADERS = CATALOG_CSV_COLUMNS.map((c) => c.key);

export type CsvPreview = {
  /** Column headers from row 1 of the file. */
  headers: string[];
  /** First N data rows (not including the header row). */
  rows: string[][];
  /** Total number of data rows in the file (excluding header). */
  totalRows: number;
};

export type ColumnValidation = {
  key: CatalogCsvColumnKey;
  label: string;
  present: boolean;
};

/**
 * Parse a raw CSV string and return a preview (headers + first N rows).
 * Handles quoted fields containing commas or newlines.
 */
export function parseCsvPreview(text: string, maxPreviewRows = 8): CsvPreview {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length === 0) return { headers: [], rows: [], totalRows: 0 };

  const headers = parseRow(lines[0]);
  const dataLines = lines.slice(1).filter((l) => l.trim().length > 0);

  return {
    headers,
    rows: dataLines.slice(0, maxPreviewRows).map(parseRow),
    totalRows: dataLines.length,
  };
}

/** Validate which required headers are present in the parsed header row. */
export function validateCsvHeaders(headers: string[]): ColumnValidation[] {
  const normalized = headers.map((h) => h.trim().toLowerCase());
  return CATALOG_CSV_COLUMNS.map((col) => ({
    key: col.key,
    label: col.label,
    present: normalized.includes(col.key.toLowerCase()),
  }));
}

/** Returns true only when every required column is present. */
export function allHeadersPresent(headers: string[]): boolean {
  return validateCsvHeaders(headers).every((v) => v.present);
}

// ─── Internal ────────────────────────────────────────────────────────────────

function parseRow(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      fields.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}
