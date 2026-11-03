import Image from "next/image"
import { ReactNode } from "react"

import LocalizedClientLink from "@modules/common/components/localized-client-link"
import PlaceholderImage from "@modules/common/icons/placeholder-image"

type ProductCardProps = {
  handle: string
  title: string | null
  thumbnail?: string | null
  brand?: string | null
  subtitle?: string | null
  price: ReactNode
  /** Overrides the default /products/<handle> link (e.g. the draft preview). */
  href?: string
}

/**
 * Retail product card shared by server-rendered rails/category grids and the
 * client-side search listing. Server/client neutral: no hooks.
 */
const ProductCard = ({
  handle,
  title,
  thumbnail,
  brand,
  subtitle,
  price,
  href,
}: ProductCardProps) => {
  return (
    <LocalizedClientLink
      href={href ?? `/products/${handle}`}
      className="group flex h-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white transition hover:border-blue-400 hover:shadow-lg"
    >
      <div data-testid="product-wrapper" className="flex h-full flex-col">
        <div className="relative aspect-square w-full bg-slate-50">
          {thumbnail ? (
            <Image
              src={thumbnail}
              alt={title ?? ""}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              className="object-contain p-3 transition-transform duration-200 group-hover:scale-[1.03]"
              draggable={false}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-slate-400">
              <PlaceholderImage size={24} />
            </div>
          )}
        </div>
        <div className="flex flex-1 flex-col gap-y-1 p-3 small:p-4">
          {brand && (
            <span className="text-[11px] font-semibold uppercase tracking-wide text-blue-700">
              {brand}
            </span>
          )}
          <h3
            className="line-clamp-2 text-sm font-semibold leading-snug text-slate-900 group-hover:text-blue-700"
            data-testid="product-title"
          >
            {title}
          </h3>
          {subtitle && (
            <p className="line-clamp-2 text-xs text-slate-500">{subtitle}</p>
          )}
          <div className="mt-auto pt-2 text-base font-bold text-slate-900">
            {price}
          </div>
        </div>
      </div>
    </LocalizedClientLink>
  )
}

export default ProductCard
