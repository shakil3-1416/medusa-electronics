import { listCategories } from "@lib/data/categories"
import { listProducts } from "@lib/data/products"
import { HttpTypes } from "@medusajs/types"
import InteractiveLink from "@modules/common/components/interactive-link"
import ProductPreview from "@modules/products/components/product-preview"

const RAIL_HANDLES = [
  "gaming-laptop",
  "smartphone",
  "graphics-card",
  "gaming-monitor",
  "internal-ssd",
  "headphone",
]

const RAIL_SIZE = 5

async function CategoryRail({
  category,
  region,
}: {
  category: HttpTypes.StoreProductCategory
  region: HttpTypes.StoreRegion
}) {
  const {
    response: { products },
  } = await listProducts({
    regionId: region.id,
    queryParams: {
      category_id: [category.id],
      limit: RAIL_SIZE,
      order: "-created_at",
    },
  })

  if (!products?.length) {
    return null
  }

  return (
    <section className="content-container py-6 small:py-8">
      <div className="mb-4 flex items-end justify-between">
        <h2 className="text-xl font-bold text-slate-900 small:text-2xl">
          {category.name}
        </h2>
        <InteractiveLink href={`/categories/${category.handle}`}>
          View all
        </InteractiveLink>
      </div>
      <ul
        className="grid grid-cols-2 gap-3 small:grid-cols-5 small:gap-4"
        data-testid="category-rail"
      >
        {products.map((product) => (
          <li key={product.id}>
            <ProductPreview product={product} region={region} />
          </li>
        ))}
      </ul>
    </section>
  )
}

export default async function CategoryRails({
  region,
}: {
  region: HttpTypes.StoreRegion
}) {
  const categories = await listCategories({
    fields: "id,handle,name",
    handle: RAIL_HANDLES,
  })

  const ordered = RAIL_HANDLES.map((handle) =>
    categories.find((category) => category.handle === handle)
  ).filter((c): c is HttpTypes.StoreProductCategory => Boolean(c))

  return (
    <div className="bg-white py-4">
      {ordered.map((category) => (
        <CategoryRail key={category.id} category={category} region={region} />
      ))}
    </div>
  )
}
