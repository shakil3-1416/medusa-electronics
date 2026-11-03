import { Metadata } from "next"
import { notFound } from "next/navigation"

import {
  PREVIEW_PAGE_SIZE,
  isRealPreviewAllowed,
  listRealCategories,
  listRealProducts,
} from "@lib/data/real-preview"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import ProductCard from "@modules/products/components/product-card"
import PreviewBanner from "@modules/real-preview/preview-banner"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Real catalog preview (development) | Medusa",
  robots: { index: false, follow: false },
}

type Props = {
  params: Promise<{ countryCode: string }>
  searchParams: Promise<{ category?: string; q?: string; page?: string }>
}

export default async function RealCatalogPreviewPage(props: Props) {
  if (!(await isRealPreviewAllowed())) notFound()

  const { category, q, page: pageParam } = await props.searchParams
  const page = Math.max(1, parseInt(pageParam || "1") || 1)
  const categories = await listRealCategories()
  const active = categories.find((c) => c.handle === category)
  const { products, count } = await listRealProducts({
    categoryId: active?.id,
    q: q?.trim() || undefined,
    page,
  })
  const total = categories.reduce((n, c) => n + c.count, 0)
  const pages = Math.max(1, Math.ceil(count / PREVIEW_PAGE_SIZE))
  const link = (next: { category?: string; page?: number; q?: string }) => {
    const sp = new URLSearchParams()
    const cat = "category" in next ? next.category : category
    const query = "q" in next ? next.q : q
    if (cat) sp.set("category", cat)
    if (query) sp.set("q", query)
    if (next.page && next.page > 1) sp.set("page", String(next.page))
    const s = sp.toString()
    return `/preview/real${s ? `?${s}` : ""}`
  }

  return (
    <div className="bg-slate-50">
      <PreviewBanner />
      <div className="content-container py-6 small:grid small:grid-cols-[240px_1fr] small:gap-8">
        <aside className="mb-6 small:mb-0" data-testid="preview-categories">
          <h2 className="mb-2 text-sm font-bold text-slate-900">Categories</h2>
          <ul className="flex flex-wrap gap-2 small:flex-col small:gap-1 text-sm">
            <li>
              <LocalizedClientLink
                href={link({ category: undefined, page: 1 })}
                className={`block rounded px-2 py-1 ${!active ? "bg-blue-700 text-white" : "text-slate-700 hover:bg-slate-200"}`}
              >
                All real products ({total})
              </LocalizedClientLink>
            </li>
            {categories.map((c) => (
              <li key={c.id}>
                <LocalizedClientLink
                  href={link({ category: c.handle, page: 1 })}
                  className={`block rounded px-2 py-1 ${active?.id === c.id ? "bg-blue-700 text-white" : "text-slate-700 hover:bg-slate-200"}`}
                >
                  {c.name} ({c.count})
                </LocalizedClientLink>
              </li>
            ))}
          </ul>
        </aside>

        <section>
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">
                {active ? active.name : "All real products"}
              </h1>
              <p className="text-sm text-slate-500" data-testid="preview-count">
                {count} unpublished products · page {page} of {pages}
              </p>
            </div>
            <form action={`/${(await props.params).countryCode}/preview/real`} className="flex gap-2">
              {category && <input type="hidden" name="category" value={category} />}
              <input
                name="q"
                defaultValue={q}
                placeholder="Search model or brand"
                className="h-10 w-56 rounded-lg border border-slate-300 px-3 text-sm"
              />
              <button className="h-10 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white">Search</button>
            </form>
          </div>

          {products.length ? (
            <ul
              className="grid grid-cols-2 gap-3 small:grid-cols-3 medium:grid-cols-4 small:gap-4"
              data-testid="preview-products"
            >
              {products.map((p) => (
                <li key={p.id}>
                  <ProductCard
                    handle={p.handle!}
                    href={`/preview/real/${p.handle}`}
                    title={p.title}
                    thumbnail={p.thumbnail}
                    brand={typeof p.metadata?.brand === "string" ? p.metadata.brand : null}
                    subtitle={p.categories?.[0]?.name}
                    price={<span className="text-sm font-semibold text-amber-700">Price pending</span>}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-16 text-center text-slate-500">No real products match.</p>
          )}

          {pages > 1 && (
            <nav className="mt-6 flex items-center justify-center gap-3 text-sm" aria-label="Pagination">
              {page > 1 && (
                <LocalizedClientLink href={link({ page: page - 1 })} className="rounded border bg-white px-3 py-1.5">
                  Previous
                </LocalizedClientLink>
              )}
              <span className="text-slate-500">
                Page {page} of {pages}
              </span>
              {page < pages && (
                <LocalizedClientLink href={link({ page: page + 1 })} className="rounded border bg-white px-3 py-1.5">
                  Next
                </LocalizedClientLink>
              )}
            </nav>
          )}
        </section>
      </div>
    </div>
  )
}
