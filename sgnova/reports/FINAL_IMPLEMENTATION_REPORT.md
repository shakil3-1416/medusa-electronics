# Medusa Bangladesh Electronics Store: Final Implementation Report

Date: 2026-11-02
Stack: Medusa 2.22.2 backend (`apps/backend`, :4110) + Next.js 16 storefront (`apps/storefront`, :4111/bd), PostgreSQL in `lab-medusa-db-1` (:5410).
Nothing was committed, pushed or deployed.

## 1. Summary

| Area | Status |
| --- | --- |
| Bangladesh-only shopper experience (BDT everywhere) | Done |
| BDT search price indexing, price filter and price sort | Done (index v2 active) |
| Catalog: 600 products / 30 categories, specs + images | Done (600/600) |
| Starter apparel products removed | Done (soft delete via `deleteProductsWorkflow`) |
| Professional storefront (header, departments, home, cards, PDP spec tables, footer) | Done |
| Cart, BD shipping, manual test payment, order confirmation | Verified in browser |
| Customer auth (register, login, `/me`) | Verified through the auth API |
| Production build | Passes (`next build`, 2m17s) |
| Europe region deletion | Done after your approval (soft delete, backup taken first) |

## 2. Phase A: stabilisation and backups

- Docker Desktop was stopped; started it and `lab-medusa-db-1`. Backend and storefront started with the lab `start_proc` helper.
- Existing backup `sgnova/backups/database/medusa-20261031-114007.dump` checked: `pg_restore --list` reads 1041 TOC entries, and a full test restore into a scratch database (`restore_check`, dropped afterwards) contained 604 products.
- New checkpoints (all validated with `pg_restore --list`):
  - `medusa-20261102-070104-pre-phaseB.dump` (before any change)
  - `medusa-20261102-074627-post-phaseF.dump` (after the catalog and storefront work)
  - `medusa-20261102-075528-pre-europe-delete.dump` (latest, taken just before the Europe region was removed)
- Seven backup files that were inside `apps/storefront/src` (`*.bak`, `*.backup-*`, `*.pre-routing-*`, `*.recovery-*`) were moved to `sgnova/backups/source-recovery/storefront-20261102/`. No backup files remain in any `src` tree.
- `.gitignore` now excludes `sgnova/backups/` and `**/*.local.json`.
- The backend's search index rebuild works with the source tree clean, so the earlier `.ts.backup-*` crash does not come back.

## 3. Phase B: Bangladesh-only commerce

New idempotent script `apps/backend/src/scripts/setup-bangladesh.ts` (`medusa exec`, safe to rerun; a rerun created nothing new). It uses core-flows workflows:

- Store renamed to **Medusa**, with **BDT as the default currency** (EUR/USD are kept as non-default) and **Bangladesh as the default region**.
- Bangladesh region metadata (store policies): 7-day returns, shipping rate ৳80, 1-3 days transit.
- Bangladesh tax region (`tp_system`, no default rate, so listed prices are final).
- **Dhaka Warehouse** stock location, linked to the manual fulfillment provider and to the sales channel.
- Bangladesh service zone with three BDT shipping options: Inside Dhaka ৳80, Outside Dhaka ৳150, Express Dhaka ৳250.
- Four starter products (`t-shirt`, `sweatshirt`, `sweatpants`, `shorts`) soft-deleted with `deleteProductsWorkflow`. The rows remain in the database with `deleted_at` set.
- The four empty starter categories (`shirts`, `sweatshirts`, `pants`, `merch`) were set to `is_active=false`. This is reversible.
- Europe region: after your approval, a backup was taken (`medusa-20261102-075528-pre-europe-delete.dump`, validated) and the region was soft-deleted with `SGNOVA_REMOVE_EUROPE=1` (`deleteRegionsWorkflow`). It had no carts or orders. `/store/regions` now returns only Bangladesh (BDT, `bd`). The European Warehouse and its two EU shipping options remain, unused (their service zone only covers EU countries).

Search (BDT):
- `apps/backend/src/search/helpers/pricing.ts` now has `PRICE_CURRENCIES = ["bdt", "eur", "usd"]`, and the storefront `SEARCH_PRICE_CURRENCIES` matches.
- `medusa db:migrate:search` rebuilt `product_v1` into `product_v2`. The new index was seeded on boot and is active.
- Checked through the API: 600 documents, `min_price_bdt` stats from ৳800 to ৳2,48,500, BDT price filter and sort working, brand (`labels`) facets present, and no starter products in the index.

