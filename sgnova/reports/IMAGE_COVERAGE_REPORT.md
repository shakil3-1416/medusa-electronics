# Image Coverage Report: Real Product Catalog

Date: 2026-11-02. Branch `sgnova/bangladesh-electronics-store`. Nothing pushed or deployed, no paid services. The 600 synthetic products remain published and unchanged.

## Headline numbers (each stage counted separately)

| Stage | Count |
| --- | --- |
| Starting verified products | **55** |
| Exact-model products submitted to the gate (discovered with an official spec page and a candidate photo) | **200** |
| Passed the full gate: official specs, exact model, licensed matching photo | **199** |
| Rejected by the gate | 1 (NVIDIA RTX 4090 FE: Commons photo under "License review needed") |
| Matching real photographs stored (1200 px gallery + 480 px card each) | **312** for 199 products; 89 products have 2-4 angles |
| Photos with established usage rights (licence read from Commons API; author and source recorded) | **312 / 312** |
| Imported into Medusa as drafts (`real-*`, status `draft`) | **199** (144 new this pass, 55 updated) |
| Draft image URLs checked live (`200 image/*`) | 511 / 511 (thumbnails + gallery) |
| Flagged `needs_manual_review` (variant, generation, photo angle or source caveat) | 62 |
| With a sourced BDT price | **0** |
| **Publication-ready** (verified, no review note, priced) | **0** |
| Categories with at least one verified product | **24 of 30** |

Photo licences: CC BY-SA 4.0 (214), CC BY 4.0 (30), CC0 (28), CC BY-SA 2.0 (14), CC BY 2.0 (10), CC BY-SA 3.0 (10), CC BY 3.0 (4), Public domain (2). Every credit is listed in `apps/storefront/public/catalog-real/CREDITS.md` and shown on the product page.

Brands (19): Apple 61, AMD 17, Ubiquiti 17, Google 16, TP-Link 15, Xiaomi 14, Logitech 12, MikroTik 10, ASUS 6, Keychron 6, Samsung 6, Fairphone 4, Brother 3, Netgear 3, OnePlus 3, APC 2, Corsair 2, Epson 1, NVIDIA 1.

## Coverage by category (all 30)

| Category | Verified + drafted | Photos | Multi-angle | Needs review |
| --- | --- | --- | --- | --- |
| smartphone | 66 | 137 | 52 | 7 |
| router (incl. access points / outdoor radios) | 31 | 41 | 10 | 15 |
| processor | 14 | 19 | 4 | 6 |
| computer-accessory | 11 | 17 | 6 | 2 |
| smartwatch | 9 | 13 | 4 | 3 |
| business-laptop | 8 | 9 | 1 | 2 |
| tablet | 8 | 11 | 3 | 1 |
| network-switch | 8 | 9 | 1 | 2 |
| mechanical-keyboard | 7 | 9 | 2 | 6 |
| graphics-card | 4 | 8 | 2 | 4 |
| internal-ssd | 4 | 4 | 0 | 0 |
| gaming-mouse | 4 | 4 | 0 | 2 |
| printer | 4 | 4 | 0 | 1 |
| gaming-laptop | 3 | 5 | 1 | 3 |
| desktop-pc | 3 | 3 | 0 | 1 |
| office-monitor | 3 | 3 | 0 | 1 |
| headphone | 3 | 3 | 0 | 0 |
| ups | 2 | 2 | 0 | 2 |
| external-storage | 2 | 5 | 2 | 2 |
| desktop-ram | 1 | 1 | 0 | 0 |
| computer-case | 1 | 1 | 0 | 0 |
| gaming-monitor | 1 | 1 | 0 | 1 |
| microphone | 1 | 2 | 1 | 1 |
| webcam | 1 | 1 | 0 | 0 |
| motherboard | 0 | 0 | 0 | 0 |
| laptop-ram | 0 | 0 | 0 | 0 |
| hard-drive | 0 | 0 | 0 | 0 |
| power-supply | 0 | 0 | 0 | 0 |
| cpu-cooler | 0 | 0 | 0 | 0 |
| scanner | 0 | 0 | 0 | 0 |

## What was built or extended this pass

- `find_images.py` lists Commons photos of an exact model that are eligible under the licence rules, from both search and the model's own category. It returns several angles and applies the same rules as the gate.
- The gate (`validate_records.py`) gained:
  - up to 4 images per product;
  - 480 px card derivatives;
  - rejection of Commons files under licence review or deletion;
  - gzip decoding, with self-healing of stale cache entries;
  - HTTP 429/503 backoff and Commons throttling;
  - Canon's official European domains.
- `coverage.py` reports each stage separately per category (attempted, verified, photos, multi-angle, drafts, review, ready) and can check Medusa for drafts.
- Importer: the thumbnail uses the card image and the gallery uses the 1200 px images, as absolute URLs (`SGNOVA_IMAGE_BASE_URL`), so Medusa Admin previews work. The import is idempotent: a second run gave 0 created and 199 updated.
- Images were normalised to 1200 px at JPEG quality 70. The folder is 76 MB in total, including 12.7 MB of cards.
- Discovery ran as five bounded parallel workers by brand family. I then ran the gate myself over every record in a single process; agent claims were not taken on trust.

