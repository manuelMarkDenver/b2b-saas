# CSV Product Import

Bulk-import products and SKUs into Zentral via CSV — the fastest way for a
newly onboarded client to populate their catalog.

---

## Where to find it

**Inventory → top bar → Import CSV** (OWNER and ADMIN only)

---

## Template columns

Download the template directly from the dialog. It includes a sample row.

| Column | Required | Description | Example |
|--------|----------|-------------|---------|
| `productName` | ✓ | Parent product group name | `Manager's Pizza Dough` |
| `categorySlug` | ✓ | Lowercase slug matching an existing category | `ingredients` |
| `skuCode` | ✓ | Unique identifier for this variant — must be unique across the tenant | `DOUGH-500G` |
| `skuName` | ✓ | Variant description (size, colour, unit, etc.) | `500g bag` |
| `pricePhp` | ✓ | Selling price in ₱ — decimal notation | `120.00` |
| `costPhp` | ✓ | Purchase / production cost in ₱ — used for margin reporting | `60.00` |
| `lowStockThreshold` | ✓ | Whole number — stock alert fires at or below this qty. Use `0` to disable | `10` |

> Extra columns beyond these 7 are ignored by the API.

---

## Import behaviour

- **New SKU code** → creates the product + SKU
- **Existing SKU code** → updates name, price, cost, threshold (upsert)
- **New product name, same category** → creates one product with multiple SKUs
- **Unknown categorySlug** → row is skipped with an error message

---

## Client-side preview (before upload hits the API)

The dialog validates and previews your file **before** sending anything:

1. **Drop or select** your `.csv` file
2. **Column check** — green/red chips for every required header.
   Import button is disabled until all 7 columns are present.
3. **Preview table** — first 8 rows, all columns, scrollable.
   Lets you visually confirm the data looks right.
4. **Row count** — "48 total rows will be processed"
5. Click **Import N rows** — only enabled when headers are valid

This flow matches what top ERP and POS tools do (Toast, Zoho Inventory,
Lightspeed) and prevents the most common import mistakes before data
ever reaches the server.

---

## Post-import summary

After import completes the dialog shows:

```
12 added    3 updated    0 skipped
Row 7: SKU code DOUGH-500G already exists under a different product
```

---

## Tips for new clients

- **Prepare your spreadsheet first** — use Excel or Google Sheets, then export
  as CSV (File → Download → CSV)
- **Category slugs must already exist** — create your categories in
  Settings → Categories before importing
- **SKU codes are permanent identifiers** — choose them carefully
  (e.g. `PROD-001`, `CEMENT-50KG`). They tie inventory movements to products.
- **Prices and costs in plain numbers** — no ₱ symbol, no commas.
  `1500.00` not `₱1,500`
- **Low stock threshold = 0** means no alert for that SKU

---

## API endpoint

`POST /catalog/import` — multipart/form-data, `file` field.

Returns:
```json
{
  "imported": 12,
  "updated": 3,
  "skipped": 0,
  "errors": [
    { "row": 7, "reason": "SKU code already exists under a different product" }
  ]
}
```
