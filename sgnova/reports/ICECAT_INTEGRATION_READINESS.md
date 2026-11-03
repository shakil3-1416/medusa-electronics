# Open Icecat Integration: Readiness Report

Date: 2026-11-02. Branch `sgnova/bangladesh-electronics-store`. Nothing pushed or deployed, no paid services. The 600 synthetic products remain published and the 199 verified drafts are preserved.

## Bottom line

The adapter is built and tested end to end against Icecat's live API, and it stops at one dependency: **a registered Open Icecat account whose holder has accepted the Open Content License (OCL)**. Without it, no Icecat content or image usage rights exist for this store, so the **authorised import batch today is 0**.

The demo run shows what the account would unlock immediately, from the current seed list alone:

| Stage (demo integration run, 69 Icecat products) | Count |
| --- | --- |
| Found on Open Icecat | 69 |
| Exact manufacturer + part-code match | 69 |
| Correct storefront category | 69 |
| ≥ 5 structured specifications | 69 |
| Public, accessible product image ≥ 600 px | 67 |
| Usage rights established | **0 (needs account)** |
| **Ready to import once licensed** | **67** |

Of those 67, the storefront category is cpu-cooler 3, desktop-ram 25, laptop-ram 8, hard-drive 13, motherboard 2, power-supply 2, scanner 7, ups 4, external-storage 2 and office-monitor 1. That covers **all six categories that are empty today**: motherboard, laptop-ram, hard-drive, power-supply, cpu-cooler and scanner. Brands: Kingston 33, Seagate 13, be quiet! 5, APC 4, Epson 3, HP 3, Samsung 2, ASUS 1, Gigabyte 1, Canon 1, Dell 1. Two were rejected: Seagate ST1000DM003 (no public image ≥ 600 px) and ST1000DM003-RFB (refurbished SKU excluded). None overlap the 199 existing drafts.

## Research findings: Open Icecat access and conditions

