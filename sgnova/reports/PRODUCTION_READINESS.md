# Production Readiness and Git Preparation

Date: 2026-11-02. Follows `FINAL_IMPLEMENTATION_REPORT.md`. Nothing was pushed or deployed, and no database data was deleted.

## What changed in this pass

- **Git hygiene.** `.gitignore` now excludes database dumps (`sgnova/backups/`, `*.dump`), test credentials (`**/*.local.json`), run logs (`*.log`, `sgnova/reports/*.log`, `batch-report.json`), editor/backup copies (`*.bak`, `*.backup-*`, `*.pre-routing-*`, `*.recovery-*`) and generated caches (`.turbo/`, `**/.medusa/`). `.env` and `.env.local` were already ignored. A secret scan of all files to be committed found nothing; the only hits were git-ignored files and the upstream `.env.template` placeholders.
- **Generated files kept out of commits.** `apps/storefront/next-env.d.ts` and `apps/storefront/tsconfig.tsbuildinfo` are rewritten by `next dev` / `next build`. I reverted them and did not commit them.
- **Lint.** The storefront had 10 ESLint errors; it now has 0 (28 warnings remain, all pre-existing).
  - `src/lib/data/cart.ts`: unused stub parameters were prefixed with `_`, `catch (e: any)` became `unknown` with a message helper, and the address payload is typed as `HttpTypes.StoreUpdateCart`.
  - `language-select`: removed two unnecessary `@ts-ignore` comments.
  - Backend: 0 lint errors; 0 type errors after null-safe fixes in the earlier `seed-sgnova.ts` and `audit-electronics.ts`.
- **Admin image previews.**
  - `enrich-sgnova.ts` accepts `SGNOVA_IMAGE_BASE_URL` and stores absolute URLs to the storefront's `/public/catalog` files. The Admin, which runs on the backend origin, can then load them.
  - `next.config.js` allows the `NEXT_PUBLIC_BASE_URL` host for images.
  - Applied locally with `http://localhost:4111`, after a validated backup (`medusa-20261102-080731-pre-image-urls.dump`). 600/600 thumbnails and images are absolute, and all 120 distinct URLs return `200 image/svg+xml`.
  - No asset uploads, and no hosting credentials used.
  - The Admin UI itself was not opened, because it needs an admin sign-in.
- **Env examples.** `apps/storefront/.env.vercel.example` and `apps/backend/.env.production.example`.

## Validation (bounded)

| Check | Result |
| --- | --- |
| `next build` (production) | Pass, 36 s |
| Storefront `tsc --noEmit` / ESLint | 0 errors / 0 errors |
| Backend `tsc --noEmit` / `medusa lint` | 0 errors / 0 errors |
| `next start` routes: `/bd`, `/bd/store`, category, PDP, cart, account | 200 |
| `/dk/store` | 307 to `/bd/store` |
| PDP shows ৳48,300, absolute image URL, spec table | Pass |
| `/store/regions` | Only Bangladesh, `bdt` |
| Published products / with thumbnail / active categories | 600 / 600 / 30 |
| API checkout: BD cart, Outside Dhaka ৳150, manual payment, complete | Order #2, `bdt`, total ৳48,450 |

## Deployment blockers

1. **Redis modules are not configured.** `medusa-config.ts` registers no Redis event bus, workflow engine, caching or locking module, so production would fall back to in-memory, single-instance modules. Add them, conditional on `REDIS_URL`, and test against a real Redis before going live. The packages already ship with `@medusajs/medusa`.
2. **Image URLs must be re-pointed at deploy time.** The database currently stores `http://localhost:4111/catalog/...`. After the storefront has a public URL, run:
   `SGNOVA_IMAGE_BASE_URL=https://<storefront-domain> medusa exec ./src/scripts/enrich-sgnova.ts`
3. **Infrastructure not provisioned.** No backend host, managed PostgreSQL, Redis, domains or TLS exist yet. Restore the latest dump (`pg_restore --no-owner`) or migrate and run the scripts.
4. **Secrets.** Production `JWT_SECRET`, `COOKIE_SECRET`, CORS origins and a publishable key must be created on the hosts. None are in Git.
5. **Payments and notifications.** Only the manual test payment provider exists, and there is no notification provider. Real orders need a payment gateway and an email/SMS provider.
6. **Catalog content.** The products, specs and illustrations are synthetic test fixtures for fictional brands. Replace them with real, licensed product data before public launch.
7. **Node version.** The engine requirement is `>=22.23.4`; the local Node is 22.23.3. Use 22.23.4+ on the hosts.

Non-blocking leftovers: the European Warehouse and its two EU shipping options are unused; 28 storefront lint warnings are pre-existing; and every product has a single variant.