Storefront region handling:
- `NEXT_PUBLIC_DEFAULT_REGION=bd`, and code defaults changed from `dk` to `bd`.
- New `NEXT_PUBLIC_STORE_COUNTRIES` (default `bd`). Middleware and `listRegions`/`getRegion` only expose the countries it lists, so the country selector, sitemap and hreflang are Bangladesh-only. Any other country prefix redirects (`/dk/store` → `/bd/store`, 307).
- `convertToLocale` shows BDT as `৳1,25,000`: narrow symbol, Indian/Bangladeshi digit grouping, whole taka. The price-range slider uses the same formatter.

## 4. Phase C: catalog

| Metric | Before | After |
| --- | --- | --- |
| Active products | 604 (600 SGNova + 4 starter apparel) | 600 |
| Categories with products | 30 electronics + 4 apparel | 30 electronics (apparel categories deactivated) |
| Products with thumbnail | 4 / 604 | **600 / 600** |
| Products with structured specs | 0 (generic `product_class/series` only) | **600 / 600** |
| Spec rows per product | 2-3 generic | 10-18 (average 13.9), in 4-7 groups |
| Unique product titles | generic ("NovaCore Standard Processors 02") | 600 unique model-style titles |
| Variants with a BDT price | 600 / 600 | 600 / 600 (৳800 - ৳2,48,500) |
| Search index documents | 604 (EUR/USD price fields only) | 600 (BDT price fields) |

How it was done:
- `sgnova/catalog/tools/enrich_catalog.py` is a deterministic generator. It reads the original `products.json` (unchanged) and writes `products.enriched.json`. Specs are category-specific (for example cores/threads/socket/TDP for CPUs, VRAM/bus/PSU for GPUs, panel/refresh/HDR for monitors, VA/topology/runtime for UPS) and scale with each product's existing BDT price rank, so cheaper items get lower specs. Prices were not changed.
- `apps/backend/src/scripts/enrich-sgnova.ts` applies the file through `updateProductsWorkflow` in batches of 25. It is idempotent (a rerun reported "0 to update, 600 already current") and has a verification pass. It also creates one product tag per brand, which powers the Brand filter.
- Honesty labelling: the brands are fictional ("SGNova Labs (fictional test brand)"). Every description, the PDP spec table footer and `metadata.data_source=synthetic-test-fixture` state that specs and pricing are illustrative test data, not manufacturer claims. No manufacturer data was used.
- Images: 120 **original** SVG illustrations (30 categories x 4 colourways) created for this project and stored in `apps/storefront/public/catalog/<category>/<n>.svg` (480 KB). All pass `xmllint`. The PDP shows "Representative illustration. Actual product appearance may differ." (`metadata.image_type=representative-illustration`). The Next.js image config is `unoptimized: true`, so SVGs from `/public` render without remote-host configuration.

## 5. Phase D: storefront

New or rewritten UI (existing Medusa data/cart/checkout logic reused, no commerce code rebuilt):
- Header: dark info bar (Taka, delivery, test-store notice), logo, full-width search bar (opens the existing InstantSearch drawer, which now shows BDT prices), account and cart. Below it, a department bar with nine departments and CSS hover/focus dropdowns covering all 30 categories (`src/lib/catalog/departments.ts`, `modules/layout/components/department-bar`). The mobile side menu lists the departments.
- Home: hero, two promo tiles, service strip, 30-category grid with illustrations, and six category product rails (Gaming Laptops, Smartphones, Graphics Cards, Gaming Monitors, Internal SSDs, Headphones). The emoji category icons and the collection rails, which had no collections, were removed.
- Product card (`modules/products/components/product-card`) shared by rails, category grids and search results: square image, brand, two-line title, key-spec subtitle and bold ৳ price.
- PDP: breadcrumb to the category, image with illustration caption, brand/model/SKU chips, key features, price and add to cart, a grouped **Specification table**, description, and Bangladesh-specific Delivery & Returns and Warranty tabs.
- Store and search page: the "Labels" facet was renamed "Brand", the grid restyled, and the price slider shows ৳.
- Footer rebuilt (departments, customer service, account). Dead Medusa GitHub/docs links and starter categories removed.
- Fixed: "Medusa Store" strings (checkout header, review text, register, metadata), a double " | Medusa | Medusa" category title, and a broken `/customer-service` link (now `/contact`).
- Mobile (375px): no horizontal overflow; header collapses to menu, search icon and cart.

