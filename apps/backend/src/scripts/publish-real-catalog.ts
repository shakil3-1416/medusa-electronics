import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError, ProductStatus } from "@medusajs/framework/utils"
import { updateProductsWorkflow } from "@medusajs/medusa/core-flows"
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"
import { CatalogProduct as Product, publicationBlockers, selectPublishBatch } from "../lib/catalog-publication"

/**
 * Controlled publication of verified real products (and, separately,
 * retirement of the synthetic catalog). Default is a dry run that audits every
 * real product against the publication gate and writes a report.
 *
 *   PUBLISH_APPLY=1 PUBLISH_CONFIRM=publish-real-catalog PUBLISH_BATCH=50
 *       [PUBLISH_CATEGORIES=motherboard,hard-drive] [PUBLISH_INCLUDE_OUT_OF_STOCK=1]
 *       publish up to 50 eligible real products, optionally only in some
 *       categories; out-of-stock products are held back unless included
 *   RETIRE_SYNTHETIC=1 PUBLISH_CONFIRM=retire-synthetic-catalog [RETIRE_MIN_REAL=10]
 *       move synthetic products back to draft, only in categories that already
 *       have at least RETIRE_MIN_REAL published real products (never deletes)
 *   PUBLISH_ROLLBACK=<ledger.json>   restore the statuses recorded in a ledger
 *
 * Ledgers and reports go to sgnova/catalog/publication/ (git-ignored).
 */

