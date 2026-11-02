import type { ExecArgs } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  MedusaError,
  Modules,
} from "@medusajs/framework/utils"
import {
  createShippingOptionsWorkflow,
  createStockLocationsWorkflow,
  createTaxRegionsWorkflow,
  deleteProductsWorkflow,
  deleteRegionsWorkflow,
  linkSalesChannelsToStockLocationWorkflow,
  updateProductCategoriesWorkflow,
  updateRegionsWorkflow,
  updateStoresWorkflow,
} from "@medusajs/medusa/core-flows"

/**
 * Idempotent Bangladesh-only commerce setup. Safe to rerun.
 *
 * - Store name "Medusa", BDT as default currency, Bangladesh as default region
 * - Dhaka warehouse, Bangladesh service zone and BDT shipping options
 * - Bangladesh tax region and BDT store policies
 * - Soft-deletes the four starter apparel products (SGNOVA_KEEP_STARTER=1 skips)
 * - Deactivates the empty starter apparel categories (is_active=false)
 * - Soft-deletes the Europe region only with SGNOVA_REMOVE_EUROPE=1
 */
const STARTER_HANDLES = ["t-shirt", "sweatshirt", "sweatpants", "shorts"]
const STARTER_CATEGORY_HANDLES = ["shirts", "sweatshirts", "pants", "merch"]
const LOCATION_NAME = "Dhaka Warehouse"
const FULFILLMENT_SET_NAME = "Dhaka Warehouse delivery"

const BD_POLICIES = {
  return_window_days: 7,
  free_returns: false,
  shipping_rate: 80,
  handling_days_min: 0,
  handling_days_max: 1,
  transit_days_min: 1,
  transit_days_max: 3,
}

