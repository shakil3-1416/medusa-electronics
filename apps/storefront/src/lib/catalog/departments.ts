/**
 * Storefront grouping of the Medusa product categories into departments for
 * navigation. Category handles must match the categories in Medusa; a handle
 * that doesn't exist is simply not rendered by consumers that check it.
 */
export type Department = {
  name: string
  handle: string
  categories: { name: string; handle: string }[]
}

export const DEPARTMENTS: Department[] = [
  {
    name: "Laptops",
    handle: "gaming-laptop",
    categories: [
      { name: "Gaming Laptops", handle: "gaming-laptop" },
      { name: "Business Laptops", handle: "business-laptop" },
    ],
  },
  {
    name: "Desktops",
    handle: "desktop-pc",
    categories: [{ name: "Desktop PCs", handle: "desktop-pc" }],
  },
  {
    name: "Components",
    handle: "processor",
    categories: [
      { name: "Processors", handle: "processor" },
      { name: "Motherboards", handle: "motherboard" },
      { name: "Graphics Cards", handle: "graphics-card" },
      { name: "Desktop RAM", handle: "desktop-ram" },
      { name: "Laptop RAM", handle: "laptop-ram" },
      { name: "Power Supplies", handle: "power-supply" },
      { name: "Computer Cases", handle: "computer-case" },
      { name: "CPU Coolers", handle: "cpu-cooler" },
    ],
  },
  {
    name: "Storage",
    handle: "internal-ssd",
    categories: [
      { name: "Internal SSDs", handle: "internal-ssd" },
      { name: "Hard Drives", handle: "hard-drive" },
      { name: "External Storage", handle: "external-storage" },
    ],
  },
  {
    name: "Monitors",
    handle: "gaming-monitor",
    categories: [
      { name: "Gaming Monitors", handle: "gaming-monitor" },
      { name: "Office Monitors", handle: "office-monitor" },
    ],
  },
  {
    name: "Phones & Tablets",
    handle: "smartphone",
    categories: [
      { name: "Smartphones", handle: "smartphone" },
      { name: "Tablets", handle: "tablet" },
      { name: "Smartwatches", handle: "smartwatch" },
    ],
  },
  {
    name: "Peripherals",
    handle: "mechanical-keyboard",
    categories: [
      { name: "Mechanical Keyboards", handle: "mechanical-keyboard" },
      { name: "Gaming Mice", handle: "gaming-mouse" },
      { name: "Headphones", handle: "headphone" },
      { name: "Microphones", handle: "microphone" },
      { name: "Webcams", handle: "webcam" },
      { name: "Computer Accessories", handle: "computer-accessory" },
    ],
  },
  {
    name: "Networking",
    handle: "router",
    categories: [
      { name: "Routers", handle: "router" },
      { name: "Network Switches", handle: "network-switch" },
    ],
  },
  {
    name: "Office & Power",
    handle: "printer",
    categories: [
      { name: "Printers", handle: "printer" },
      { name: "Scanners", handle: "scanner" },
      { name: "UPS Systems", handle: "ups" },
    ],
  },
]

/** Representative illustration for a category, served from /public/catalog. */
export const categoryImage = (handle: string) => `/catalog/${handle}/1.svg`

export type ProductSpecGroup = {
  group: string
  items: { label: string; value: string }[]
}

/** Structured specs stored in product metadata by the catalog enrichment. */
export const getProductSpecs = (
  metadata: Record<string, unknown> | null | undefined
): ProductSpecGroup[] => {
  const specs = metadata?.specs
  if (!Array.isArray(specs)) {
    return []
  }
  return specs.filter(
    (g): g is ProductSpecGroup =>
      Boolean(g) && typeof g.group === "string" && Array.isArray(g.items)
  )
}

export const getProductHighlights = (
  metadata: Record<string, unknown> | null | undefined
): string[] => {
  const highlights = metadata?.highlights
  return Array.isArray(highlights)
    ? highlights.filter((h): h is string => typeof h === "string")
    : []
}

export type ImageCredit = {
  author: string
  license: string
  license_url: string
  source: string
}

/** Attribution for licensed photos, stored by the verified-catalog import. */
export const getImageCredits = (
  metadata: Record<string, unknown> | null | undefined
): ImageCredit[] => {
  const credits = metadata?.image_credits
  return Array.isArray(credits)
    ? credits.filter(
        (c): c is ImageCredit =>
          Boolean(c) && typeof c.source === "string" && typeof c.license === "string"
      )
    : []
}

type SpecProvenance = {
  spec_source?: { final_url?: string; url?: string; publisher?: string; retrieved_at?: string }
}

/** Official source a verified product's specifications were checked against. */
export const getSpecSource = (
  metadata: Record<string, unknown> | null | undefined
) => {
  const source = (metadata?.provenance as SpecProvenance | undefined)?.spec_source
  const url = source?.final_url || source?.url
  return url
    ? { url, publisher: source?.publisher ?? new URL(url).hostname, retrievedAt: source?.retrieved_at }
    : null
}
