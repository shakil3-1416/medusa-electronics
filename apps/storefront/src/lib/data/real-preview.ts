import "server-only"

import { HttpTypes } from "@medusajs/types"
import { headers } from "next/headers"

/**
 * Development-only access to the unpublished real-product drafts.
 *
 * Drafts are never exposed through the Store API. This module reads them from
 * the Admin API on the server with a secret API key
 * (MEDUSA_PREVIEW_SECRET_KEY in the git-ignored .env.local, created by
 * apps/backend/src/scripts/create-preview-api-key.ts). The key never reaches
 * the browser. Every entry point first checks `isRealPreviewAllowed()`.
 */

const BACKEND_URL = process.env.MEDUSA_BACKEND_URL || process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || "http://localhost:9000"
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"])
export const PREVIEW_PAGE_SIZE = 24

const PRODUCT_CARD_FIELDS = "id,handle,title,subtitle,thumbnail,metadata,*categories"
const PRODUCT_DETAIL_FIELDS =
  "id,handle,title,subtitle,description,thumbnail,metadata,*images,*categories,*variants"

export async function isRealPreviewAllowed() {
  if (process.env.NODE_ENV !== "development") return false
  if (process.env.ENABLE_REAL_CATALOG_PREVIEW !== "1") return false
  if (!process.env.MEDUSA_PREVIEW_SECRET_KEY?.startsWith("sk_")) return false
  const h = await headers()
  const host = (h.get("x-forwarded-host") ?? h.get("host") ?? "").split(",")[0].trim()
  const hostname = host.startsWith("[") ? host.slice(0, host.indexOf("]") + 1) : host.split(":")[0]
  return LOCAL_HOSTS.has(hostname)
}

async function adminGet<T>(path: string, query: Record<string, string | string[] | number>) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    for (const v of Array.isArray(value) ? value : [value]) params.append(key, String(v))
  }
  const res = await fetch(`${BACKEND_URL}${path}?${params}`, {
    headers: { Authorization: `Basic ${process.env.MEDUSA_PREVIEW_SECRET_KEY}` },
    cache: "no-store",
  })
  if (!res.ok) {
    throw new Error(`Admin API ${path} failed with ${res.status}`)
  }
  return (await res.json()) as T
}

type ProductList = { products: HttpTypes.AdminProduct[]; count: number }

export async function listRealProducts({
  categoryId,
  q,
  page,
}: {
  categoryId?: string
  q?: string
  page: number
}) {
  const { products, count } = await adminGet<ProductList>("/admin/products", {
    "status[]": "draft",
    fields: PRODUCT_CARD_FIELDS,
    limit: PREVIEW_PAGE_SIZE,
    offset: (page - 1) * PREVIEW_PAGE_SIZE,
    order: "title",
    ...(categoryId ? { "category_id[]": categoryId } : {}),
    ...(q ? { q } : {}),
  })
  return { products: products.filter((p) => p.handle?.startsWith("real-")), count }
}

export async function getRealProduct(handle: string) {
  const { products } = await adminGet<ProductList>("/admin/products", {
    "status[]": "draft",
    handle,
    fields: PRODUCT_DETAIL_FIELDS,
    limit: 1,
  })
  const product = products[0]
  return product?.handle?.startsWith("real-") ? product : null
}

export type RealCategory = { id: string; handle: string; name: string; count: number }

/** Categories that contain real-product drafts, with counts. */
export async function listRealCategories(): Promise<RealCategory[]> {
  const { products } = await adminGet<ProductList>("/admin/products", {
    "status[]": "draft",
    fields: "id,handle,categories.id,categories.handle,categories.name",
    limit: 1000,
  })
  const byId = new Map<string, RealCategory>()
  for (const p of products) {
    if (!p.handle?.startsWith("real-")) continue
    for (const c of p.categories ?? []) {
      if (!c) continue
      const row = byId.get(c.id) ?? { id: c.id, handle: c.handle, name: c.name, count: 0 }
      row.count += 1
      byId.set(c.id, row)
    }
  }
  return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name))
}
