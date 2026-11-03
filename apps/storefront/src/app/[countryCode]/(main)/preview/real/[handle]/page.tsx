import { HttpTypes } from "@medusajs/types"
import { Metadata } from "next"
import { notFound } from "next/navigation"

import { getRealProduct, isRealPreviewAllowed } from "@lib/data/real-preview"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import VariantImageGallery from "@modules/products/components/image-gallery/variant-image-gallery"
import ProductSpecs from "@modules/products/components/product-specs"
import ProductInfo from "@modules/products/templates/product-info"
import PreviewBanner from "@modules/real-preview/preview-banner"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Real product preview (development) | Medusa",
  robots: { index: false, follow: false },
}

type Props = { params: Promise<{ countryCode: string; handle: string }> }

export default async function RealProductPreviewPage(props: Props) {
  if (!(await isRealPreviewAllowed())) notFound()
  const { handle } = await props.params
  const admin = await getRealProduct(handle)
  if (!admin) notFound()

  // The shared storefront components read the same fields from Store and Admin products.
  const product = admin as unknown as HttpTypes.StoreProduct
  const category = admin.categories?.[0]
  const reviewNotes = Array.isArray(admin.metadata?.review_notes)
    ? (admin.metadata!.review_notes as string[])
    : []

  return (
    <div className="bg-slate-50">
      <PreviewBanner />
      <div className="content-container py-6" data-testid="preview-product">
        <nav aria-label="Breadcrumb" className="mb-4 flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
          <LocalizedClientLink href="/preview/real" className="hover:text-blue-700">
            Real catalog
          </LocalizedClientLink>
          {category && (
            <>
              <span>/</span>
              <LocalizedClientLink href={`/preview/real?category=${category.handle}`} className="hover:text-blue-700">
                {category.name}
              </LocalizedClientLink>
            </>
          )}
          <span>/</span>
          <span className="line-clamp-1 text-slate-700">{admin.title}</span>
        </nav>

        <div className="grid gap-6 small:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] small:gap-10">
          <div className="small:sticky small:top-32 small:self-start">
            <VariantImageGallery product={product} />
          </div>
          <div className="flex flex-col gap-y-6 rounded-2xl border border-slate-200 bg-white p-5 small:p-8">
            <ProductInfo product={product} />
            <div>
              <p className="text-2xl font-bold text-amber-700" data-testid="price-pending">
                Price pending
              </p>
              <p className="mt-1 text-xs text-slate-500">
                No sourced BDT price yet. This product is an unpublished draft.
              </p>
            </div>
            <button
              type="button"
              disabled
              aria-disabled="true"
              className="h-11 w-full cursor-not-allowed rounded-lg bg-slate-300 text-sm font-semibold text-slate-600"
              data-testid="add-to-cart-disabled"
            >
              Add to cart unavailable (price pending)
            </button>
            {reviewNotes.length > 0 && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
                <p className="font-semibold">Needs manual review before publishing</p>
                <ul className="mt-1 list-disc pl-4">
                  {reviewNotes.map((n) => (
                    <li key={n}>{n}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        <div className="mt-8 grid gap-6 small:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <ProductSpecs product={product} />
          {admin.description && (
            <section className="rounded-2xl border border-slate-200 bg-white p-5">
              <h2 className="mb-2 text-lg font-bold text-slate-900">Description</h2>
              <p className="whitespace-pre-line text-sm leading-6 text-slate-700">{admin.description}</p>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}
