import type { ExecArgs } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  Modules,
  ProductStatus,
} from "@medusajs/framework/utils"
import {
  createProductCategoriesWorkflow,
  createProductsWorkflow,
  createRegionsWorkflow,
  updateStoresWorkflow,
} from "@medusajs/medusa/core-flows"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

type CatalogProduct = {
  sku: string
  handle: string
  title: string
  category: string
  category_handle: string
  price_bdt: number
  stock: number
  description: string
  specifications: Record<string, unknown>
}

export default async function seedSGNova({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const limit = process.env.SGNOVA_LIMIT === "5" ? 5 : 600
  const dataPath = resolve(process.cwd(), "../../sgnova/catalog/products.json")
  const products: CatalogProduct[] = JSON.parse(readFileSync(dataPath, "utf8"))

  if (products.length !== 600) {
    throw new Error(`Expected 600 product fixtures, found ${products.length}`)
  }

  const handles = products.map(p => p.handle)
  if (new Set(handles).size !== 600) {
    throw new Error("Duplicate product handles")
  }

  const { data: stores } = await query.graph({
    entity: "store",
    fields: ["id", "name", "supported_currencies.currency_code", "supported_currencies.is_default"],
  })

  const store = stores[0]
  if (!store) throw new Error("Medusa store is missing")

  const existingCurrencies = (store.supported_currencies ?? [])
    .map(c => ({
      currency_code: c?.currency_code,
      is_default: Boolean(c?.is_default),
    }))
    .filter(c => Boolean(c.currency_code))

  if (!existingCurrencies.some(c => c.currency_code === "bdt")) {
    await updateStoresWorkflow(container).run({
      input: {
        selector: { id: store.id },
        update: {
          name: "SGNova",
          supported_currencies: [
            ...existingCurrencies,
            { currency_code: "bdt", is_default: false },
          ],
        },
      } as never,
    })
    logger.info("Added BDT supported currency")
  } else {
    logger.info("BDT currency already configured")
  }

  const { data: existingRegions } = await query.graph({
    entity: "region",
    fields: ["id", "name", "currency_code", "countries.iso_2"],
  })

  const bangladesh = existingRegions.find(
    r => r.countries?.some(c => c?.iso_2?.toLowerCase() === "bd")
  )

  if (!bangladesh) {
    await createRegionsWorkflow(container).run({
      input: {
        regions: [{
          name: "Bangladesh",
          currency_code: "bdt",
          countries: ["bd"],
          payment_providers: ["pp_system_default"],
        }],
      },
    })
    logger.info("Created Bangladesh region")
  } else if (bangladesh.currency_code !== "bdt") {
    throw new Error("Bangladesh exists but is not configured for BDT")
  } else {
    logger.info("Bangladesh region already exists")
  }

  const categoryNames = [...new Map(
    products.map(p => [p.category_handle, p.category])
  ).entries()]

  if (categoryNames.length !== 30) {
    throw new Error("Expected 30 unique categories")
  }

  const { data: initialCategories } = await query.graph({
    entity: "product_category",
    fields: ["id", "name", "handle"],
  })

  const present = new Set(initialCategories.map(c => c.handle))
  const missing = categoryNames.filter(([handle]) => !present.has(handle))

  if (missing.length) {
    await createProductCategoriesWorkflow(container).run({
      input: {
        product_categories: missing.map(([handle, name]) => ({
          name,
          handle,
          is_active: true,
          is_internal: false,
        })),
      },
    })
    logger.info(`Created ${missing.length} electronics categories`)
  }

  const { data: categories } = await query.graph({
    entity: "product_category",
    fields: ["id", "handle"],
  })

  const categoryMap = new Map(categories.map(c => [c.handle, c.id]))

  const { data: channels } = await query.graph({
    entity: "sales_channel",
    fields: ["id", "name"],
  })
  const { data: profiles } = await query.graph({
    entity: "shipping_profile",
    fields: ["id"],
  })

  if (!channels[0] || !profiles[0]) {
    throw new Error("Missing sales channel or shipping profile")
  }

  const { data: already } = await query.graph({
    entity: "product",
    fields: ["id", "handle"],
  })
  const existingHandles = new Set(already.map(p => p.handle))
  const queue = products.slice(0, limit).filter(p => !existingHandles.has(p.handle))

  logger.info(`SGNova target=${limit}, new=${queue.length}, existing=${limit - queue.length}`)

  let imported = 0
  for (let offset = 0; offset < queue.length; offset += 10) {
    const batch = queue.slice(offset, offset + 10)

    await createProductsWorkflow(container).run({
      input: {
        products: batch.map(p => {
          const categoryId = categoryMap.get(p.category_handle)
          if (!categoryId) throw new Error(`Category missing: ${p.category_handle}`)

          return {
            title: p.title,
            handle: p.handle,
            subtitle: `${p.category} | SGNova test catalog`,
            description: p.description,
            status: ProductStatus.PUBLISHED,
            shipping_profile_id: profiles[0].id,
            sales_channels: [{ id: channels[0].id }],
            category_ids: [categoryId],
            metadata: {
              ...p.specifications,
              synthetic_catalog: true,
              declared_stock: p.stock,
            },
            options: [{
              title: "Configuration",
              values: ["Standard"],
            }],
            variants: [{
              title: "Standard",
              sku: p.sku,
              options: { Configuration: "Standard" },
              prices: [{
                amount: p.price_bdt,
                currency_code: "bdt",
              }],
              manage_inventory: false,
            }],
          }
        }) as never,
      },
    })

    imported += batch.length
    logger.info(`SGNova imported ${imported}/${queue.length}`)
  }

  const { data: allProducts } = await query.graph({
    entity: "product",
    fields: ["id", "handle"],
  })

  const targetHandles = new Set(products.slice(0, limit).map(p => p.handle))
  const targetProducts = allProducts.filter(p => targetHandles.has(p.handle))

  if (targetProducts.length !== limit) {
    throw new Error(
      `Verification failed: expected ${limit}, found ${targetProducts.length}`
    )
  }

  const search = container.resolve(Modules.SEARCH)

  for (let i = 0; i < targetProducts.length; i += 25) {
    const chunk = targetProducts.slice(i, i + 25)
    await search.ingest({
      name: "product.created",
      data: chunk.map(p => ({ id: p.id })),
    } as never)
  }

  logger.info(
    `SGNOVA SUCCESS: ${targetProducts.length}/${limit} products verified and indexed`
  )
}
