# Real Catalog Preview (local development only)

Date: 2026-11-03. No products were published, no prices were added, nothing was pushed or deployed.

## Open it

**http://localhost:4111/bd/preview/real**

- Browse all 637 real products, or one category from the sidebar (`?category=motherboard`). Search by model or brand (`?q=…`), 24 per page.
- Product pages are at `/bd/preview/real/<handle>`, for example `/bd/preview/real/real-be-quiet-bn343` (Open Icecat) and `/bd/preview/real/real-mikrotik-hap-ac2` (Wikimedia Commons).
- Each page shows: the real photo gallery with attribution, brand, model and SKU, the specification table with its source, the Open Icecat licence notice where applicable, and any manual-review notes.
- **Price pending** is shown everywhere, and Add to cart is disabled. No price or cart action exists for these records.

## How it is secured

- **Server-side only.** Drafts are read from the **Admin API** with a dedicated secret API key, "Local real-catalog preview (development only)".
  - The key is created by `apps/backend/src/scripts/create-preview-api-key.ts`, which writes it straight into the git-ignored `apps/storefront/.env.local` (mode 600) and never prints it.
  - It is used only in `src/lib/data/real-preview.ts`, which is `server-only`.
- **When the routes respond.** Every preview route returns 404 unless all of these hold:
  - `NODE_ENV=development`;
  - `ENABLE_REAL_CATALOG_PREVIEW=1`;
  - the key is present;
  - the request host is `localhost`, `127.0.0.1` or `[::1]`.

  Production builds therefore never serve them.
- **Verified:**
  - Admin API: 401 without the key, 200 with it.
  - Store API still returns 0 drafts.
  - Non-localhost Host header → 404; unknown handle → 404; published synthetic handle via the preview → 404.
  - 0 occurrences of the key in page HTML or client JS chunks.
  - Pages are `force-dynamic` and marked `noindex`.
- **To revoke:** delete the key in Medusa Admin → Settings → Secret API Keys, and remove the two lines from `.env.local`.

## Image audit (all records)

| Check | Result |
| --- | --- |
| Stored image URLs checked (HEAD, 4 parallel) | **2,280**: 637 thumbnails + 1,643 gallery images |
| Return `200` with an `image/*` content type | **2,280 / 2,280** |
| Broken local or Icecat CDN URLs | **0** |
| Hosts | `http://localhost:4111/catalog-real/…` (199 thumbnails, 312 gallery) and `https://images.icecat.biz/…` (438 thumbnails, 1,331 gallery) |
| In-browser render (cards and galleries) | Images loaded with no broken images on the listing, the Motherboards category, the be quiet! BN343 page (4/4) and the MikroTik hAP ac2 page |

**Image-to-product matching.** For Icecat, each image comes from the exact manufacturer part-code data sheet. For Commons, the gate required an exact model reference on each photo. I spot-checked photos visually on the listing, the Motherboards category and two product pages; I did not view all 637 by eye.

**Attribution visible.**
- Commons: "Photo: <author>, <licence>, via Wikimedia Commons".
- Icecat: "Photo: <brand>, via Open Icecat (Open Content License)", plus the database-right / AS IS / modification notice under the spec table.

## Incomplete records

| Gap | Count | Effect in the preview |
| --- | --- | --- |
| No sourced BDT price | 637 / 637 | "Price pending", Add to cart disabled |
| Manual review notes (Commons pipeline) | 62 | Amber "needs manual review" box on the product page |
| Only one photo | 228 | Single-image gallery |
| No "Key features" highlights (Icecat records) | 438 | Section hidden; full spec table still shown. Icecat `BulletPoints` could fill this in a later adapter run |
| Missing thumbnail, specs, credits or category | 0 | — |

## Unchanged

- **Live store:** 600 synthetic products remain the only published ones; the storefront API returns 600.
- **Search:** BDT search works (37 products ≤ ৳5,000).
- **Checkout:** API checkout completed (order #8, ৳9,580, BDT).
- **Pages:** `/bd`, `/bd/store` and the product pages return 200.
- **Quality:** 0 type errors and 0 ESLint errors in the storefront.
