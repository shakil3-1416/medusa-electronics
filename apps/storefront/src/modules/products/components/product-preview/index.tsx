import { getProductPrice } from "@lib/util/get-product-price"
import { HttpTypes } from "@medusajs/types"
import ProductCard from "../product-card"
import PreviewPrice from "./price"

export default async function ProductPreview({
  product,
  region: _region,
}: {
  product: HttpTypes.StoreProduct
  isFeatured?: boolean
  region: HttpTypes.StoreRegion
}) {
  const { cheapestPrice } = getProductPrice({
    product,
  })

  const brand =
    typeof product.metadata?.brand === "string"
      ? product.metadata.brand
      : product.tags?.[0]?.value

  return (
    <ProductCard
      handle={product.handle!}
      title={product.title}
      thumbnail={product.thumbnail || product.images?.[0]?.url}
      brand={brand}
      subtitle={product.subtitle}
      price={
        cheapestPrice ? (
          <div className="flex items-center gap-x-2">
            <PreviewPrice price={cheapestPrice} />
          </div>
        ) : null
      }
    />
  )
}
