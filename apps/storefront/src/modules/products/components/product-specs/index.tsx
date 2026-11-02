import { getProductSpecs } from "@lib/catalog/departments"
import { HttpTypes } from "@medusajs/types"

/** Grouped specification table built from `metadata.specs`. */
const ProductSpecs = ({ product }: { product: HttpTypes.StoreProduct }) => {
  const groups = getProductSpecs(product.metadata)

  if (!groups.length) {
    return null
  }

  return (
    <section
      id="specification"
      className="rounded-2xl border border-slate-200 bg-white"
      data-testid="product-specs"
    >
      <h2 className="border-b border-slate-200 px-5 py-4 text-lg font-bold text-slate-900">
        Specification
      </h2>
      <table className="w-full text-sm">
        {groups.map((group) => (
          <tbody key={group.group}>
            <tr>
              <th
                colSpan={2}
                scope="colgroup"
                className="bg-blue-50 px-5 py-2 text-left text-xs font-bold uppercase tracking-wide text-blue-800"
              >
                {group.group}
              </th>
            </tr>
            {group.items.map((item) => (
              <tr
                key={`${group.group}-${item.label}`}
                className="border-b border-slate-100 last:border-0"
              >
                <th
                  scope="row"
                  className="w-2/5 px-5 py-2.5 text-left align-top font-medium text-slate-500"
                >
                  {item.label}
                </th>
                <td className="px-5 py-2.5 text-slate-900">{item.value}</td>
              </tr>
            ))}
          </tbody>
        ))}
      </table>
      {product.metadata?.data_source === "synthetic-test-fixture" && (
        <p className="border-t border-slate-200 px-5 py-3 text-xs text-slate-500">
          Specifications are illustrative test-catalog data for a fictional
          brand and are not manufacturer claims.
        </p>
      )}
    </section>
  )
}

export default ProductSpecs
