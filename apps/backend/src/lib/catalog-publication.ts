/**
 * Pure publication rules for the verified real catalog, shared by
 * scripts/publish-real-catalog.ts and its unit tests. No I/O here.
 */

export const AVAILABILITY = new Set(["in_stock", "backorder", "preorder", "out_of_stock"])
export const MIN_SPECS = 5

export type CatalogProduct = {
  id: string
  handle: string
  status: string
  thumbnail: string | null
  metadata: Record<string, unknown> | null
  images?: ({ url?: string } | null)[]
  categories?: ({ id: string; handle: string } | null)[]
  sales_channels?: ({ id: string } | null)[]
  variants?: ({ id: string; sku?: string | null; prices?: { amount?: number; currency_code?: string }[] } | null)[]
}

/** Everything that stops a product from being published, as readable reasons. */
export function publicationBlockers(p: CatalogProduct): string[] {
  const md = p.metadata ?? {}
  const out: string[] = []
  const bdt = (p.variants ?? []).flatMap((v) => v?.prices ?? []).find((x) => x?.currency_code === "bdt")
  if (!bdt?.amount || bdt.amount <= 0) out.push("no BDT selling price")
  if (md.price_status !== "approved") out.push("price not approved")
  if (!AVAILABILITY.has(String(md.availability ?? ""))) out.push("availability not set")
  if (md.review_status !== "auto_verified") out.push(`review status ${md.review_status ?? "unknown"}`)
  if (!p.thumbnail || !(p.images ?? []).length) out.push("missing thumbnail or gallery")
  const credits = (md.image_credits as { license?: string }[] | undefined) ?? []
  if (!credits.length || credits.some((c) => !c?.license)) out.push("missing photo attribution")
  if (md.content_source === "open-icecat" && typeof md.content_disclaimer !== "string") {
    out.push("missing Open Icecat licence notice")
  }
  const specs = (md.specs as { items?: unknown[] }[] | undefined) ?? []
  if (specs.reduce((n, g) => n + (g?.items?.length ?? 0), 0) < MIN_SPECS) out.push("fewer than 5 specifications")
  if (!(p.categories ?? []).length) out.push("no category")
  if (!(p.sales_channels ?? []).length) out.push("not in a sales channel")
  if (!(p.variants ?? []).some((v) => v?.sku)) out.push("no SKU")
  return out
}

export type BatchOptions = {
  /** Only these category handles (category-by-category activation). Empty = all. */
  categories?: string[]
  /** Out-of-stock products are held back unless explicitly included. */
  includeOutOfStock?: boolean
  batchSize?: number
}

export type Selection = {
  batch: CatalogProduct[]
  heldOutOfStock: string[]
  outsideCategories: number
  blocked: { handle: string; blockers: string[] }[]
}

/**
 * Picks the next publish batch: real drafts with no blockers and a unique SKU,
 * optionally limited to some categories, skipping out-of-stock items by default.
 * Products without prices are simply blocked, so partial price coverage
 * publishes only the priced subset.
 */
export function selectPublishBatch(products: CatalogProduct[], opts: BatchOptions = {}): Selection {
  const real = products.filter((p) => p.handle.startsWith("real-"))
  const skuOwners = new Map<string, number>()
  for (const p of real) for (const v of p.variants ?? []) if (v?.sku) skuOwners.set(v.sku, (skuOwners.get(v.sku) ?? 0) + 1)
  const wanted = new Set((opts.categories ?? []).filter(Boolean))
  const selection: Selection = { batch: [], heldOutOfStock: [], outsideCategories: 0, blocked: [] }
  for (const p of real) {
    if (p.status !== "draft") continue
    const blockers = publicationBlockers(p)
    for (const v of p.variants ?? []) if (v?.sku && (skuOwners.get(v.sku) ?? 0) > 1) blockers.push(`SKU ${v.sku} shared with another product`)
    if (blockers.length) {
      selection.blocked.push({ handle: p.handle, blockers })
      continue
    }
    if (wanted.size && !(p.categories ?? []).some((c) => c && wanted.has(c.handle))) {
      selection.outsideCategories += 1
      continue
    }
    if (p.metadata?.availability === "out_of_stock" && !opts.includeOutOfStock) {
      selection.heldOutOfStock.push(p.handle)
      continue
    }
    selection.batch.push(p)
  }
  selection.batch = selection.batch.slice(0, Math.max(1, opts.batchSize ?? 25))
  return selection
}
