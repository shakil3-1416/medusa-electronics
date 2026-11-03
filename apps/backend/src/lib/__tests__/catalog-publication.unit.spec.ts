import { CatalogProduct, publicationBlockers, selectPublishBatch } from "../catalog-publication"

// In-memory fixtures only: no database, no real prices.
const product = (handle: string, opts: { price?: number; availability?: string; category?: string; sku?: string; review?: string } = {}): CatalogProduct => ({
  id: `prod_${handle}`,
  handle,
  status: "draft",
  thumbnail: "https://example.test/t.jpg",
  images: [{ url: "https://example.test/1.jpg" }],
  categories: [{ id: `cat_${opts.category ?? "router"}`, handle: opts.category ?? "router" }],
  sales_channels: [{ id: "sc_1" }],
  variants: [{ id: `var_${handle}`, sku: opts.sku ?? handle.toUpperCase(), prices: opts.price ? [{ amount: opts.price, currency_code: "bdt" }] : [] }],
  metadata: {
    review_status: opts.review ?? "auto_verified",
    price_status: opts.price ? "approved" : "pending_merchant_input",
    availability: opts.availability,
    image_credits: [{ license: "CC BY 4.0" }],
    specs: [{ items: [1, 2, 3, 4, 5] }],
  },
})

describe("catalog publication rules", () => {
  it("blocks unpriced products and explains why", () => {
    expect(publicationBlockers(product("real-a"))).toEqual(
      expect.arrayContaining(["no BDT selling price", "price not approved", "availability not set"])
    )
  })

  it("publishes only the priced subset when price coverage is partial", () => {
    const products = [
      product("real-priced-1", { price: 1, availability: "in_stock" }),
      product("real-unpriced"),
      product("real-priced-2", { price: 1, availability: "backorder" }),
    ]
    const sel = selectPublishBatch(products)
    expect(sel.batch.map((p) => p.handle)).toEqual(["real-priced-1", "real-priced-2"])
    expect(sel.blocked.map((b) => b.handle)).toEqual(["real-unpriced"])
  })

  it("holds out-of-stock products unless explicitly included", () => {
    const products = [product("real-oos", { price: 1, availability: "out_of_stock" })]
    expect(selectPublishBatch(products).heldOutOfStock).toEqual(["real-oos"])
    expect(selectPublishBatch(products, { includeOutOfStock: true }).batch).toHaveLength(1)
  })

  it("activates category by category", () => {
    const products = [
      product("real-board", { price: 1, availability: "in_stock", category: "motherboard" }),
      product("real-router", { price: 1, availability: "in_stock", category: "router" }),
    ]
    const sel = selectPublishBatch(products, { categories: ["motherboard"] })
    expect(sel.batch.map((p) => p.handle)).toEqual(["real-board"])
    expect(sel.outsideCategories).toBe(1)
  })

  it("never publishes review-blocked, duplicate-SKU, synthetic or already published products", () => {
    const published = { ...product("real-live", { price: 1, availability: "in_stock" }), status: "published" }
    const products = [
      product("real-review", { price: 1, availability: "in_stock", review: "needs_manual_review" }),
      product("real-dup-a", { price: 1, availability: "in_stock", sku: "SAME" }),
      product("real-dup-b", { price: 1, availability: "in_stock", sku: "SAME" }),
      { ...product("sgnova-router-001", { price: 1, availability: "in_stock" }) },
      published,
    ]
    const sel = selectPublishBatch(products)
    expect(sel.batch).toHaveLength(0)
    expect(sel.blocked.map((b) => b.handle).sort()).toEqual(["real-dup-a", "real-dup-b", "real-review"])
  })

  it("respects the batch size", () => {
    const products = Array.from({ length: 5 }, (_, i) => product(`real-${i}`, { price: 1, availability: "in_stock" }))
    expect(selectPublishBatch(products, { batchSize: 2 }).batch).toHaveLength(2)
  })
})