const LEDGER = resolve(process.cwd(), "../../sgnova/catalog/publication")
export default async function publishRealCatalog({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  mkdirSync(LEDGER, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, "-")

  if (process.env.PUBLISH_ROLLBACK) {
    const entries = JSON.parse(readFileSync(process.env.PUBLISH_ROLLBACK, "utf8")) as { id: string; previous_status: string }[]
    await updateProductsWorkflow(container).run({
      input: { products: entries.map((e) => ({ id: e.id, status: e.previous_status as ProductStatus })) },
    })
    logger.info(`Rollback restored ${entries.length} product statuses`)
    return
  }

  const { data } = await query.graph({
    entity: "product",
    fields: [
      "id", "handle", "status", "thumbnail", "metadata", "images.url", "categories.id", "categories.handle",
      "sales_channels.id", "variants.id", "variants.sku", "variants.prices.amount", "variants.prices.currency_code",
    ],
  })
  const products = data as unknown as Product[]
  const real = products.filter((p) => p.handle.startsWith("real-"))
  const synthetic = products.filter((p) => p.handle.startsWith("sgnova-"))

  // Duplicate guard: one product per handle and per SKU.
  const skuOwners = new Map<string, string[]>()
  for (const p of real) for (const v of p.variants ?? []) if (v?.sku) skuOwners.set(v.sku, [...(skuOwners.get(v.sku) ?? []), p.handle])
  const audit = real.map((p) => {
    const blockers = publicationBlockers(p)
    for (const v of p.variants ?? []) if (v?.sku && (skuOwners.get(v.sku)?.length ?? 0) > 1) blockers.push(`SKU ${v.sku} shared with another product`)
    const localhostImages = [p.thumbnail, ...(p.images ?? []).map((i) => i?.url)].some((u) => u?.includes("://localhost"))
    return { handle: p.handle, id: p.id, status: p.status, blockers, warnings: localhostImages ? ["image URLs point at localhost (re-point before deployment)"] : [] }
  })
  const eligible = audit.filter((a) => a.status === ProductStatus.DRAFT && !a.blockers.length)
  const blockerCounts = audit.flatMap((a) => a.blockers).reduce<Record<string, number>>((acc, b) => {
    const key = b.replace(/^SKU .*/, "duplicate SKU").replace(/^review status .*/, (m) => m)
    return { ...acc, [key]: (acc[key] ?? 0) + 1 }
  }, {})

  // Synthetic retirement plan by category.
  const realPublishedByCat = new Map<string, number>()
  for (const p of real) if (p.status === ProductStatus.PUBLISHED) for (const c of p.categories ?? []) if (c) realPublishedByCat.set(c.handle, (realPublishedByCat.get(c.handle) ?? 0) + 1)
  const minReal = Number(process.env.RETIRE_MIN_REAL || 10)
  const retirable = synthetic.filter((p) => p.status === ProductStatus.PUBLISHED && (p.categories ?? []).some((c) => c && (realPublishedByCat.get(c.handle) ?? 0) >= minReal))

  const report = {
    generated_at: new Date().toISOString(),
    real_products: real.length,
    real_published: real.filter((p) => p.status === ProductStatus.PUBLISHED).length,
    eligible_to_publish: eligible.length,
    blocker_counts: blockerCounts,
    synthetic_published: synthetic.filter((p) => p.status === ProductStatus.PUBLISHED).length,
    synthetic_retirable_now: retirable.length,
    retire_min_real_per_category: minReal,
    audit,
  }
  const reportPath = resolve(LEDGER, `publication-report-${stamp}.json`)
  writeFileSync(reportPath, JSON.stringify(report, null, 1))
  logger.info(`PUBLICATION AUDIT: real=${report.real_products} published=${report.real_published} eligible=${eligible.length} synthetic_retirable=${retirable.length} blockers=${JSON.stringify(blockerCounts)} -> ${reportPath}`)

  if (process.env.PUBLISH_APPLY === "1") {
    if (process.env.PUBLISH_CONFIRM !== "publish-real-catalog") {
      throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Set PUBLISH_CONFIRM=publish-real-catalog to publish")
    }
    const selection = selectPublishBatch(products, {
      categories: (process.env.PUBLISH_CATEGORIES || "").split(",").map((c) => c.trim()),
      includeOutOfStock: process.env.PUBLISH_INCLUDE_OUT_OF_STOCK === "1",
      batchSize: Number(process.env.PUBLISH_BATCH || 25),
    })
    logger.info(`Selection: batch=${selection.batch.length} held_out_of_stock=${selection.heldOutOfStock.length} outside_categories=${selection.outsideCategories} blocked=${selection.blocked.length}`)
    const batch = selection.batch
    if (!batch.length) return logger.info("Nothing eligible to publish")
    const ledger = resolve(LEDGER, `publish-ledger-${stamp}.json`)
    writeFileSync(ledger, JSON.stringify(batch.map((b) => ({ id: b.id, handle: b.handle, previous_status: b.status })), null, 1))
    await updateProductsWorkflow(container).run({ input: { products: batch.map((b) => ({ id: b.id, status: ProductStatus.PUBLISHED })) } })
    const { data: check } = await query.graph({ entity: "product", fields: ["id", "status"], filters: { id: batch.map((b) => b.id) } })
    const ok = check.filter((p) => p.status === ProductStatus.PUBLISHED).length
    logger.info(`Published ${ok}/${batch.length}. Search index updates via product.updated events. Rollback: ${ledger}`)
  }

  if (process.env.RETIRE_SYNTHETIC === "1") {
    if (process.env.PUBLISH_CONFIRM !== "retire-synthetic-catalog") {
      throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Set PUBLISH_CONFIRM=retire-synthetic-catalog to retire synthetic products")
    }
    if (!retirable.length) return logger.info("No synthetic products are retirable yet")
    const ledger = resolve(LEDGER, `retire-ledger-${stamp}.json`)
    writeFileSync(ledger, JSON.stringify(retirable.map((p) => ({ id: p.id, handle: p.handle, previous_status: p.status })), null, 1))
    await updateProductsWorkflow(container).run({ input: { products: retirable.map((p) => ({ id: p.id, status: ProductStatus.DRAFT })) } })
    logger.info(`Retired ${retirable.length} synthetic products to draft. Rollback: ${ledger}`)
  }
}
