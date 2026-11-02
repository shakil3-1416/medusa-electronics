import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

export default async function audit({ container }: ExecArgs) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const [products, categories, regions] = await Promise.all([
    query.graph({
      entity: "product",
      fields: ["id", "handle", "title", "thumbnail", "variants.id"],
    }),
    query.graph({
      entity: "product_category",
      fields: ["id", "name", "handle"],
    }),
    query.graph({
      entity: "region",
      fields: ["id", "name", "currency_code", "countries.iso_2"],
    }),
  ])

  const electronics = products.data.filter(p =>
    p.handle?.startsWith("sgnova-")
  )

  const bangladesh = regions.data.find(r =>
    r.countries?.some(c => c?.iso_2?.toLowerCase() === "bd")
  )

  const withImages = electronics.filter(p => Boolean(p.thumbnail))
  const withVariants = electronics.filter(p => (p.variants?.length ?? 0) > 0)
  const electronicsCategories = categories.data.filter(c =>
    [
      "processor", "motherboard", "graphics-card",
      "gaming-laptop", "smartphone", "desktop-pc",
      "headphone", "router"
    ].some(x => c.handle === x)
  )

  console.log("=== ELECTRONICS AUDIT ===")
  console.log("SGNova fixture products:", electronics.length)
  console.log("Total database products:", products.data.length)
  console.log("Total categories:", categories.data.length)
  console.log("Products with thumbnail:", withImages.length)
  console.log("Products with variants:", withVariants.length)
  console.log("Sample electronics categories found:", electronicsCategories.length)
  console.log("Bangladesh region:", bangladesh?.name ?? "MISSING")
  console.log("Bangladesh currency:", bangladesh?.currency_code ?? "MISSING")

  console.log("=== SAMPLE PRODUCTS ===")
  for (const p of electronics.slice(0, 5)) {
    console.log(p.handle, "|", p.title)
  }
}
