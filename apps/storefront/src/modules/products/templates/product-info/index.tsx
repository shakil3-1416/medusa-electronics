import { getProductHighlights } from "@lib/catalog/departments"
import { HttpTypes } from "@medusajs/types"
import { Heading } from "@modules/common/components/ui"

type ProductInfoProps = {
  product: HttpTypes.StoreProduct
}

const ProductInfo = ({ product }: ProductInfoProps) => {
  const highlights = getProductHighlights(product.metadata)
  const brand =
    typeof product.metadata?.brand === "string" ? product.metadata.brand : null
  const model =
    typeof product.metadata?.model === "string" ? product.metadata.model : null
  const sku = product.variants?.[0]?.sku

  return (
    <div id="product-info" className="flex flex-col gap-y-4">
      {brand && (
        <span className="text-xs font-bold uppercase tracking-wider text-blue-700">
          {brand}
        </span>
      )}
      <Heading
        level="h1"
        className="text-2xl font-bold leading-tight text-slate-900 small:text-3xl"
        data-testid="product-title"
      >
        {product.title}
      </Heading>
      <dl className="flex flex-wrap gap-2 text-xs">
        {model && (
          <div className="rounded-full bg-slate-100 px-3 py-1">
            <dt className="inline text-slate-500">Model: </dt>
            <dd className="inline font-semibold text-slate-800">{model}</dd>
          </div>
        )}
        {sku && (
          <div className="rounded-full bg-slate-100 px-3 py-1">
            <dt className="inline text-slate-500">SKU: </dt>
            <dd className="inline font-semibold text-slate-800">{sku}</dd>
          </div>
        )}
      </dl>
      {highlights.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-bold text-slate-900">
            Key features
          </h2>
          <ul
            className="list-disc space-y-1 pl-5 text-sm text-slate-700"
            data-testid="product-highlights"
          >
            {highlights.map((highlight) => (
              <li key={highlight}>{highlight}</li>
            ))}
          </ul>
          <a
            href="#specification"
            className="mt-2 inline-block text-sm font-semibold text-blue-700 hover:underline"
          >
            View full specification
          </a>
        </div>
      )}
    </div>
  )
}

export default ProductInfo