## Sources investigated

**Productive (official spec pages, static HTML):** support.apple.com (61), amd.com (product and support pages, 17), techspecs.ui.com (17), support.google.com (scoped per model, 16), tp-link.com regional pages (15), mi.com/global (14), mikrotik.com (10), logitech.com / logitechg.com (12), keychron.com (6), samsung.com/uk (6), rog.asus.com / asus.com (6), support.fairphone.com (4), brother-usa.com (3), netgear.com business switches (3), oneplus.com (3), se.com (APC, 2), corsair.com (2), epson.com (1), nvidia.com (1).

**Image sources**
- **Wikimedia Commons:** the only source with machine-verifiable commercial-reuse licences that this environment could reach.
- **Openverse:** unreachable from this network.
- **Manufacturer press kits and media libraries:** not used. Their terms are editorial-only, or require a reseller agreement.
- **Distributor feeds:** none available. No credentials or partner agreements exist.

**Blocked or unusable** (each probed once, not retried):
- **HTTP 403:** lenovo.com, raspberrypi.com, kingston.com, crucial.com, frame.work, usa.canon.com.
- **Spec content rendered in the browser:**
  - psref.lenovo.com, nothing.tech, garmin.com, seagate.com
  - asus.com motherboard and older monitor pages, home-router and support pages on netgear.com
  - the specs tab on logitech.com product pages
  - samsung.com/uk phone pages
- **Redirect to generic pages:** dell.com, samsung.com/us, store.google.com, nvidia.com GTX 10 / RTX 20 pages, westerndigital.com SSD pages (off-domain to sandisk.com).
- **TLS verification failure:** intel.com / ark.intel.com.
- **Rate limiting:** Commons returned frequent HTTP 429 under parallel load (about 1-3 minutes per lookup), which was the dominant throughput limit.

## Missing-image and licensing blockers

1. **Many products had official specs ready but no licensed exact-model photo.** About 25 Android models, about 40 Apple products (iPhone 6, 16 Plus, 17, Air, roughly 20 iPads, roughly 20 Macs, Watch SE), Ryzen 5 7600X / 5800X3D / 9800X3D / 5950X, RTX 3080/4080/5080/5090 FE, Samsung 870/860/970 EVO, WD Red Plus, Seagate drives, the Samsung CF591 monitor, and the scanners (Epson V39/V600, Brother ADS-1700W).
2. **Commons coverage is structurally thin** for motherboards, PSUs, CPU coolers, laptop RAM, hard drives, scanners and current-generation SKUs. Six categories have no product.
3. **Photos are community photographs, not studio shots.**
   - Some show the product in use, in a shop, or with other devices; these are flagged for review.
   - CC BY-SA 4.0, the majority licence, requires attribution and share-alike on the photo.
4. **Official manufacturer images** need a brand or distributor reseller agreement, which we do not have.
5. **Prices:** no authorised BDT price source exists, so all 199 drafts are unpriced. No product is publication-ready, and the readiness gate correctly blocks retiring the synthetic catalog.

## Actual remaining work to reach 600

| Need | Size of gap |
| --- | --- |
| Verified real products | 401 more (199 of 600) |
| Categories | 6 empty (motherboard, laptop-ram, hard-drive, power-supply, cpu-cooler, scanner) |
| Manual review | 62 drafts carry review notes to clear or fix |
| Prices | 199 drafts need sourced BDT prices |
| Publishing | Only after the readiness gate passes (500+ products, 20+ categories, 100% photos, 100% prices) |

Realistic paths, in order of impact:
1. **Authorised Bangladesh distributor or brand partner feeds**, with a written agreement granting product data, official image rights and dealer BDT prices. This is the only route that plausibly reaches 600 with consistent photos and prices. A feed adapter only needs to emit the existing record format.
2. **Open Icecat**, a free product-content tier with licensed manufacturer images for sponsoring brands. It needs an account registered by you (I cannot create accounts) and acceptance of its terms.
3. **Commons long tail.** The roughly 65 spec-ready records only need a photo pick; their builders and candidate lists are in the session scratchpad. This could add about 30-60 products at the current rate of 1-3 minutes per lookup.
4. **Optional, needs your approval:** a headless-browser fetcher for client-rendered manufacturer pages (Lenovo PSREF, Samsung, Garmin). Bypassing 403/anti-bot responses is out of scope.

## Git and regression results

Validated backups taken before the import, with all earlier backups kept: `medusa-20261102-105725-pre-photo-expansion.dump` (7 dumps in total).

| Check | Result |
| --- | --- |
| Published products / storefront API count / search documents | 600 / 600 / 600 (drafts invisible) |
| Region | Bangladesh only, `bdt` |
| API checkout (Express Delivery Dhaka, manual test payment) | Order #4, BDT, ৳1,13,150 |
| Storefront pages `/bd`, `/bd/store`, product page | 200 |
| Import rerun | 0 created, 199 updated (idempotent) |
| Type checks (both apps) / ESLint errors | 0 / 0 |

Commits in this pass are listed in `git log` on the branch, grouped as: pipeline tooling, verified records and photos, importer update, and this report.
