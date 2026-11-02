import { DEPARTMENTS } from "@lib/catalog/departments"
import { Text } from "@modules/common/components/ui"

import LocalizedClientLink from "@modules/common/components/localized-client-link"

const SERVICE_LINKS = [
  { name: "Shipping information", href: "/shipping" },
  { name: "Return policy", href: "/returns" },
  { name: "Terms of service", href: "/terms" },
  { name: "Privacy policy", href: "/privacy" },
  { name: "Contact", href: "/contact" },
  { name: "Search", href: "/search" },
]

const ACCOUNT_LINKS = [
  { name: "My account", href: "/account" },
  { name: "Order history", href: "/account/orders" },
  { name: "Cart", href: "/cart" },
  { name: "All products", href: "/store" },
]

export default async function Footer() {
  return (
    <footer className="w-full bg-slate-900 text-slate-300">
      <div className="content-container flex flex-col w-full">
        <div className="grid gap-10 py-14 small:grid-cols-[1.2fr_2fr_1fr_1fr]">
          <div className="max-w-xs">
            <LocalizedClientLink
              href="/"
              className="text-2xl font-extrabold tracking-tight text-white"
            >
              Medusa
            </LocalizedClientLink>
            <p className="mt-3 text-sm leading-6 text-slate-400">
              Computers, components, phones and accessories for Bangladesh.
              All prices in Taka (৳).
            </p>
            <p className="mt-3 text-xs text-slate-500">
              This is a test store with a synthetic catalog. No real payments
              are processed.
            </p>
          </div>

          <div>
            <span className="text-sm font-semibold text-white">
              Shop by department
            </span>
            <ul
              className="mt-3 grid grid-cols-2 gap-2 text-sm"
              data-testid="footer-categories"
            >
              {DEPARTMENTS.map((department) => (
                <li key={department.name}>
                  <LocalizedClientLink
                    className="hover:text-white"
                    href={`/categories/${department.handle}`}
                    data-testid="category-link"
                  >
                    {department.name}
                  </LocalizedClientLink>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <span className="text-sm font-semibold text-white">
              Customer service
            </span>
            <ul className="mt-3 grid gap-2 text-sm">
              {SERVICE_LINKS.map((link) => (
                <li key={link.href}>
                  <LocalizedClientLink className="hover:text-white" href={link.href}>
                    {link.name}
                  </LocalizedClientLink>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <span className="text-sm font-semibold text-white">Account</span>
            <ul className="mt-3 grid gap-2 text-sm">
              {ACCOUNT_LINKS.map((link) => (
                <li key={link.href}>
                  <LocalizedClientLink className="hover:text-white" href={link.href}>
                    {link.name}
                  </LocalizedClientLink>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="flex w-full flex-col gap-2 border-t border-slate-800 py-6 text-slate-500 small:flex-row small:justify-between">
          <Text className="txt-compact-small">
            © {new Date().getFullYear()} Medusa. All rights reserved.
          </Text>
          <Text className="txt-compact-small">
            Payments: manual test payment only
          </Text>
        </div>
      </div>
    </footer>
  )
}
