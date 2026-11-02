import type { ExecArgs } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  MedusaError,
  ProductStatus,
} from "@medusajs/framework/utils"
import {
  createProductsWorkflow,
  createProductTagsWorkflow,
  updateProductsWorkflow,
} from "@medusajs/medusa/core-flows"
import { readdirSync, readFileSync } from "node:fs"
import { resolve } from "node:path"

type VerifiedImage = {
  local_path: string
  card_path?: string
  license: string
  license_url: string
  artist: string
  credit: string
  page_url: string
  title: string
}

type VerifiedProduct = {
  handle: string
  brand: string
  model: string
  mpn?: string | null
  category_handle: string
  title: string
  subtitle: string
  description: string
  variant_title: string
  specs: { group: string; label: string; value: string }[]
  highlights: string[]
  price: { amount_bdt: number; source_url: string } | null
  provenance: Record<string, unknown>
  images: VerifiedImage[]
  review_notes?: string[]
}

const BATCH = 10

/**
 * Imports records that passed sgnova/catalog/real/validate_records.py as
 * DRAFT products. Drafts are invisible to the storefront, so the published
 * synthetic catalog keeps working until the real one is approved.
 *
 * Idempotent: creates missing handles, updates existing ones in place, never
 * publishes and never deletes. Image URLs are made absolute with
 * SGNOVA_IMAGE_BASE_URL (the storefront origin serving /public/catalog-real).
 */
export default async function importVerifiedCatalog({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const imageBase = (process.env.SGNOVA_IMAGE_BASE_URL ?? "").replace(/\/$/, "")
  const imageUrl = (path: string) => (imageBase ? `${imageBase}${path}` : path)

  const dir = resolve(process.cwd(), "../../sgnova/catalog/real/verified")
  const records: VerifiedProduct[] = readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => JSON.parse(readFileSync(resolve(dir, f), "utf8")))
  if (!records.length) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "No verified records to import")
  }

  const [{ data: categories }, { data: channels }, { data: profiles }] = await Promise.all([
    query.graph({ entity: "product_category", fields: ["id", "handle"] }),
    query.graph({ entity: "sales_channel", fields: ["id"] }),
    query.graph({ entity: "shipping_profile", fields: ["id", "type"] }),
  ])
  const categoryId = new Map(categories.map((c) => [c.handle, c.id]))
  const profile = profiles.find((p) => p.type === "default") ?? profiles[0]

  // Brand tags, shared with the brand facet.
  const brands = [...new Set(records.map((r) => r.brand))]
  const { data: tags } = await query.graph({ entity: "product_tag", fields: ["id", "value"] })
  const missingBrands = brands.filter((b) => !tags.some((t) => t.value === b))
  if (missingBrands.length) {
    await createProductTagsWorkflow(container).run({
      input: { product_tags: missingBrands.map((value) => ({ value })) },
    })
  }
  const { data: allTags } = await query.graph({ entity: "product_tag", fields: ["id", "value"] })
  const tagId = new Map(allTags.map((t) => [t.value, t.id]))

  const toFields = (r: VerifiedProduct) => {
    const category = categoryId.get(r.category_handle)
    if (!category) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, `Category ${r.category_handle} missing`)
    }
    return {
      title: r.title,
      subtitle: r.subtitle,
      description: r.description,
      thumbnail: imageUrl(r.images[0].card_path ?? r.images[0].local_path),
      images: r.images.map((i) => ({ url: imageUrl(i.local_path) })),
      category_ids: [category],
      tag_ids: [tagId.get(r.brand)!].filter(Boolean),
      metadata: {
        brand: r.brand,
        model: r.model,
        mpn: r.mpn ?? null,
        highlights: r.highlights,
        specs: groupSpecs(r),
        data_source: "verified-real",
        image_type: "licensed-photo",
        image_credits: r.images.map((i) => ({
          title: i.title,
          author: i.artist || "Wikimedia Commons contributor",
          license: i.license,
          license_url: i.license_url,
          source: i.page_url,
        })),
        provenance: r.provenance,
        price_status: r.price ? "sourced" : "pending_merchant_input",
        review_status: r.review_notes?.length ? "needs_manual_review" : "auto_verified",
        review_notes: r.review_notes ?? [],
      },
    }
  }

  const { data: existing } = await query.graph({
    entity: "product",
    fields: ["id", "handle", "status"],
    filters: { handle: records.map((r) => r.handle) },
  })
  const existingByHandle = new Map(existing.map((p) => [p.handle, p]))
  const toCreate = records.filter((r) => !existingByHandle.has(r.handle))
  const toUpdate = records.filter((r) => existingByHandle.has(r.handle))

  for (let i = 0; i < toCreate.length; i += BATCH) {
    const batch = toCreate.slice(i, i + BATCH)
    await createProductsWorkflow(container).run({
      input: {
        products: batch.map((r) => ({
          ...toFields(r),
          handle: r.handle,
          status: ProductStatus.DRAFT,
          shipping_profile_id: profile.id,
          sales_channels: channels.map((c) => ({ id: c.id })),
          options: [{ title: "Configuration", values: [r.variant_title] }],
          variants: [
            {
              title: r.variant_title,
              sku: (r.mpn || r.handle).toUpperCase(),
              options: { Configuration: r.variant_title },
              manage_inventory: false,
              prices: r.price ? [{ amount: r.price.amount_bdt, currency_code: "bdt" }] : [],
            },
          ],
        })),
      },
    })
    logger.info(`Created drafts ${Math.min(i + BATCH, toCreate.length)}/${toCreate.length}`)
  }

  for (let i = 0; i < toUpdate.length; i += BATCH) {
    const batch = toUpdate.slice(i, i + BATCH)
    await updateProductsWorkflow(container).run({
      input: {
        products: batch.map((r) => ({ id: existingByHandle.get(r.handle)!.id, ...toFields(r) })),
      },
    })
  }

  const { data: after } = await query.graph({
    entity: "product",
    fields: ["handle", "status", "thumbnail", "variants.prices.amount"],
    filters: { handle: records.map((r) => r.handle) },
  })
  const drafts = after.filter((p) => p.status === ProductStatus.DRAFT).length
  const priced = after.filter((p) =>
    p.variants?.some((v) => ((v as { prices?: unknown[] } | null)?.prices ?? []).length)
  ).length
  logger.info(
    `VERIFIED IMPORT: records=${records.length} created=${toCreate.length} updated=${toUpdate.length} ` +
      `in_db=${after.length} drafts=${drafts} with_photo=${after.filter((p) => p.thumbnail).length} priced=${priced}`
  )
}

function groupSpecs(r: VerifiedProduct) {
  const groups = new Map<string, { label: string; value: string }[]>()
  groups.set("Overview", [
    { label: "Brand", value: r.brand },
    { label: "Model", value: r.model },
    ...(r.mpn ? [{ label: "Part number", value: r.mpn }] : []),
  ])
  for (const s of r.specs) {
    groups.set(s.group, [...(groups.get(s.group) ?? []), { label: s.label, value: s.value }])
  }
  return [...groups].map(([group, items]) => ({ group, items }))
}
