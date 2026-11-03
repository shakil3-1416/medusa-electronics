import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { mkdirSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"
import { CatalogProduct, publicationBlockers } from "../lib/catalog-publication"

const OUT_DIR = resolve(process.cwd(), "../../sgnova/catalog/pricing/private")
const PRICE_ONLY = new Set(["no BDT selling price", "price not approved", "availability not set"])
const INPUT_COLUMNS = [
  "supplier", "source_type", "quote_date", "valid_until", "currency", "cost_price_bdt",
  "selling_price_bdt", "warranty", "availability", "stock_qty", "approved_by", "notes",
]

/**
 * Writes the supplier pricing template for every real product whose only
 * remaining publication blockers are price, approval and availability.
 * Identifier columns are filled from the catalog; pricing columns are left
 * empty for the supplier (currency is pre-set to BDT). The file goes to the
 * git-ignored private pricing folder because it contains Icecat-derived titles.
 */
export default async function exportPriceTemplate({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "product",
    fields: [
      "id", "handle", "title", "status", "thumbnail", "metadata", "images.url", "categories.id", "categories.handle",
      "sales_channels.id", "variants.id", "variants.sku", "variants.prices.amount", "variants.prices.currency_code",
    ],
  })
  const rows = (data as unknown as (CatalogProduct & { title: string })[])
    .filter((p) => p.handle.startsWith("real-") && p.status === "draft")
    .filter((p) => publicationBlockers(p).every((b) => PRICE_ONLY.has(b)))
    .map((p) => {
      const md = p.metadata ?? {}
      const gtin = Array.isArray(md.gtin) ? String(md.gtin[0] ?? "") : ""
      return {
        handle: p.handle,
        category: p.categories?.[0]?.handle ?? "",
        brand: String(md.brand ?? ""),
        model: String(md.model ?? ""),
        title: p.title,
        sku: p.variants?.[0]?.sku ?? "",
        mpn: String(md.mpn ?? ""),
        gtin,
        ...Object.fromEntries(INPUT_COLUMNS.map((c) => [c, c === "currency" ? "BDT" : ""])),
      }
    })
    .sort((a, b) => a.category.localeCompare(b.category) || a.brand.localeCompare(b.brand) || a.title.localeCompare(b.title))

  const header = ["handle", "category", "brand", "model", "title", "sku", "mpn", "gtin", ...INPUT_COLUMNS]
  const cell = (v: unknown) => {
    const s = String(v ?? "")
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const csv = [header, ...rows.map((r) => header.map((h) => (r as Record<string, unknown>)[h]))]
    .map((r) => r.map(cell).join(","))
    .join("\r\n")
  mkdirSync(OUT_DIR, { recursive: true })
  const out = resolve(OUT_DIR, "supplier-price-template.csv")
  writeFileSync(out, "﻿" + csv + "\r\n")
  logger.info(`PRICE TEMPLATE: ${rows.length} products -> ${out}`)
}
