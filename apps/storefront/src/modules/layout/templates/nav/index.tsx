import { Suspense } from "react"

import { listLocales } from "@lib/data/locales"
import { getLocale } from "@lib/data/locale-actions"
import { listRegions } from "@lib/data/regions"
import { StoreRegion } from "@medusajs/types"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import CartButton from "@modules/layout/components/cart-button"
import DepartmentBar from "@modules/layout/components/department-bar"
import Search from "@modules/layout/components/search"
import SideMenu from "@modules/layout/components/side-menu"

export default async function Nav() {
  const [regions, locales, currentLocale] = await Promise.all([
    listRegions().then((regions: StoreRegion[]) => regions),
    listLocales(),
    getLocale(),
  ])

  return (
    <div className="sticky top-0 inset-x-0 z-50 group">
      <div className="bg-slate-900 text-slate-200 text-xs">
        <div className="content-container flex h-8 items-center justify-between">
          <span className="truncate">Prices in Taka (৳) · Delivery across Bangladesh</span>
          <span className="hidden small:inline">
            Test store · no real payments are taken
          </span>
        </div>
      </div>
      <header className="relative mx-auto border-b bg-white border-ui-border-base">
        <nav className="content-container text-ui-fg-subtle flex items-center gap-x-4 small:gap-x-8 w-full h-16 text-small-regular">
          <div className="small:hidden h-full">
            <SideMenu
              regions={regions}
              locales={locales}
              currentLocale={currentLocale}
            />
          </div>

          <LocalizedClientLink
            href="/"
            className="flex items-center gap-x-2 text-slate-900"
            data-testid="nav-store-link"
          >
            <span
              aria-hidden="true"
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-700 text-lg font-black text-white"
            >
              M
            </span>
            <span className="text-2xl font-extrabold tracking-tight">
              Medusa
            </span>
          </LocalizedClientLink>

          <div className="hidden small:flex flex-1 max-w-2xl">
            <Search variant="bar" />
          </div>

          <div className="flex items-center gap-x-5 h-full ml-auto">
            <div className="small:hidden flex items-center">
              <Search />
            </div>
            <div className="hidden small:flex items-center h-full">
              <LocalizedClientLink
                className="hover:text-ui-fg-base font-medium"
                href="/account"
                data-testid="nav-account-link"
              >
                Account
              </LocalizedClientLink>
            </div>
            <Suspense
              fallback={
                <LocalizedClientLink
                  className="hover:text-ui-fg-base flex gap-2 font-medium"
                  href="/cart"
                  data-testid="nav-cart-link"
                >
                  Cart (0)
                </LocalizedClientLink>
              }
            >
              <CartButton />
            </Suspense>
          </div>
        </nav>
      </header>
      <DepartmentBar />
    </div>
  )
}
