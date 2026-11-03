# Catalog Readiness: Real Products, BDT Pricing and Controlled Publication

Date: 2026-11-03. Branch `sgnova/bangladesh-electronics-store` (local commits only, nothing pushed or deployed). Nothing was published, no price was set, and the 600 synthetic products remain the live catalog.

## Summary

| Measure | Value |
| --- | --- |
| Real-product drafts in Medusa | 637 |
| Passing the verification gate | **626** (199 manufacturer-page + Wikimedia Commons, 427 Open Icecat) |
| Not verified (stricter refurbished rule) | 11: Dell `-REF` / `-REFURB` SKUs and an "upcycle it … GRADE A" PC. Kept as drafts, marked `not_verified` |
| Blocked by manual review | 40 (36 Commons + 4 Icecat regional duplicates) |
| **Publishable as soon as an approved BDT price and availability exist** | **586** across 29 categories |
| Publishable right now | 0 (no approved BDT prices) |
| BDT price coverage | **0 / 626**; nothing fabricated |
| Key-feature coverage | **626 / 626** (Icecat 427/427 from Icecat's own bullet points; Commons 199/199) |
| Genuine product photos | 1,632 (312 Commons + 1,320 Icecat); 409 products have multiple angles |
| Photo attribution and licence notices | Present on every verified product (publication gate check) |

## Phase 1: catalog verification

- **Defect fixed:** 5 records stored `review_notes` as a string, so notes were iterated character by character and the preview's review box missed them. They are normalised to lists.
- **Manual review triage** (`sgnova/catalog/real/review_triage.py`, rules with reasons):
  - **26 of the 62 flagged products are resolved.** Their notes only document provenance or classification choices that were checked against the official source, for example:
    - AMD spec tables on AMD's own support page;
    - reference boards;
    - "router" category used for access points;
    - configuration chosen from options on the official page;
    - an official regional page;
    - official pages confirming "Yeti Nano" and the tenkeyless G PRO.

    These are kept as `review_info` and no longer block publication.
  - **36 remain blocked**: photo generation or revision uncertainty, multi-SKU or multi-column spec tables, inferred variants, unknown RAM/storage configuration, retail or about-screen photos, a Taiwan-SKU photo, and 4G/5G ambiguity.
  - The Ubiquiti marketing-name notes were checked against the cached official pages. The photo names ("NanoBeam AC Gen2", "NanoStation AC loco") do not appear there, so they stay blocked.
- **Key features:** the 427 Icecat products now carry up to 4 key features taken verbatim from Icecat's `BulletPoints` (manufacturer) or `GeneratedBulletPoints` (derived from specs). They were rebuilt offline from the cached registered responses (`icecat_regate.py`), with no new downloads. Nothing was written by us.
- **Category corrections:** Icecat files case fans with CPU coolers. CPU Coolers now hold only the 4 genuine processor coolers (be quiet! Pure Rock 2, Dark Rock 4, Dark Rock Pro 4, MSI MPG CoreLiquid P22); 17 case fans and fan kits moved to Computer Accessories.
- **Duplicates** (`icecat_duplicates.py`): records count as duplicates only when brand, model and every specification (colour included) are identical. 4 regional duplicates are flagged (3 Acer processor tray/box codes and 1 Dell WB526 webcam code); the preferred record stays publishable. Capacity and colour variants remain separate products.
- **Refurbished exclusion widened:** `-REF`, `-REFURB`, "upcycle" and "grade A–C" SKUs are now caught; 11 failed. The importer marks drafts that no longer pass the gate as `not_verified` instead of deleting them.
- **Preview:** checked in the browser.
  - The Dark Rock Pro 4 page shows 4 key features, the CPU Coolers breadcrumb, the gallery, the Icecat credit, "Price pending" and a disabled cart.
  - The CPU Coolers category lists exactly the 4 coolers.
  - The Keychron Q6 page shows its review box; the photo visibly has aftermarket keycaps, as noted.

## Phase 2: BDT pricing system

`apply-bdt-prices.ts` plus `sgnova/catalog/pricing/` (template and runbook):

- Matching is exact, by SKU, then MPN, then GTIN, with brand/model consistency checks.
- Validation covers: currency, amount, cost vs selling, quote age and expiry, availability, duplicate rows and approver.
- `retail_reference` rows are recorded only. Supplier names and costs go only to the git-ignored ledger. Applies are idempotent with rollback files.
- **Dry-run test**, using a labelled fixture file outside the repo with ৳1 values: 1 would-apply (and blocked as a fixture), 1 reference-only, 8 correct rejections (unknown SKU, wrong currency, stale quote, duplicate row, brand mismatch, invalid price, below cost, not approved).
- **Apply-mode test** with the same fixture: **0 prices written**, no rollback file.
- **Public retail reference dataset:** not built. No Bangladeshi retailer offers a permitted price feed, and copying shop prices would breach their terms and the "no estimated or marketplace prices" rule. The `retail_reference` source type exists so you can add prices you collected yourself for comparison; they are never applied.
- **XLSX:** export to UTF-8 CSV. No spreadsheet dependency was added; the common npm `xlsx` package has known vulnerabilities.

## Phase 3: controlled publication

`publish-real-catalog.ts`: gated, batched, ledgered and reversible. Synthetic retirement is a separate confirmed step that only drafts products, per category, once at least 10 real products are live in it.

- **Dry-run audit** of 637 real products: 0 eligible now. Every product lacks a BDT price, approval and availability; 40 are in manual review and 11 are not verified. No other gate failed (images, attribution, licence notice, specs, category, sales channel, SKU).
- 199 products carry a warning that their image URLs point at localhost (see deployment).
- Publishing without `PUBLISH_CONFIRM=publish-real-catalog` is refused (tested). Synthetic products retirable now: 0.

## Phase 4: storefront

- Real products use the existing product pages, which already render the gallery, key features, the grouped spec table with its source, photo credits and the Icecat licence notice. Cards show brand, photo and BDT price once a price exists.
- **Production safety:** a production build (`next build` + `next start`, 48 s) returns **404** for `/bd/preview/real` and its product pages, and 200 for `/bd`, `/bd/store` and the product pages.
- **Images for deployment:**
  - Icecat images come from `images.icecat.biz` (allowed in `next.config.js`).
  - The 199 Commons products' images are absolute `http://localhost:4111/...` URLs; re-run the import with `SGNOVA_IMAGE_BASE_URL=https://<storefront-domain>` before going live.

## Phase 5: tests run

| Check | Result |
| --- | --- |
| Backend / storefront type check | 0 / 0 errors |
| Backend / storefront lint | 0 / 0 errors |
| Pricing dry run and fixture apply | As above; 0 prices written |
| Publication dry run and confirmation guard | As above |
| Production-mode preview isolation | 404 |
| Catalog isolation | Store API 600 published; search 600 documents; real draft ("Dark Rock") 0 hits |
| Region | Bangladesh only, BDT |
| Gallery sample in the browser | Dark Rock Pro 4, Q6; earlier full audit: 2,280 / 2,280 URLs OK |
| Checkout | Not re-run: checkout code is untouched (last order #8) |

Backup before the data changes: `medusa-20261103-020735-pre-catalog-prep.dump`, validated; all earlier dumps are kept.

## Remaining blockers and the approvals needed

1. **BDT prices** (the main blocker). Provide supplier or distributor quotations in the template and approve them. Then run the pricing dry run, then apply.
2. **Manual review:** 40 products need a person to confirm (photo revision or generation, configuration, table column, duplicates).
3. **Your approval** to run the publication batches, and later to retire synthetic categories (`PUBLISH_CONFIRM` steps).
4. **Before deployment:** re-point the Commons image URLs, provision hosting, PostgreSQL and Redis (Redis modules still need configuring in `medusa-config.ts`), add a real payment provider and a notification provider.
5. Gaming laptops currently have 0 unblocked real products (all 3 are under review).
