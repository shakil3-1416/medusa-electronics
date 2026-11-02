"use server"

import { sdk } from "@lib/config"
import { HttpTypes } from "@medusajs/types"
import { getCacheOptions } from "./cookies"

// Countries the storefront serves (Bangladesh by default). Regions for other
// countries may exist in Medusa but are hidden from shoppers.
const STORE_COUNTRIES = (
  process.env.NEXT_PUBLIC_STORE_COUNTRIES ||
  process.env.NEXT_PUBLIC_DEFAULT_REGION ||
  "bd"
)
  .split(",")
  .map((code) => code.trim().toLowerCase())
  .filter(Boolean)

const servedRegions = (regions: HttpTypes.StoreRegion[]) =>
  regions
    .map((region) => ({
      ...region,
      countries: region.countries?.filter((country) =>
        STORE_COUNTRIES.includes(country.iso_2?.toLowerCase() ?? "")
      ),
    }))
    .filter((region) => region.countries?.length)

export const listRegions = async () => {
  const next = {
    ...(await getCacheOptions("regions")),
  }

  return await sdk.client
    .fetch<{ regions: HttpTypes.StoreRegion[] }>(`/store/regions`, {
      method: "GET",
      next,
      cache: "force-cache",
    })
    .then(({ regions }) => servedRegions(regions))
}

export const retrieveRegion = async (id: string) => {
  const next = {
    ...(await getCacheOptions(["regions", id].join("-"))),
  }

  return await sdk.client
    .fetch<{ region: HttpTypes.StoreRegion }>(`/store/regions/${id}`, {
      method: "GET",
      next,
      cache: "force-cache",
    })
    .then(({ region }) => region)
}

export const getRegion = async (countryCode: string) => {
  const regions = await sdk.client.fetch<{
    regions: HttpTypes.StoreRegion[]
  }>("/store/regions", {
    method: "GET",
    cache: "no-store",
  }).then(({ regions }) => servedRegions(regions))

  const code = countryCode?.toLowerCase() || STORE_COUNTRIES[0]

  return regions.find((region) =>
    region.countries?.some(
      (country) => country.iso_2?.toLowerCase() === code
    )
  ) ?? null
}
