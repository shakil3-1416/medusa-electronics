import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { updateProductsWorkflow, updateProductVariantsWorkflow } from "@medusajs/medusa/core-flows"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { basename, extname, resolve } from "node:path"

/**
 * Bulk BDT pricing for verified real products.
 *
 *   PRICE_FILE=<csv|json>        input (XLSX: export the sheet as UTF-8 CSV first)
 *   PRICE_APPLY=1                write prices (default is a dry run)
 *   PRICE_MAX_QUOTE_AGE_DAYS=30  quotations older than this are rejected
 *   PRICE_ROLLBACK=<file>        restore prices from a rollback file
 *
 * Rows match a product by exact SKU, then manufacturer part number, then GTIN.
 * Only `supplier_quote` / `distributor_price_list` rows with an approver are
 * applied; `retail_reference` rows are recorded for review and never applied.
 * Supplier names and cost prices are written only to the git-ignored ledger
 * (sgnova/catalog/pricing/private/), never to Medusa, because product metadata
 * is readable through the public Store API. Nothing here invents a price.
 */

const LEDGER = resolve(process.cwd(), "../../sgnova/catalog/pricing/private")
const APPLY_SOURCES = new Set(["supplier_quote", "distributor_price_list"])
const ALL_SOURCES = new Set([...APPLY_SOURCES, "retail_reference"])
const AVAILABILITY = new Set(["in_stock", "backorder", "preorder", "out_of_stock"])
const MAX_PRICE_BDT = 10_000_000
const FIXTURE = /fixture|dry[- ]?run|test/i

type Row = Record<string, string>
type Planned = {
  line: number
  status: "apply" | "unchanged" | "reference_only" | "not_approved" | "error"
  reasons: string[]
  handle?: string
  variant_id?: string
  matched_by?: string
  current_bdt?: number | null
  selling_price_bdt?: number
  row: Row
}

export default async function applyBdtPrices({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  mkdirSync(LEDGER, { recursive: true })

  if (process.env.PRICE_ROLLBACK) {
    return rollback(container, process.env.PRICE_ROLLBACK, logger)
  }
  const file = process.env.PRICE_FILE
  if (!file || !existsSync(file)) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "Set PRICE_FILE to a CSV or JSON price file")
  }
  const apply = process.env.PRICE_APPLY === "1"
  const maxAgeDays = Number(process.env.PRICE_MAX_QUOTE_AGE_DAYS || 30)
  const rows = parseFile(file)

  const { data: products } = await query.graph({
    entity: "product",
    fields: ["id", "handle", "status", "metadata", "variants.id", "variants.sku", "variants.prices.amount", "variants.prices.currency_code"],
  })
  const real = products.filter((p) => p.handle?.startsWith("real-"))
  const norm = (s: unknown) => String(s ?? "").trim().toLowerCase().replace(/[\s_-]+/g, "")
  const bySku = new Map<string, typeof real>(), byMpn = new Map<string, typeof real>(), byGtin = new Map<string, typeof real>()
  const push = (m: Map<string, typeof real>, k: string, p: (typeof real)[number]) => k && m.set(k, [...(m.get(k) ?? []), p])
  for (const p of real) {
    const md = (p.metadata ?? {}) as Record<string, unknown>
    for (const v of p.variants ?? []) push(bySku, norm(v?.sku), p)
    push(byMpn, norm(md.mpn), p)
    for (const g of (md.gtin as string[] | undefined) ?? []) push(byGtin, String(g).replace(/^0+/, ""), p)
  }

  const today = new Date()
  const seen = new Map<string, number>()
  const plan: Planned[] = rows.map((row, i) => {
    const line = i + 2
    const reasons: string[] = []
    const source = (row.source_type || "").trim()
    let match: (typeof real)[number] | undefined, matchedBy = ""
    for (const [key, map, val] of [
      ["sku", bySku, norm(row.sku)],
      ["mpn", byMpn, norm(row.mpn)],
      ["gtin", byGtin, String(row.gtin || "").trim().replace(/^0+/, "")],
    ] as const) {
      if (!val) continue
      const hits = map.get(val) ?? []
      if (hits.length > 1) { reasons.push(`${key} matches ${hits.length} products`); break }
      if (hits.length === 1) { match = hits[0]; matchedBy = key; break }
    }
    if (!match && !reasons.length) reasons.push("no product with this SKU, MPN or GTIN")
    const md = (match?.metadata ?? {}) as Record<string, unknown>
    if (match && row.brand && !norm(md.brand).startsWith(norm(row.brand).slice(0, 4))) {
      reasons.push(`brand mismatch: file '${row.brand}' vs catalog '${md.brand}'`)
    }
    if (match && row.model && md.model && !norm(md.model).includes(norm(row.model)) && !norm(row.model).includes(norm(md.model))) {
      reasons.push(`model mismatch: file '${row.model}' vs catalog '${md.model}'`)
    }
    if (!ALL_SOURCES.has(source)) reasons.push(`source_type must be one of ${[...ALL_SOURCES].join(", ")}`)
    if ((row.currency || "").toUpperCase() !== "BDT") reasons.push("currency must be BDT")
    const price = Number(String(row.selling_price_bdt ?? "").replace(/,/g, ""))
    if (!Number.isFinite(price) || price <= 0 || price > MAX_PRICE_BDT) reasons.push("selling_price_bdt must be a positive BDT amount")
    const cost = row.cost_price_bdt ? Number(String(row.cost_price_bdt).replace(/,/g, "")) : null
    if (cost !== null && (!Number.isFinite(cost) || cost <= 0)) reasons.push("cost_price_bdt is invalid")
    if (cost !== null && Number.isFinite(price) && cost > price) reasons.push("selling price is below cost")
    const quoted = new Date(row.quote_date)
    if (isNaN(quoted.getTime())) reasons.push("quote_date missing or invalid (YYYY-MM-DD)")
    else if ((today.getTime() - quoted.getTime()) / 86400000 > maxAgeDays) reasons.push(`quotation older than ${maxAgeDays} days`)
    if (row.valid_until && new Date(row.valid_until) < today) reasons.push("quotation expired (valid_until)")
    if (row.availability && !AVAILABILITY.has(row.availability)) reasons.push(`availability must be one of ${[...AVAILABILITY].join(", ")}`)
    if (!row.availability) reasons.push("availability is required")
    if (match) {
      const prev = seen.get(match.id)
      if (prev) reasons.push(`duplicate row for the same product (line ${prev})`)
      else seen.set(match.id, line)
    }
    const variant = match?.variants?.[0]
    const prices = ((variant as { prices?: { amount?: number; currency_code?: string }[] } | null)?.prices) ?? []
    const current = prices.find((p) => p?.currency_code === "bdt")?.amount ?? null
    const base = { line, row, handle: match?.handle, variant_id: variant?.id, matched_by: matchedBy, current_bdt: current as number | null, selling_price_bdt: price }
    if (reasons.length) return { ...base, status: "error", reasons }
    if (source === "retail_reference") return { ...base, status: "reference_only", reasons: ["retail reference: recorded for review, never applied"] }
    if (!row.approved_by?.trim()) return { ...base, status: "not_approved", reasons: ["approved_by is empty"] }
    if (current === price && md.price_status === "approved") return { ...base, status: "unchanged", reasons: [] }
    return { ...base, status: "apply", reasons: FIXTURE.test(`${row.supplier} ${row.approved_by}`) ? ["fixture row: never applied"] : [] }
  })

  const counts = plan.reduce<Record<string, number>>((acc, p) => ({ ...acc, [p.status]: (acc[p.status] ?? 0) + 1 }), {})
  const stamp = new Date().toISOString().replace(/[:.]/g, "-")
  const reportPath = resolve(LEDGER, `price-report-${stamp}.json`)
  writeFileSync(reportPath, JSON.stringify({ file: basename(file), apply, counts, plan }, null, 1))
  logger.info(`BDT PRICING ${apply ? "APPLY" : "DRY RUN"}: ${JSON.stringify(counts)} -> ${reportPath}`)

  const toApply = plan.filter((p) => p.status === "apply" && !p.reasons.length)
  if (!apply || !toApply.length) return

  // Rollback file first, then prices, then public price metadata.
  const rollbackPath = resolve(LEDGER, `price-rollback-${stamp}.json`)
  writeFileSync(rollbackPath, JSON.stringify(toApply.map((p) => ({ variant_id: p.variant_id, handle: p.handle, previous_bdt: p.current_bdt })), null, 1))
  await updateProductVariantsWorkflow(container).run({
    input: { product_variants: toApply.map((p) => ({ id: p.variant_id!, prices: [{ amount: p.selling_price_bdt!, currency_code: "bdt" }] })) },
  })
  const byHandle = new Map(real.map((p) => [p.handle, p]))
  await updateProductsWorkflow(container).run({
    input: {
      products: toApply.map((p) => {
        const prod = byHandle.get(p.handle!)!
        return {
          id: prod.id,
          metadata: {
            ...((prod.metadata as Record<string, unknown>) ?? {}),
            price_status: "approved",
            price_approved_at: new Date().toISOString().slice(0, 10),
            availability: p.row.availability,
            warranty: p.row.warranty || (prod.metadata as Record<string, unknown>)?.warranty || null,
          },
        }
      }),
    },
  })
  logger.info(`Applied ${toApply.length} BDT prices. Rollback: ${rollbackPath}`)
}

