# Real Product Catalog: Pipeline and First Verified Batch

Date: 2026-11-02. Branch `sgnova/bangladesh-electronics-store`. Nothing pushed or deployed, nothing purchased. The 600 synthetic products are unchanged and still published.

## Result

| Metric | Value |
| --- | --- |
| Records attempted (full independent validation run) | 56 |
| Verified | **55** |
| Rejected by the gate | 1 (NVIDIA RTX 4090 FE: Commons photo tagged "License review needed") |
| Imported into Medusa | 55, all `status=draft` (invisible to the storefront and search) |
| Genuine product-photo coverage | **55 / 55 (100%)**, all real photographs from Wikimedia Commons |
| Products with official-source specs | 55 / 55; every displayed value checked verbatim against the manufacturer's page |
| Sourced BDT prices | **0 / 55**; imported unpriced (`price_status=pending_merchant_input`) |
| Flagged for manual review | 8 (`review_status=needs_manual_review`) |
| Categories covered | 19 of 30 |
| Brands | Apple, Google, Fairphone, Xiaomi, AMD, NVIDIA, Samsung, Corsair, ASUS, MikroTik, Netgear, TP-Link, Logitech, Keychron |

By category: smartphone 10, business-laptop 7, processor 5, internal-ssd 4, network-switch 4, router 3, headphone 3, tablet 3, smartwatch 3, desktop-pc 2, gaming-laptop 2, computer-accessory 2, and one each for gaming-monitor, office-monitor, graphics-card, desktop-ram, computer-case, mechanical-keyboard and webcam.

Photo licences: CC BY-SA 4.0 (30), CC0 (10), CC BY 4.0 (5), CC BY-SA 3.0 (4), CC BY 2.0 (4), CC BY 3.0 (2). Credits are shown on each product page and listed in `apps/storefront/public/catalog-real/CREDITS.md`.

Readiness gate (`catalog_readiness.py`): **not ready to replace the synthetic catalog**. It needs 500+ products (55 now), 20+ categories (19 now) and 100% sourced prices (0 now). The 100% licensed-photo check passes.

## Pipeline

1. **Records** (`sgnova/catalog/real/records/*.json`): curated product claims. Each has an official spec URL, verbatim evidence per spec, and a Commons photo.
2. **Gate** (`validate_records.py`). A record is rejected if any of these fail:
   - The spec source must be on the brand's official domain, including after redirects.
   - Exact model match on the page. Sibling suffixes (Pro, Plus, Max, Ti, X3D, ...) don't count.
   - Every spec's evidence must appear verbatim as whole tokens. Evidence under 12 characters also needs a nearby context phrase, so "12GB" can't match "512GB" or unrelated text.
   - Every number shown to shoppers must come from the evidence.
   - Multi-model pages must be scoped to the model's own section (used for the shared Google Pixel page).
   - The photo licence must be read from the Commons API and be on the allowlist (CC0/PD/CC BY/CC BY-SA). Files in licence-review or deletion categories are rejected.
   - The photo must reference the exact model, with at least 600 px on the long side.
   - The record keeps provenance: the page SHA-256, retrieval time, and the author/licence/source of every photo.
3. **Draft import** (`apps/backend/src/scripts/import-verified-catalog.ts`). It is idempotent and uses `createProductsWorkflow`/`updateProductsWorkflow`. It never publishes or deletes. It stores specs, highlights, provenance, image credits, review status and price status in metadata.
4. **Readiness gate** (`catalog_readiness.py`): reports whether the synthetic catalog may be retired. Report only; it never changes the database.
5. **Storefront**: verified products show photo credits under the gallery and a link to the official spec source under the specification table.

I tested the gate with negative cases: an invented spec, a photo of a sibling model, a third-party spec site, an altered value next to correct evidence, and a short ambiguous value. All were rejected. Research was split across four parallel agents, but the gate ran independently over every record afterwards, so no agent's claim was accepted without the mechanical check.

## Records needing manual review before publishing (8)

