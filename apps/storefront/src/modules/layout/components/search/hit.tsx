"use client"

import Image from "next/image"
import type { Hit as HitType } from "instantsearch.js"

import LocalizedClientLink from "@modules/common/components/localized-client-link"
import PlaceholderImage from "@modules/common/icons/placeholder-image"
import { Text } from "@modules/common/components/ui"
import { SEARCH_PRICE_CURRENCIES } from "@lib/search-client"
import HitPrice, { HitPricing } from "@modules/store/components/store-hits/price"

export type ProductHit = HitType<{
  title: string | null
  handle: string | null
  thumbnail: string | null
} & HitPricing>

type SearchHitProps = {
  hit: ProductHit
  onNavigate?: () => void
}

const SearchHit = ({ hit, onNavigate }: SearchHitProps) => {
  if (!hit.handle) {
    return null
  }

  return (
    <li>
      <LocalizedClientLink
        href={`/products/${hit.handle}`}
        onClick={onNavigate}
        className="flex items-center gap-x-4 px-4 py-3 hover:bg-ui-bg-base-hover"
        data-testid="search-hit-link"
      >
        <div className="relative h-16 w-14 shrink-0 overflow-hidden rounded-rounded bg-ui-bg-subtle">
          {hit.thumbnail ? (
            <Image
              src={hit.thumbnail}
              alt=""
              fill
              sizes="56px"
              className="object-contain object-center"
              draggable={false}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-ui-fg-muted">
              <PlaceholderImage size={20} />
            </div>
          )}
        </div>
        <div className="flex flex-col gap-y-1">
          <Text className="txt-medium text-ui-fg-base line-clamp-2">
            {hit.title}
          </Text>
          <HitPrice hit={hit} currencyCode={SEARCH_PRICE_CURRENCIES[0]} />
        </div>
      </LocalizedClientLink>
    </li>
  )
}

export default SearchHit
