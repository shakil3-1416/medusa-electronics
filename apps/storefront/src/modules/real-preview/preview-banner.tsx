import LocalizedClientLink from "@modules/common/components/localized-client-link"

/** Shown on every real-catalog preview page so drafts are never mistaken for the live store. */
const PreviewBanner = () => (
  <div className="border-b border-amber-300 bg-amber-50 text-amber-900" data-testid="preview-banner">
    <div className="content-container flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
      <span>
        <strong>Development preview.</strong> Real products are unpublished drafts, hidden
        from shoppers and search. Prices are pending, so they cannot be bought.
      </span>
      <LocalizedClientLink href="/preview/real" className="font-semibold underline">
        Real catalog home
      </LocalizedClientLink>
    </div>
  </div>
)

export default PreviewBanner
