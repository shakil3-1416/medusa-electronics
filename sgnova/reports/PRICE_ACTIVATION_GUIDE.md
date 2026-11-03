# Activating Real Products: What You Need to Provide

Date: 2026-11-03. Nothing is priced, published or retired yet.

## Status

| | Products |
| --- | --- |
| Verified real products | 626 |
| **Ready to activate once priced** (in the template) | **589** across 29 categories |
| Blocked by manual review | 37 (33 photo, variant or table issues, plus 4 regional duplicates) |
| Not verified (refurbished SKUs) | 11 |

## Your template

`sgnova/catalog/pricing/private/supplier-price-template.csv` (git-ignored, UTF-8 CSV that opens in Excel).

Regenerate it at any time:

```bash
cd apps/backend && pnpm exec medusa exec ./src/scripts/export-price-template.ts
```

**Already filled in. Do not edit:** `handle`, `category`, `brand`, `model`, `title`, `sku`, `mpn`, `gtin`, and `currency` (pre-set to `BDT`).

- `sku` is the exact match key (589 of 589 rows).
- `mpn` is the manufacturer part number (476 rows); `gtin` is the barcode (339 rows).
- Rows without an `mpn` are identified by `brand`, `model` and `title`.

## Fields you must provide for each product you want to activate

| Field | Required | What to enter |
| --- | --- | --- |
| `selling_price_bdt` | **Yes** | Customer price in Taka, digits only (for example `14500`). Shown on the storefront. |
| `availability` | **Yes** | `in_stock`, `backorder`, `preorder` or `out_of_stock`. Out-of-stock products are held back from publishing unless you choose to include them. |
| `source_type` | **Yes** | `supplier_quote` or `distributor_price_list`. Use `retail_reference` only for comparison prices; those are **never** applied. |
| `supplier` | **Yes** | Supplier or distributor name. **Private:** stored only in the local ledger, never in Medusa. |
| `quote_date` | **Yes** | `YYYY-MM-DD`. Quotes older than 30 days are rejected (configurable). |
| `approved_by` | **Yes** | Your name or initials. Rows without an approver are never applied. |
| `cost_price_bdt` | Optional | Your purchase cost. **Private:** ledger only; a selling price below cost is rejected. |
| `valid_until` | Optional | Quote expiry date (`YYYY-MM-DD`); expired quotes are rejected. |
| `warranty` | Optional | For example "1 year official warranty". Shown on the product page. |
| `stock_qty` | Optional | Units on hand (ledger only). |
| `notes` | Optional | Anything for your own reference. |

Leave a row's price empty to keep that product unpublished: partial coverage is fine.

## What happens next (each step needs your go-ahead)

1. **Dry run.** Checks every row without changing anything and writes a report:
   ```bash
   PRICE_FILE=<your file> pnpm exec medusa exec ./src/scripts/apply-bdt-prices.ts
   ```
2. **Apply prices.** Writes BDT selling prices, plus a rollback file:
   ```bash
   PRICE_FILE=<your file> PRICE_APPLY=1 pnpm exec medusa exec ./src/scripts/apply-bdt-prices.ts
   ```
3. **Publish by category**, in bounded batches with a rollback ledger:
   ```bash
   PUBLISH_APPLY=1 PUBLISH_CONFIRM=publish-real-catalog PUBLISH_CATEGORIES=motherboard,hard-drive PUBLISH_BATCH=50 pnpm exec medusa exec ./src/scripts/publish-real-catalog.ts
   ```
4. **Retire fictional products** per category, only once at least 10 real ones are live there. This moves them to draft and never deletes them:
   ```bash
   RETIRE_SYNTHETIC=1 PUBLISH_CONFIRM=retire-synthetic-catalog pnpm exec medusa exec ./src/scripts/publish-real-catalog.ts
   ```

The full rules are in `sgnova/catalog/pricing/README.md`.

## Manual review: what is still needed (37)

- **Photo vs listing:**
  - Apple Watch Series 3: the photo shows a 38mm case, but the listing is 42mm.
  - Photos that may show older hardware revisions: Netgear GS108/GS108E, TP-Link A6/C9/WR841N/WR1043ND, G903.
  - Retail or event shots: Xiaomi 14 Ultra.
  - A Taiwan-SKU photo: APC BR700G.
- **Generation or variant not confirmable:** Watch Ultra (1st generation?), MacBook Air 15" M2, Keychron K1/K4/K8/K10/Q6, Bullet M2-HP, Redmi Note 11 Pro / 12 / 12 Pro (4G vs 5G), Pixel Watch (connectivity), and Fairphone 3/3+/4 (RAM/storage).
- **Multi-column spec tables:** ASUS ROG G14 GA403WR and Strix SCAR 17, RTX 3090, the Fairphone 3/3+ camera table, and the ROG G15 G513QY configuration.
- **Other:** the ROG XG32VQR screen-only photo, the Samsung T9 photo with a T5 alongside, and the Ubiquiti NanoBeam / NanoStation names.
- **Regional duplicates:** 4. One SKU of each pair stays publishable.

**Resolved from evidence so far:** 29 of the 62 original flags, including three this pass:

- iPad Pro 13" M4: confirmed from the About screen in its photo.
- Samsung T7 Shield: the photo shows the black finish.
- MacBook Air M1: the photo is a real photograph, not a render.