async function rollback(container: ExecArgs["container"], file: string, logger: { info: (m: string) => void }) {
  const entries = JSON.parse(readFileSync(file, "utf8")) as { variant_id: string; previous_bdt: number | null }[]
  const restore = entries.filter((e) => e.previous_bdt !== null)
  if (restore.length) {
    await updateProductVariantsWorkflow(container).run({
      input: { product_variants: restore.map((e) => ({ id: e.variant_id, prices: [{ amount: e.previous_bdt!, currency_code: "bdt" }] })) },
    })
  }
  logger.info(`Rollback restored ${restore.length} previous prices; ${entries.length - restore.length} had no previous price (unpublish them with the publication workflow).`)
}

function parseFile(file: string): Row[] {
  const ext = extname(file).toLowerCase()
  const text = readFileSync(file, "utf8").replace(/^﻿/, "")
  if (ext === ".json") return (JSON.parse(text) as Row[]).map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v == null ? "" : String(v)])))
  if (ext === ".xlsx" || ext === ".xls") {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "Export the spreadsheet as UTF-8 CSV and pass the .csv file")
  }
  const records = parseCsv(text)
  const header = records.shift()?.map((h) => h.trim()) ?? []
  return records.filter((r) => r.some((c) => c.trim())).map((r) => Object.fromEntries(header.map((h, i) => [h, (r[i] ?? "").trim()])))
}

/** RFC 4180 CSV: quoted fields, escaped quotes, commas and newlines inside quotes. */
function parseCsv(text: string): string[][] {
  const out: string[][] = []
  let row: string[] = [], field = "", quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++ }
      else if (c === '"') quoted = false
      else field += c
    } else if (c === '"') quoted = true
    else if (c === ",") { row.push(field); field = "" }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++
      row.push(field); out.push(row); row = []; field = ""
    } else field += c
  }
  if (field || row.length) { row.push(field); out.push(row) }
  return out
}