Sources: Icecat's JSON manual and fair-use policy on Icecat's own blog ([manual](https://iceclog.com/manual-for-icecat-json-product-requests/), [fair use](https://iceclog.com/open-icecat-fair-use-policy/)), [icecat.com free product content](https://icecat.com/structured-data-content-users), and live API responses.

- **Access**
  - Live JSON API: `https://live.icecat.biz/api`, GET only, with `lang` and a shop name (account user name).
  - Lookups work by `Brand` + `ProductCode` (manufacturer part number), by `GTIN`, or by `icecat_id`.
  - Authentication:
    - **Open Icecat:** the user name alone.
    - **Full Icecat:** an `app_key` from an IP-whitelisted account (error 5 or 7 otherwise), or `api-token` / `content-token` headers.
- **Demo account:** the manual documents a public demo shop name, `openicecat-live`, for Open Icecat products, and responses carry `DemoAccount: true`. I used it only for integration testing (about 150 throttled requests), not as a licence.
- **Free vs paid**
  - **Open Icecat** is free: datasheets sponsored by manufacturers, including images.
  - **Full Icecat** is a paid subscription with an `app_key`. These brands returned "Full Icecat content, an app_key is required": Western Digital, Toshiba, Crucial, Corsair, Noctua.
  - **Brand-restricted:** Logitech and Apple returned "Product has brand restrictions".
  - **Not in the Icecat database:** MSI 7C56-001R and Brother ADS1700WUK1.
- **Data format.** One JSON product holds:
  - `GeneralInfo` (Brand, BrandPartCode = MPN, GTIN[], Category, Title, Description with LongDesc, SummaryDescription, BulletPoints);
  - `FeaturesGroups` (typed features with PresentationValue);
  - `Gallery` (Pic up to 1280 px, Pic500x500, per-image `IsPrivate`, `IsMain`);
  - Multimedia, ProductRelated (relation types such as alternative, compatible and service), Reviews.
  - Some responses contain raw control characters, so the adapter parses leniently.
- **Usage conditions (fair-use policy)**
  - Be fully compliant with the **Open Content License Agreement** (accepted at registration).
  - **Show the Open Icecat "AS IS" disclaimer.**
  - Tell business partners you use Open Icecat.
  - Follow Icecat's robots.txt. icecat.biz disallows crawling `*/live.icecat.biz/api*`; the API is for authenticated programmatic use, which this adapter is.
  - Download cap of 1 million per month per repository, with a charge beyond that.
  - **No use for ML training.**
  - Private images (`IsPrivate`) and some rich media are restricted to authorised resellers.
- **Image use.** Open Icecat lists product images as part of the free content for registered users under the OCL. I did not read the OCL text itself, because it is presented at sign-up. The account holder should confirm commercial e-commerce display rights when accepting it; the adapter only marks rights as established after that explicit attestation (`ICECAT_OCL_ACCEPTED=1`).

## What was implemented

- `sgnova/catalog/real/icecat_adapter.py` (stdlib only)
  - **Modes:**
    - **Registered:** `ICECAT_USERNAME`, plus optional `ICECAT_APP_KEY` / `ICECAT_API_TOKEN` / `ICECAT_CONTENT_TOKEN`, plus `ICECAT_OCL_ACCEPTED=1`.
    - **Demo** (`--demo`): stages content but never licenses or imports it.
    - Without credentials it exits with instructions (verified).
  - **Gate:**
    - exact brand and `BrandPartCode` match (GTIN too when given);
    - Icecat category must map to the storefront category;
    - laptop vs desktop RAM is derived from SO-DIMM/DIMM in Icecat's own title, never inherited;
    - refurbished SKUs excluded;
    - at least 5 specs;
    - only non-private `images.icecat.biz` product images of 600 px or more, each checked live, up to 4;
    - rights only in registered mode with OCL attestation.
  - **Expansion:** only Icecat's own same-category "alternative" links from open brands. Each one is looked up and gated independently, with a per-category cap.
  - **Throughput:** 1.2 s between requests, cached responses, and a request budget (`--max-requests`).
  - **Output:** `verified-icecat/<handle>.json` in the importer's schema; `icecat/staging-report.json` with per-stage results.
- `sgnova/catalog/real/icecat/targets.json`: 29 seed part numbers, used only as lookup keys, plus open brands and expansion categories.
- **Importer** (`import-verified-catalog.ts`)
  - reads `verified/` and `verified-icecat/`;
  - keeps Icecat CDN URLs absolute;
  - stores the GTIN, content source and the AS IS disclaimer;
  - still creates **drafts only, unpriced**, and is idempotent.
- **Storefront**
  - product pages show the content disclaimer under the spec table;
  - photo credits say "via Open Icecat" for Icecat images;
  - `images.icecat.biz` was added to the Next.js image hosts.
- **Git hygiene:** Icecat cache, staging and verified files are git-ignored, because the content is licensed to the account holder.
- **Verified with a dry run:** a registered-mode record built from cached data has every field the importer needs. Nothing was written or imported.

## How to unlock it (the only remaining dependency)

1. Register a free Open Icecat account at icecat.biz and accept the Open Content License (needs the business owner; I cannot create accounts). Optionally whitelist the server IP for app-key use.
2. Set the variables in the shell that runs the pipeline. Never commit them.
   ```bash
   export ICECAT_USERNAME=<your-icecat-username>
   export ICECAT_OCL_ACCEPTED=1   # only after accepting the OCL
   ```
3. Run the adapter, then the importer:
   ```bash
   python3 -I sgnova/catalog/real/icecat_adapter.py --expand --max-requests 500
   cd apps/backend && SGNOVA_IMAGE_BASE_URL=http://localhost:4111 pnpm exec medusa exec ./src/scripts/import-verified-catalog.ts
   ```
   The 67 staged products, and more as the seed list grows, import as drafts.
4. For Full-Icecat brands (Western Digital, Crucial, Corsair, Noctua, Toshiba), a paid subscription with `ICECAT_APP_KEY` is required. That needs your approval.

## Path to 600 with Icecat

- Today: 199 Commons-verified drafts.
- About 67 more are Icecat-ready on account activation, bringing it to about 266.
- Growing the seed list (part numbers from distributor price lists, or Icecat's index files once registered) for the open brands is the main lever. Kingston, Seagate, ASUS, Gigabyte, Epson, HP, Canon, APC, Samsung, Dell, Lenovo, be quiet! and others all answered openly.
- Prices remain the blocker for publishing. **No product will publish until a sourced BDT price exists** and review notes are cleared.

## Regression results

| Check | Result |
| --- | --- |
| Backup before changes | `medusa-20261102-194343-pre-icecat.dump` validated (all earlier dumps kept) |
| Importer rerun (both directories) | 0 created, 199 updated; 199 drafts, all with photos |
| Published / storefront API | 600 / 600 |
| Region | Bangladesh, `bdt` |
| API checkout (Outside Dhaka, manual test payment) | Order #5, BDT, ৳41,650 |
| `/bd`, `/bd/store` | 200 |
| Type checks (both apps) / ESLint errors | 0 / 0 |

## Update: registered-run preparation (2026-11-02)

- **Credential status:** no `ICECAT_USERNAME` was found in the environment or in any local git-ignored configuration in the workspace. Registered access therefore could not be confirmed. **Nothing new was imported**: still 199 drafts and 600 published products, with no database changes in this pass.
- **Index feeds need more than the user name.** `data.icecat.biz/export/freexml/...` (files.index, daily.index, CategoriesList, SuppliersList) answered `401 Basic realm="Icecat XML Server"`, so feed discovery needs **`ICECAT_PASSWORD`** as well. The live API needs only the user name.
- **Added:**
  - `icecat/icecat.env.example`: copy it to the git-ignored `icecat/icecat.env`. The adapter loads it automatically and never prints the values.
  - `icecat_index.py`: streams CategoriesList, SuppliersList and the daily index (or the full CSV index with `--full`). It keeps on-market, Icecat/supplier-quality rows with a part number and an image of 600 px or more, from unrestricted brands. It prioritises the six missing categories, then round-robins with per-category caps, and writes the git-ignored `icecat/targets.index.json`. Its filters, priority and RAM form-factor handling passed a fixture test.
  - `run_icecat.sh`: one checkpointed run of: access check (fails if the response is still the demo account) → index discovery → gated lookups → validated DB backup → draft import → coverage.
  - The adapter now writes a checkpoint report every 25 lookups. The request budget limits only new network calls, so reruns resume from the cache.
- **To run once credentials are in place:**
  ```bash
  cp sgnova/catalog/real/icecat/icecat.env.example sgnova/catalog/real/icecat/icecat.env   # then fill in
  sgnova/catalog/real/run_icecat.sh --full --cap 40 --total 450
  ```
  This imports the 67 staged products plus index-discovered ones as unpriced drafts, within the fair-use request budget (`ICECAT_MAX_REQUESTS`, default 700).

## Activation and first registered import (2026-11-02)

### Account tier and verified permissions
- **Tier:** Open Icecat. My Icecat → Subscription level reads "Open Icecat Data (xml, json, csv/excel)". It is not Full Icecat, and there are no access tokens or allowed IPs configured.
- **Configuration:** the user name was taken from the account's own profile page and written to the git-ignored `sgnova/catalog/real/icecat/icecat.env` (mode 600) with `ICECAT_OCL_ACCEPTED=1`. The account holder confirmed acceptance of the Open Content License v1.4. The password is masked in the profile and was **not** extracted from the browser; it is left blank for the account holder to enter.
- **Registered access confirmed** with an authenticated Live API request: `msg: OK`, `DemoAccount: false`, with full galleries for Kingston and Seagate. Apple is still brand-restricted on Open Icecat.
- **Licence (OCL v1.4, [text](https://iceclog.com/open-content-license/)):** copying and distribution are permitted in any medium, which includes webshop display of data sheets and images, provided that:
  - each copy carries "Database Right data-sheet [Year] Icecat. All rights reserved." with the warranty disclaimer and a reference to the licence;
  - modifications are marked with what changed and when;
  - no fee is charged for the content itself;
  - the fair-use policy is followed;
  - the content is **not used for ML training or synthetic content generation** (doing so voids the licence).
- **Compliance fix:** the stored notice now contains the database-right line, the AS IS disclaimer, the licence link and a dated modification notice (description shortened, specs limited to 12 per group). It is shown under each product's spec table.

### Results
| Metric | Count |
| --- | --- |
| Icecat products discovered (seeds + same-category alternatives) | 69 |
| Passed the gate in registered mode (rights established) | **67** |
| Rejected | 2 (Seagate ST1000DM003: no image ≥ 600 px; ST1000DM003-RFB: refurbished + no image) |
| Imported as new drafts | **67** (0 duplicates of the 199 Commons drafts) |
| Icecat product photos (live `images.icecat.biz` URLs, all `200 image/*`) | 220 gallery images on 67 products |
| Total real drafts | **266** (199 Commons + 67 Icecat) |
| Total genuine product photographs | **532** |
| Categories with real products | **30 / 30** |
| Needing manual review | 62 (all from the Commons pipeline; Icecat products have exact part-code matches) |
| Published, publication-ready or priced | 0 (no sourced BDT prices) |

Previously empty categories, now filled from Icecat: motherboard 2, laptop-ram 8, hard-drive 13, power-supply 2, cpu-cooler 3, scanner 7. Icecat also added desktop-ram 25, ups 4, external-storage 2 and office-monitor 1.

Full combined coverage: smartphone 66, router 31, desktop-ram 26, processor 14, hard-drive 13, computer-accessory 11, smartwatch 9, tablet 8, network-switch 8, business-laptop 8, laptop-ram 8, mechanical-keyboard 7, scanner 7, ups 6, graphics-card 4, gaming-mouse 4, internal-ssd 4, office-monitor 4, printer 4, external-storage 4, desktop-pc 3, cpu-cooler 3, gaming-laptop 3, headphone 3, power-supply 2, motherboard 2, microphone 1, computer-case 1, gaming-monitor 1, webcam 1.

### Validation
- Backup before import: `medusa-20261102-211035-pre-icecat-import.dump`, validated. All earlier dumps are kept.
- 600 synthetic products are still published, drafts are invisible to the store API, and the 199 earlier drafts were updated in place.
- 0 duplicate handles and 0 duplicate SKUs.
- Bangladesh is the only region, in `bdt`. API checkout completed (order #6, ৳14,280). `/bd` and `/bd/store` return 200. 0 backend type errors.
- Not visually checked: Admin and storefront rendering of draft galleries, because drafts are not served to the storefront and Admin needs a sign-in. All image URLs were verified live.

### Remaining gap to 600 and blockers
- **334 products short of 600.** The live API's same-category alternative links are exhausted at 69 lookups from the current seeds.
- **Blocker:** the Open Icecat index and daily feeds (`data.icecat.biz/export/freexml`) need the account **password** (HTTP Basic auth). With it, `run_icecat.sh --full --cap 40 --total 450` discovers on-market, image-ready products across the open brands, prioritising thin categories, within the fair-use request budget.
- **Brand limits:** Apple and Logitech are restricted. Western Digital, Crucial, Corsair, Noctua and Toshiba need paid Full Icecat (not used without approval).
- **Prices:** every draft stays unpublished until a sourced BDT price exists.

### Next action required
Enter the Icecat password in `sgnova/catalog/real/icecat/icecat.env` (`ICECAT_PASSWORD=`) yourself, then ask me to run:
```bash
sgnova/catalog/real/run_icecat.sh --full --cap 40 --total 450
```

## Full-index import (2026-11-02, registered Open Icecat)

### Access
- Credentials come from the git-ignored `icecat/icecat.env` (mode 600) and were never printed.
- Index feeds authenticated with HTTP 200: CategoriesList (30 MB), SuppliersList, daily index (1 MB), full CSV index (272 MB).
- Live API responses report `DemoAccount: false`.

### Pipeline fixes made during the run (genuine defects only)
1. **Resumable index download.** The 272 MB download dropped at 216 MB (`IncompleteRead`). It now resumes the `.part` file with an HTTP Range request.
2. **Active models first.** The index lists products oldest first, so the first target was a 2005 board. Selection now keeps the newest N per category in a bounded heap, and the gate rejects products whose Icecat EndOfLifeDate has passed.
3. **End-of-life date parsing.** Icecat writes dates as DD-MM-YYYY, so future dates had been read as past. Dates are now parsed properly.
4. **Mouse and keyboard categories.** Icecat's generic "Mice" and "Keyboards" now go to gaming-mouse or mechanical-keyboard only when Icecat's title says gaming or mechanical. Everything else goes to computer-accessory.
5. **Stale verified files** are removed when a product no longer passes the gate.

Peak memory was 36-45 MB for discovery. Lookups ran as one sequential process at 1.2 s per request, in two checkpointed batches of 225 new requests (450 in total, well within fair use).

### Results
| Stage | Count |
| --- | --- |
| Index targets (newest, on market, image ≥ 600 px, good quality, unrestricted brands) | 450 across 25 categories |
| Looked up via Live API (plus 42 seeds and alternatives) | 492; 490 found |
| Exact brand + part-code match | 479 |
| Public image ≥ 600 px | 428 |
| **Passed every gate** (exact model, category, ≥ 5 specs, images, rights, active, not refurbished) | **413** this run + 25 re-gated earlier = **438 Icecat products** |
| Rejected | 77: no usable image (62), brand mismatch (11), refurbished (3), fewer than 5 specs (3), end of life (2); 2 not found |
| Imported as new drafts | **371** (67 earlier Icecat drafts plus 199 Commons drafts updated in place) |

### Catalog totals after import
- **Real-product drafts: 637** (199 Commons + 438 Open Icecat), **reaching the 600 target.**
- **Genuine product photographs: 1,643** (312 Commons + 1,331 Icecat gallery images).
  - 637 of 637 products have photos.
  - All 438 Icecat card thumbnails and a random sample of 150 gallery images return `200 image/*`.
- **Categories: 30 / 30.** Real products per category:

| Category | Real products | Category | Real products | Category | Real products |
| --- | --- | --- | --- | --- | --- |
| smartphone | 66 | ups | 24 | computer-case | 19 |
| router | 48 | office-monitor | 22 | webcam | 18 |
| desktop-ram | 37 | graphics-card | 22 | headphone | 17 |
| processor | 32 | computer-accessory | 22 | desktop-pc | 16 |
| laptop-ram | 31 | cpu-cooler | 21 | scanner | 15 |
| hard-drive | 28 | business-laptop | 21 | printer | 11 |
| network-switch | 26 | internal-ssd | 21 | smartwatch | 9 |
| motherboard | 20 | external-storage | 21 | tablet | 8 |
| power-supply | 20 | microphone | 19 | gaming-monitor | 7 |
| mechanical-keyboard | 7 | gaming-mouse | 6 | gaming-laptop | 3 |

- **Icecat brands:** 66, led by Kingston 33, Integral 29, ASUS 29, Dell 28, be quiet! 24, Gigabyte 22, Acer 19, Lenovo 19, APC 18, Samsung 14, Seagate 14 and Epson 12.
- **Duplicates:** 0 duplicate handles and 0 duplicate SKUs. No product overlaps between the Commons and Icecat pipelines (brand + category + model/part-code check).
- **Manual review:** 62 drafts, all from the Commons pipeline. Icecat products are exact part-code matches.

### Validation
- **Backup** before the bulk import: `medusa-20261102-233403-pre-icecat-bulk.dump`, validated. All earlier dumps are kept.
- **Store:** published products 600, storefront API 600, search documents 600; no real product is published.
- **Region and checkout:** Bangladesh is the only region (`bdt`), and API checkout completed (order #7, ৳47,280). `/bd`, `/bd/store` and a product page return 200.

### Remaining gaps and next actions
- **Prices:** 0 of 637 real products have a sourced BDT price, so none can be published. Supply dealer or distributor BDT prices, for example a price list that sets `price.amount_bdt` and its source.
- **Manual review:** clear the 62 flagged Commons drafts.
- **Thin categories:** gaming-laptop 3, gaming-mouse 6, gaming-monitor 7, mechanical-keyboard 7, tablet 8 and smartwatch 9. Apple and Logitech are brand-restricted on Open Icecat, and Icecat's generic Mice/Keyboards rarely say gaming or mechanical. More index batches with a higher per-category cap would help (`run_icecat.sh --full --cap 80 --total 300`).
- **Retiring the synthetic catalog:** only after prices are in and `catalog_readiness.py` passes. Not done.
- **Restricted brands:** Western Digital, Crucial, Corsair, Noctua and Toshiba need paid Full Icecat (not used without approval).
- **Visual check:** draft galleries in Medusa Admin need your sign-in. The storefront shows drafts only after publishing.
