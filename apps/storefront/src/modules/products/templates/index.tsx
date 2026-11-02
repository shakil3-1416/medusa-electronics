import React, { Suspense } from "react"

import VariantImageGallery from "@modules/products/components/image-gallery/variant-image-gallery"
import ProductActions from "@modules/products/components/product-actions"
import ProductOnboardingCta from "@modules/products/components/product-onboarding-cta"
import ProductSpecs from "@modules/products/components/product-specs"
import ProductTabs from "@modules/products/components/product-tabs"
import RelatedProducts from "@modules/products/components/related-products"
import ProductInfo from "@modules/products/templates/product-info"
import SkeletonRelatedProducts from "@modules/skeletons/templates/skeleton-related-products"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { notFound } from "next/navigation"
import { HttpTypes } from "@medusajs/types"

type ProductTemplateProps = {
  product: HttpTypes.StoreProduct
  region: HttpTypes.StoreRegion
  countryCode: string
}

const ProductTemplate: React.FC<ProductTemplateProps> = ({
  product,
  region,
  countryCode,
}) => {
  if (!product || !product.id) {
    return notFound()
  }

  const category = product.categories?.[0]

  return (
    <div className="bg-slate-50">
      <div className="content-container py-6" data-testid="product-container">
        <nav
          aria-label="Breadcrumb"
          className="mb-4 flex flex-wrap items-center gap-x-2 text-xs text-slate-500"
        >
          <LocalizedClientLink href="/" className="hover:text-blue-700">
            Home
          </LocalizedClientLink>
          <span>/</span>
          {category ? (
            <LocalizedClientLink
              href={`/categories/${category.handle}`}
              className="hover:text-blue-700"
              data-testid="breadcrumb-category"
            >
              {category.name}
            </LocalizedClientLink>
          ) : (
            <LocalizedClientLink href="/store" className="hover:text-blue-700">
              Store
            </LocalizedClientLink>
          )}
          <span>/</span>
          <span className="line-clamp-1 text-slate-700">{product.title}</span>
        </nav>

        <div className="grid gap-6 small:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] small:gap-10">
          <div className="small:sticky small:top-32 small:self-start">
            <VariantImageGallery product={product} />
          </div>
          <div className="flex flex-col gap-y-6 rounded-2xl border border-slate-200 bg-white p-5 small:p-8">
            <ProductInfo product={product} />
            <ProductOnboardingCta />
            <ProductActions product={product} region={region} />
          </div>
        </div>

        <div className="mt-8 grid gap-6 small:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <ProductSpecs product={product} />
          <div className="flex flex-col gap-6">
            {product.description && (
              <section className="rounded-2xl border border-slate-200 bg-white p-5">
                <h2 className="mb-2 text-lg font-bold text-slate-900">
                  Description
                </h2>
                <p
                  className="whitespace-pre-line text-sm leading-6 text-slate-700"
                  data-testid="product-description"
                >
                  {product.description}
                </p>
              </section>
            )}
            <div className="rounded-2xl border border-slate-200 bg-white px-5">
              <ProductTabs product={product} />
            </div>
          </div>
        </div>
      </div>
      <div
        className="content-container py-12"
        data-testid="related-products-container"
      >
        <Suspense fallback={<SkeletonRelatedProducts />}>
          <RelatedProducts product={product} countryCode={countryCode} />
        </Suspense>
      </div>
    </div>
  )
}

export default ProductTemplate
