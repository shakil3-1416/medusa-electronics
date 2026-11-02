# Verified real-product catalog pipeline

Replaces the synthetic SGNova fixtures with real products, without touching
them until the real catalog passes validation.

```
records/*.json  --validate_records.py-->  verified/<handle>.json  --import-verified-catalog.ts-->  Medusa (draft products)
 (curated)        fetch official page,      + licensed photos in                 status=draft, unpriced
                  check every spec,          apps/storefront/public/              unless a sourced BDT
                  check Commons licence      catalog-real/<handle>/               price is present
```

## Run

```bash
python3 -I sgnova/catalog/real/validate_records.py            # all records, writes validation-report.json
python3 -I sgnova/catalog/real/validate_records.py <handle>   # one record (no report)
cd apps/backend && SGNOVA_IMAGE_BASE_URL=http://localhost:4111 \
  pnpm exec medusa exec ./src/scripts/import-verified-catalog.ts
```

## Record format (`records/<group>.json`, a JSON array)

| Field | Rule |
| --- | --- |
| `handle` | `real-<brand>-<model>[-<variant>]`, lowercase, unique |
| `brand` | must be a key of `BRAND_DOMAINS` in the validator |
| `model` | exact manufacturer model name |
| `mpn` | manufacturer part number, if the source shows one |
| `variant_title` | e.g. `128GB`, `Default` |
| `category_handle` | one of `sgnova/catalog/categories.json` |
| `title`, `subtitle`, `description`, `highlights` | our own wording; no copied marketing text |
| `spec_source.url` | official manufacturer page (static HTML) on the brand's domain |
| `model_match` | strings that must appear as an exact model reference on that page |
| `specs[]` | `{group, label, value, evidence, context?}`. `evidence` is copied verbatim from the page. Evidence shorter than 12 characters needs a `context` phrase that appears within 300 characters before it. Every number in `value` must appear in `evidence`/`context`. At least 5 specs. |
| `images[]` | `{commons_file: "File:...", model_evidence}`. Wikimedia Commons only; the licence must be CC0, PD, CC BY or CC BY-SA. The model must be referenced exactly in the file title, description or categories. |
| `price` | optional `{amount_bdt, source_url}`; otherwise imported unpriced |

## Why these sources

- **Specifications** come only from the manufacturer's own domain, and each value is checked mechanically against the fetched page. The page's SHA-256 and retrieval time are recorded. Pages are cached in `.cache/` (git-ignored) and never committed.
- **Photos.** Manufacturer press images are not used, because reseller usage rights need a partner agreement we do not have. Wikimedia Commons files carry machine-readable licences; the author, licence and source are stored and shown as a credit on the product page.
- **Distributor feeds** (Bangladesh distributors, for example the authorised importers of each brand) are the scalable path to 500+ products with prices and official photos. Add a feed adapter that emits records in this format, and add the distributor's domain under the brand once access is granted in writing.