## 6. Phase E: functional test results

Browser (in-app, localhost only, fictional test data):

| Flow | Result |
| --- | --- |
| Home renders, category tiles and rails link to `/bd/categories/*` | Pass |
| Category page (`/bd/categories/smartphone`) lists products with ৳ prices | Pass |
| Search "ssd" in `/bd/store` | Pass |
| Sort Price: Low → High (`min_price_bdt:asc`) | Pass |
| Brand filter (NovaCore) | Pass (results limited to NovaCore, ascending ৳) |
| PDP spec table, highlights, illustration caption | Pass |
| Add to cart → Cart (1) | Pass |
| Update quantity 1 → 2 (৳87,600 → ৳1,75,200) | Pass |
| Remove line item → empty cart state | Pass |
| Checkout address (Bangladesh preselected) | Pass |
| Shipping options shown in BDT (৳80 / ৳150 / ৳250), totals update | Pass |
| Payment: Manual Payment (`pp_system_default`, no real charge) | Pass |
| Place order → confirmation page, Order #1, ৳1,75,280, currency `bdt` | Pass |
| `/dk`, `/dk/store` redirect to `/bd...` | Pass |

API:
- Customer auth: `register`, create customer, `login`, and `GET /store/customers/me` passed. A wrong password returned 401. The test account was generated locally and its credentials are stored only in the git-ignored `sgnova/test-customer.local.json`.
- Notifications: no notification provider is configured, so no email was sent. The confirmation page text "We have sent the order confirmation" is starter copy only.

Production smoke (`next start`): `/`, `/bd`, `/bd/store`, `/bd/search`, a category page, a PDP, `/bd/cart`, `/bd/account`, `/bd/shipping`, `/sitemap.xml` (641 URLs, none for other countries), `/robots.txt` and the catalog SVGs all returned 200. The removed `/bd/products/t-shirt` returns 404, as expected. `/bd/checkout` with no cart returns 404, which is existing starter behaviour.

Build and static checks:
- Storefront `tsc --noEmit`: 0 errors. `next build`: success.
- Backend `medusa lint`: 0 errors, 12 warnings (generic `Error` in the earlier `seed-sgnova.ts` script, plus one in my script, which I fixed). My new scripts type-check cleanly. The earlier untracked scripts `seed-sgnova.ts` and `audit-electronics.ts` still have strict-null type errors, which do not affect `medusa exec`.
- Storefront `eslint`: 10 errors and 28 warnings, all in untouched upstream starter files (`src/lib/data/cart.ts` unused args and `any`, `@ts-ignore` usage, `set-state-in-effect` warnings). Left alone to avoid unrelated refactoring.

## 7. Remaining defects and limitations

1. **Single variant per product.** Each product has one "Standard" variant, so variant selection is not exercised by the catalog. Adding storage/RAM variants for phones, SSDs and RAM is a future data task.
2. The unused European Warehouse stock location and its two EUR/USD shipping options remain. They are harmless for Bangladesh carts; remove them in the admin if they are no longer wanted.
3. Admin thumbnails: resolved in the production-readiness pass. Images are now absolute URLs on the storefront origin (`SGNOVA_IMAGE_BASE_URL`); see `PRODUCTION_READINESS.md`.
4. The storefront sign-in **form** was not submitted in the browser, to avoid typing credentials there. The same auth endpoints passed through the API. Registration and sign-in pages render.
5. Storefront lint errors: fixed in the production-readiness pass (0 errors).
6. The local event bus and in-memory locking are dev-only. Production needs Redis.
7. Only the first page of category listings was checked visually. Pagination uses the existing starter code.
8. The order confirmation copy says an email was sent. No email provider exists.

## 8. Git changes (uncommitted)

