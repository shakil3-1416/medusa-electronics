# Medusa Electronics

An independent electronics e-commerce store for Bangladesh, built on
[Medusa](https://medusajs.com) 2.x and Next.js. Prices are in Bangladeshi
Taka (BDT, ৳) with Bangladesh-only regional settings.

## Features

- Medusa backend (`apps/backend`) and Next.js storefront (`apps/storefront`) in one pnpm/Turborepo workspace
- Bangladesh region with BDT pricing, Dhaka warehouse and BDT delivery options (Inside Dhaka, Outside Dhaka, Express)
- Search with BDT price filtering and sorting, brand and category facets
- Electronics storefront with department navigation, category rails, product cards and structured specification tables
- Cart, checkout with a manual test payment provider, and customer accounts
- A product-verification pipeline (`sgnova/catalog/real/`) that only accepts products whose specifications match the manufacturer's official page and whose photos carry a verifiable licence

## Project structure

```text
apps/backend      Medusa server, admin and scripts (src/scripts/*.ts, run with medusa exec)
apps/storefront   Next.js storefront
sgnova/catalog    Catalog data and pipelines: synthetic fixtures, verified real-product records
sgnova/reports    Implementation, readiness and catalog coverage reports
docs/             Upstream Medusa DTC Starter documentation
```

## Getting started

Requirements: Node.js 22.23.4+, pnpm, and PostgreSQL 15+.

```bash
pnpm install
cp apps/backend/.env.template apps/backend/.env          # set DATABASE_URL and secrets
cp apps/storefront/.env.template apps/storefront/.env.local
cd apps/backend && pnpm exec medusa db:migrate
pnpm exec medusa exec ./src/scripts/setup-bangladesh.ts  # Bangladesh region, BDT shipping
cd ../.. && pnpm run dev
```

Production environment examples: `apps/storefront/.env.vercel.example` and
`apps/backend/.env.production.example`. See `docs/MEDUSA_DTC_STARTER_README.md`
for the full upstream setup guide.

## Catalog data and licensing

- **Synthetic catalog** (`sgnova/catalog/products*.json`, `apps/storefront/public/catalog/`): fictional test products and original SVG illustrations, labelled as test data in the store.
- **Verified real products** (`sgnova/catalog/real/verified/`): specifications checked against official manufacturer pages. Product photos in `apps/storefront/public/catalog-real/` are Wikimedia Commons files under CC0, public domain, CC BY or CC BY-SA. Each photo's author, licence and source are listed in [`apps/storefront/public/catalog-real/CREDITS.md`](apps/storefront/public/catalog-real/CREDITS.md) and shown on the product page. CC BY-SA photos remain under CC BY-SA.
- **Open Icecat**: the repository contains only the adapter (`sgnova/catalog/real/icecat_adapter.py`). Icecat product data and images are licensed to each account holder under the Open Content License, so they are not included. Run the adapter with your own Open Icecat account.
- No prices are included for real products. They are imported as unpublished drafts until sourced BDT prices exist.

## License

The application code is released under the MIT License (see [LICENSE](LICENSE)).
It is based on the [Medusa DTC Starter](https://github.com/medusajs/dtc-starter)
© Medusa, also MIT licensed. Product photographs keep their individual
licences as listed in `CREDITS.md`.
