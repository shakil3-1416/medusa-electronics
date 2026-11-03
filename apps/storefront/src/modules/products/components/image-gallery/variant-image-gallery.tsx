"use client"

import { HttpTypes } from "@medusajs/types"
import { useSearchParams } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import ImageGallery from "."
import { getImageCredits } from "@lib/catalog/departments"

const getImagesForVariant = (
  product: HttpTypes.StoreProduct,
  selectedVariantId?: string,
) => {
  if (!selectedVariantId || !product.variants) {
    return product.images
  }

  const variant = product.variants!.find((v) => v.id === selectedVariantId)
  if (!variant || !variant.images?.length) {
    return product.images
  }

  const imageIdsMap = new Map(variant.images!.map((i) => [i.id, true]))
  return product.images?.filter((i) => imageIdsMap.has(i.id)) ?? null
}

/**
 * Shows the images of the variant selected with `?v_id=`. Product pages are
 * statically rendered, so the filter is only applied after hydration.
 */
const VariantImageGallery = ({
  product,
}: {
  product: HttpTypes.StoreProduct
}) => {
  const searchParams = useSearchParams()
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => setIsMounted(true), [])

  const variantId = isMounted ? searchParams.get("v_id") ?? undefined : undefined
  const images = useMemo(
    () => getImagesForVariant(product, variantId) ?? [],
    [product, variantId]
  )

  const credits = getImageCredits(product.metadata).filter(
    (c, i, all) =>
      all.findIndex((o) => o.source === c.source && o.author === c.author && o.license === c.license) === i
  )
  const caption =
    product.metadata?.image_type === "representative-illustration" ? (
      "Representative illustration. Actual product appearance may differ."
    ) : credits.length ? (
      <ul className="flex flex-col gap-y-1" data-testid="image-credits">
        {credits.map((credit) =>
          credit.license.startsWith("Open Icecat") ? (
            <li key={credit.source}>
              Photo: {credit.author.replace(/ via Open Icecat$/, "")}, via{" "}
              <a href={credit.source} target="_blank" rel="noreferrer" className="underline">
                Open Icecat
              </a>{" "}
              (
              <a href={credit.license_url} target="_blank" rel="noreferrer" className="underline">
                Open Content License
              </a>
              )
            </li>
          ) : (
            <li key={credit.source}>
              Photo: {credit.author},{" "}
              <a
                href={credit.license_url || credit.source}
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                {credit.license}
              </a>
              , via{" "}
              <a href={credit.source} target="_blank" rel="noreferrer" className="underline">
                Wikimedia Commons
              </a>
            </li>
          )
        )}
      </ul>
    ) : undefined

  return <ImageGallery images={images} caption={caption} />
}

export default VariantImageGallery