Modified: `.gitignore`; backend `src/search/helpers/pricing.ts`; storefront `.env.template`, `check-env-variables.js`, `next.config.js`, `next-env.d.ts` (auto-generated by Next), `tsconfig.tsbuildinfo` (build artifact), plus about 30 files under `src/` (regions, middleware, money, search client, layout, home, products, store, checkout copy).
New: `apps/backend/src/scripts/setup-bangladesh.ts`, `apps/backend/src/scripts/enrich-sgnova.ts`, `apps/storefront/src/lib/catalog/departments.ts`, `modules/layout/components/department-bar/`, `modules/home/components/category-rails/`, `modules/products/components/product-card/`, `modules/products/components/product-specs/`, `apps/storefront/public/catalog/` (120 SVGs), `sgnova/catalog/tools/enrich_catalog.py`, `sgnova/catalog/products.enriched.json`.
The earlier untracked files (`seed-sgnova.ts`, `audit-electronics.ts`, storefront `AGENTS.md`/`CLAUDE.md`) were kept as they were.
Outside this repository: the lab `scripts/apps.sh` medusa health checks now use `/bd` and an SGNova product instead of the deleted t-shirt (original copied to `sgnova/backups/source-recovery/apps.sh.20261102`).
Secrets: `.env` and `.env.local` are git-ignored and were not printed. The publishable key appears in the dev server request log, which is local and not tracked.

## 9. Deployment readiness

### Storefront on Vercel
- Root directory: `apps/storefront`. Install with pnpm (workspace lockfile at the repo root). Build: `next build`.
- `check-env-variables.js` now fails a hosted build when `NEXT_PUBLIC_MEDUSA_BACKEND_URL` is missing, or points at localhost on Vercel.
- `next.config.js`: the `localhost` image host is dev-only. The backend host and an optional `NEXT_PUBLIC_IMAGE_HOST_URL` are added from env automatically. Catalog SVGs are served from `/public` by Vercel.

| Variable | Required | Example / note |
| --- | --- | --- |
| `NEXT_PUBLIC_MEDUSA_BACKEND_URL` | yes | `https://api.your-domain.com` (HTTPS, public) |
| `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY` | yes | from Admin → Settings → Publishable API keys |
| `NEXT_PUBLIC_BASE_URL` | recommended | `https://shop.your-domain.com` (canonical, sitemap, JSON-LD) |
| `NEXT_PUBLIC_DEFAULT_REGION` | yes | `bd` |
| `NEXT_PUBLIC_STORE_COUNTRIES` | optional | `bd` (default) |
| `NEXT_PUBLIC_IMAGE_HOST_URL` | optional | CDN/S3 base URL if product images move off `/public` |
| `NEXT_PUBLIC_STRIPE_KEY` and similar | no | only if a real payment provider is added later |

### Backend and services (deployed separately; Vercel cannot host Medusa)
- Medusa server and worker (Node 22.23.4+; the current local Node is 22.23.3 and warns) on a Node host such as Railway, Render, Fly or Medusa Cloud. Run `medusa build`, `medusa db:migrate` (this also runs `db:migrate:search`), then `medusa start`.
- Managed PostgreSQL 15+. Restore from `medusa-20261102-074627-post-phaseF.dump` with `pg_restore --no-owner`, or migrate fresh and run `setup-bangladesh.ts` and `enrich-sgnova.ts` after `seed-sgnova.ts`.
- Redis for the event bus, cache and locking (`REDIS_URL`); the local fake Redis is dev-only.
- File storage (S3/R2) if the admin will upload images.
- Search: the installed provider is `search-postgres`, so no extra service is needed.
- Backend env: `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `COOKIE_SECRET` (new strong values), `STORE_CORS=https://shop.your-domain.com`, `ADMIN_CORS=https://api.your-domain.com`, `AUTH_CORS=` both.

### Checklist
- [ ] Provision PostgreSQL and Redis; restore the final dump
- [ ] Deploy the Medusa backend with production secrets and CORS; create an admin user
- [ ] Create or confirm a publishable key linked to the Default Sales Channel
- [ ] Set the Vercel env vars above; deploy the storefront from `apps/storefront`
- [ ] Smoke test: `/bd`, search, category, PDP, cart, checkout with manual payment
- [ ] Before taking real orders, replace the manual payment provider, add a notification provider, and replace the synthetic catalog and illustrations with real, licensed product data

## 10. Not completed or needing approval

- Multi-variant products (not in scope of the current fixtures).
- Committing, pushing and deploying (waiting for your approval).