export default async function setupBangladesh({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const link = container.resolve(ContainerRegistrationKeys.LINK)
  const fulfillment = container.resolve(Modules.FULFILLMENT)

  const { data: regions } = await query.graph({
    entity: "region",
    fields: ["id", "name", "currency_code", "metadata", "countries.iso_2"],
  })
  const bd = regions.find((r) =>
    r.countries?.some((c) => c?.iso_2?.toLowerCase() === "bd")
  )
  if (!bd || bd.currency_code !== "bdt") {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      "Bangladesh BDT region is missing"
    )
  }

  // Store: BDT default currency, Bangladesh default region.
  const { data: stores } = await query.graph({
    entity: "store",
    fields: [
      "id",
      "name",
      "default_region_id",
      "supported_currencies.currency_code",
      "supported_currencies.is_default",
    ],
  })
  const store = stores[0]
  const currencies = (store.supported_currencies ?? [])
    .map((c) => c?.currency_code)
    .filter((c): c is string => Boolean(c))
  const bdtDefault = store.supported_currencies?.some(
    (c) => c?.currency_code === "bdt" && c?.is_default
  )
  if (!bdtDefault || store.default_region_id !== bd.id || store.name !== "Medusa") {
    await updateStoresWorkflow(container).run({
      input: {
        selector: { id: store.id },
        update: {
          name: "Medusa",
          default_region_id: bd.id,
          supported_currencies: [...new Set(["bdt", ...currencies])].map(
            (code) => ({ currency_code: code, is_default: code === "bdt" })
          ),
        },
      },
    })
    logger.info("Store set to Medusa / BDT default / Bangladesh default region")
  }

  // Region store policies in BDT (shipping pages and structured data read these).
  const metadata = (bd.metadata ?? {}) as Record<string, unknown>
  if (metadata.shipping_rate !== BD_POLICIES.shipping_rate) {
    await updateRegionsWorkflow(container).run({
      input: {
        selector: { id: bd.id },
        update: { metadata: { ...metadata, ...BD_POLICIES } },
      },
    })
    logger.info("Bangladesh store policies updated")
  }

  // Tax region (no default rate: listed BDT prices are final prices).
  const { data: taxRegions } = await query.graph({
    entity: "tax_region",
    fields: ["id", "country_code"],
    filters: { country_code: "bd" },
  })
  if (!taxRegions.length) {
    await createTaxRegionsWorkflow(container).run({
      input: [{ country_code: "bd", provider_id: "tp_system" }],
    })
    logger.info("Created Bangladesh tax region")
  }

  // Dhaka stock location.
  const { data: locations } = await query.graph({
    entity: "stock_location",
    fields: ["id", "name", "fulfillment_sets.id", "fulfillment_sets.name"],
  })
  let locationId = locations.find((l) => l.name === LOCATION_NAME)?.id
  if (!locationId) {
    const { result } = await createStockLocationsWorkflow(container).run({
      input: {
        locations: [
          {
            name: LOCATION_NAME,
            address: {
              address_1: "Test fixture address",
              city: "Dhaka",
              country_code: "BD",
            },
          },
        ],
      },
    })
    await link.create({
      [Modules.STOCK_LOCATION]: { stock_location_id: result[0].id },
      [Modules.FULFILLMENT]: { fulfillment_provider_id: "manual_manual" },
    })
    locationId = result[0].id
    logger.info("Created Dhaka Warehouse")
  }

  const { data: channels } = await query.graph({
    entity: "sales_channel",
    fields: ["id", "stock_locations.id"],
  })
  for (const channel of channels) {
    if (!channel.stock_locations?.some((l) => l?.id === locationId!)) {
      await linkSalesChannelsToStockLocationWorkflow(container).run({
        input: { id: locationId!, add: [channel.id] },
      })
    }
  }

  // Fulfillment set + Bangladesh service zone.
  let fulfillmentSet = (
    await fulfillment.listFulfillmentSets(
      { name: FULFILLMENT_SET_NAME },
      { relations: ["service_zones"] }
    )
  )[0]
  if (!fulfillmentSet) {
    fulfillmentSet = await fulfillment.createFulfillmentSets({
      name: FULFILLMENT_SET_NAME,
      type: "shipping",
      service_zones: [
        {
          name: "Bangladesh",
          geo_zones: [{ country_code: "bd", type: "country" }],
        },
      ],
    })
    await link.create({
      [Modules.STOCK_LOCATION]: { stock_location_id: locationId! },
      [Modules.FULFILLMENT]: { fulfillment_set_id: fulfillmentSet.id },
    })
    logger.info("Created Bangladesh service zone")
  }
  const zoneId = fulfillmentSet.service_zones[0].id

  // BDT shipping options.
  const { data: profiles } = await query.graph({
    entity: "shipping_profile",
    fields: ["id", "type"],
  })
  const profile = profiles.find((p) => p.type === "default") ?? profiles[0]
  const existingOptions = await fulfillment.listShippingOptions({
    service_zone: { id: zoneId },
  })
  const wanted = [
    {
      name: "Inside Dhaka Delivery",
      code: "inside-dhaka",
      description: "Delivered within Dhaka city in 1-2 days.",
      amount: 80,
    },
    {
      name: "Outside Dhaka Delivery",
      code: "outside-dhaka",
      description: "Delivered anywhere in Bangladesh in 2-4 days.",
      amount: 150,
    },
    {
      name: "Express Delivery (Dhaka)",
      code: "express-dhaka",
      description: "Same or next day delivery inside Dhaka.",
      amount: 250,
    },
  ].filter((o) => !existingOptions.some((e) => e.name === o.name))

  if (wanted.length) {
    await createShippingOptionsWorkflow(container).run({
      input: wanted.map((o) => ({
        name: o.name,
        price_type: "flat" as const,
        provider_id: "manual_manual",
        service_zone_id: zoneId,
        shipping_profile_id: profile.id,
        type: { label: o.name, description: o.description, code: o.code },
        prices: [
          { currency_code: "bdt", amount: o.amount },
          { region_id: bd.id, amount: o.amount },
        ],
        rules: [
          { attribute: "enabled_in_store", value: "true", operator: "eq" as const },
          { attribute: "is_return", value: "false", operator: "eq" as const },
        ],
      })),
    })
    logger.info(`Created ${wanted.length} BDT shipping options`)
  }

  // Starter apparel products (soft delete through the core workflow).
  if (process.env.SGNOVA_KEEP_STARTER !== "1") {
    const { data: starters } = await query.graph({
      entity: "product",
      fields: ["id", "handle"],
      filters: { handle: STARTER_HANDLES },
    })
    if (starters.length) {
      await deleteProductsWorkflow(container).run({
        input: { ids: starters.map((p) => p.id) },
      })
      logger.info(`Removed starter products: ${starters.map((p) => p.handle).join(", ")}`)
    }
  }

  // Starter apparel categories: hide (reversible) once they hold no products.
  const { data: starterCategories } = await query.graph({
    entity: "product_category",
    fields: ["id", "handle", "is_active", "products.id"],
    filters: { handle: STARTER_CATEGORY_HANDLES },
  })
  const hide = starterCategories.filter(
    (c) => c.is_active && !(c.products ?? []).length
  )
  if (hide.length) {
    await updateProductCategoriesWorkflow(container).run({
      input: { selector: { id: hide.map((c) => c.id) }, update: { is_active: false } },
    })
    logger.info(`Deactivated empty starter categories: ${hide.map((c) => c.handle).join(", ")}`)
  }

  // Europe region: opt-in only.
  if (process.env.SGNOVA_REMOVE_EUROPE === "1") {
    const europe = regions.filter((r) => r.id !== bd.id)
    if (europe.length) {
      await deleteRegionsWorkflow(container).run({
        input: { ids: europe.map((r) => r.id) },
      })
      logger.info(`Removed regions: ${europe.map((r) => r.name).join(", ")}`)
    }
  }

  logger.info("Bangladesh setup complete")
}