| Handle | Reason |
| --- | --- |
| real-asus-rog-zephyrus-g14-2025-ga403wr | Spec page is a multi-SKU comparison table; confirm the GA403WR column |
| real-asus-rog-strix-scar-17-2023-g733py | Same table issue (G733PY); the photo is a CC BY video still |
| real-asus-rog-strix-xg32vqr | Photo is a close-up of the lit screen, not the whole monitor |
| real-apple-macbook-air-15-m2-16gb-256gb | Photo matched by category "MacBook Air M2" plus "15 inch" in the title (inference) |
| real-nvidia-geforce-rtx-3090-founders-edition | NVIDIA page is a shared 3090/3090 Ti table; confirm the 3090 column |
| real-keychron-k8 | Official page mixes original and Version 2 details |
| real-netgear-gs108, real-netgear-gs108e | Photos may show older hardware revisions |

Other caveats: the Fairphone 5 specs come from Fairphone's official support FAQ, not a spec sheet; the MX Master 3S specs come from Logitech's product-page feature text; and some photos show the product installed or in use rather than on a plain background.

## Verification failures and blocked sources

| Source | Problem | Products lost |
| --- | --- | --- |
| intel.com / ark.intel.com | TLS chain fails verification from Python | all Intel CPUs |
| lenovo.com (403), psref.lenovo.com (client-rendered) | no readable spec text | ThinkPads |
| raspberrypi.com, kingston.com, crucial.com, frame.work, samsung.com (some locales) | HTTP 403 | Raspberry Pi, Kingston NV2, Crucial MX500, Framework, Samsung monitors |
| asus.com motherboard pages, nothing.tech, garmin.com | client-rendered | ROG Z690-A, Nothing Phone (2), Forerunner 965 |
| dell.com, store.google.com, samsung.com/us | redirect to generic pages | Alienware, Galaxy S24 |
| westerndigital.com | compressed response (gzip handling added afterwards, not retried) | WD Red |
| Wikimedia Commons | frequent HTTP 429 under parallel load (backoff and a 2 s delay added) | none permanently |
| Commons coverage | no exact-model photo, photo under 600 px, or licence not allowed (FAL/GFDL) | iMac, Sony WH-1000XM4/5, Samsung T7, OnePlus 12, Logitech C920, Ryzen 7 3700X, Samsung 860 EVO, APC Back-UPS |

No products were found for UPS, printer, scanner, microphone, hard-drive, power-supply, motherboard, cpu-cooler, laptop-ram, external-storage or Intel processors.

## Licensing gaps

- Wikimedia Commons photos are genuine and licensed, but they are community photographs, not manufacturer studio shots. Quality and backgrounds vary, and CC BY-SA requires attribution and share-alike on the photo itself.
- Official manufacturer and press images were not used. Reseller rights to them come from brand or distributor partner agreements, which we do not have.
- Commons covers popular consumer models well, but has few photos of UPS units, printers, PSUs, motherboards and current-generation SKUs. Commons alone cannot reach 500+ products across 30 categories.

## What it takes to reach 500+ (supplier access requirements)

1. **Authorised distributor or brand partner feeds** for the Bangladesh market (the brands' authorised importers). This needs a written reseller or partner agreement that grants:
   - a product data feed (CSV/XML/API) with MPN, EAN/UPC and specifications;
   - rights to use official product images on the store;
   - dealer BDT pricing and stock.
2. A **feed adapter** that emits records in the existing schema, with the distributor's domain added under each brand in `BRAND_DOMAINS`. The same gate then verifies specs and image licences.
3. **Price source**: the merchant's own BDT prices from the distributor price list (`price.amount_bdt` + `source_url`). Copying competitors' prices is not used.
4. **Optional, needs your approval:** a third-party product-data API (Icecat, for example; its full catalogue needs a paid licence) or a headless-browser fetcher for client-rendered manufacturer pages. Both are outside this pass, which was limited to no purchases.

## Data safety

- Backups taken before any import and validated: `medusa-20261102-082655-pre-real-import.dump` (plus the earlier ones).
- Imports only create or update `real-*` draft products. Rerunning updates them in place (55 updated, 0 created).
- Still working after the import: storefront API count 600, search excludes drafts, Bangladesh/BDT is the only region, and API checkout order #3 completed (৳3,180 BDT, manual test payment).
- Type checks and ESLint: 0 errors in both apps.

## Run it

```bash
python3 -I sgnova/catalog/real/validate_records.py
python3 -I sgnova/catalog/real/catalog_readiness.py
cd apps/backend && SGNOVA_IMAGE_BASE_URL=http://localhost:4111 pnpm exec medusa exec ./src/scripts/import-verified-catalog.ts
```
