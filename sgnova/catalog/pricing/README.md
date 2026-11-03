# BDT pricing and controlled publication

Two scripts take the verified real catalog from unpriced drafts to published products. Both default to a **dry run**. Neither ever invents a price.

## 1. Bulk BDT pricing (`apps/backend/src/scripts/apply-bdt-prices.ts`)

Start from `bdt-price-import.template.csv`, one row per product. XLSX sheets: export as **UTF-8 CSV** first. JSON arrays with the same keys also work.

| Column | Required | Notes |
| --- | --- | --- |
| `sku` / `mpn` / `gtin` | one of them | Matched exactly, in that order, against the product's variant SKU, `metadata.mpn` and `metadata.gtin` |
| `brand`, `model` | recommended | Must agree with the catalog, or the row is rejected |
| `supplier` | yes | Kept only in the private ledger, never in Medusa |
| `source_type` | yes | `supplier_quote`, `distributor_price_list` or `retail_reference` (see below) |
| `quote_date` | yes | `YYYY-MM-DD`; rejected when older than `PRICE_MAX_QUOTE_AGE_DAYS` (default 30) |
| `valid_until` | optional | Rejected once the quotation has expired |
| `currency` | yes | Must be `BDT` |
| `cost_price_bdt` | optional | Supplier cost. **Private:** ledger only; a selling price below cost is rejected |
| `selling_price_bdt` | yes | Customer price in Taka (positive, at most ৳10,000,000) |
| `warranty` | optional | Shown on the product page |
| `availability` | yes | `in_stock`, `backorder`, `preorder` or `out_of_stock` |
| `stock_qty` | optional | Recorded in the ledger |
| `approved_by` | yes to apply | Rows without an approver are reported but never applied |

**Rules**
- `retail_reference` rows, such as public shop prices observed for comparison, are recorded in the report for review and **never applied**. They are not dealer costs or approved selling prices.
- Duplicate rows for one product, unmatched or multi-matched identifiers, brand/model mismatches, invalid amounts, a non-BDT currency, and stale or expired quotes are all errors.
- Rows whose supplier or approver contains "fixture", "test" or "dry-run" are never applied, even with `PRICE_APPLY=1`.
- On apply, the script:
  1. writes a rollback file;
  2. sets the variant's BDT price;
  3. records the public fields `price_status=approved`, `price_approved_at`, `availability` and `warranty` in product metadata.

  Supplier names and costs are **never** written to Medusa, because product metadata is readable through the public Store API.
- Reports and rollback files go to `sgnova/catalog/pricing/private/` (git-ignored).

```bash
cd apps/backend
PRICE_FILE=/path/to/prices.csv pnpm exec medusa exec ./src/scripts/apply-bdt-prices.ts                  # dry run
PRICE_FILE=/path/to/prices.csv PRICE_APPLY=1 pnpm exec medusa exec ./src/scripts/apply-bdt-prices.ts    # apply
PRICE_ROLLBACK=../../sgnova/catalog/pricing/private/price-rollback-<stamp>.json pnpm exec medusa exec ./src/scripts/apply-bdt-prices.ts
```

## 2. Controlled publication (`apps/backend/src/scripts/publish-real-catalog.ts`)

**Dry run (default).** Audits every real product and writes `sgnova/catalog/publication/publication-report-<stamp>.json` (git-ignored). A product is publishable only when it has all of the following:

- an approved BDT selling price;
- availability set;
- `review_status=auto_verified` (no blocking review notes);
- a thumbnail and a gallery;
- photo attribution with a licence;
- the Open Icecat licence notice, for Icecat content;
- at least 5 specifications, a category and a sales channel;
- a unique SKU.

**Publish a bounded batch** (records a rollback ledger):

```bash
PUBLISH_APPLY=1 PUBLISH_CONFIRM=publish-real-catalog PUBLISH_BATCH=50 pnpm exec medusa exec ./src/scripts/publish-real-catalog.ts
```

Search indexing follows automatically from `product.updated` events. The script re-reads the statuses to confirm the publication.

**Retire synthetic products** (separate step, only after replacements are live). This moves synthetic products back to **draft** (never deletes them), only in categories that already have at least `RETIRE_MIN_REAL` (default 10) published real products:

```bash
RETIRE_SYNTHETIC=1 PUBLISH_CONFIRM=retire-synthetic-catalog pnpm exec medusa exec ./src/scripts/publish-real-catalog.ts
```

**Roll back** either step:

```bash
PUBLISH_ROLLBACK=../../sgnova/catalog/publication/<ledger>.json pnpm exec medusa exec ./src/scripts/publish-real-catalog.ts
```

**Before deploying,** re-run `import-verified-catalog.ts` with `SGNOVA_IMAGE_BASE_URL=https://<storefront-domain>`, so the Wikimedia Commons photos stop pointing at localhost. Icecat images already use the Icecat CDN.
