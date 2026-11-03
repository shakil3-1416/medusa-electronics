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
