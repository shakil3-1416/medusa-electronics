import Image from "next/image"
import Link from "next/link"

import { DEPARTMENTS, categoryImage } from "@lib/catalog/departments"

const PROMOS = [
  {
    eyebrow: "Gaming season",
    title: "Gaming laptops & GPUs",
    body: "High refresh displays and ray-tracing graphics.",
    href: "categories/gaming-laptop",
    image: "/catalog/gaming-laptop/2.svg",
    tone: "bg-orange-50 text-orange-900",
  },
  {
    eyebrow: "Work smarter",
    title: "Office monitors from ৳12,100",
    body: "Eye-care IPS panels for long workdays.",
    href: "categories/office-monitor",
    image: "/catalog/office-monitor/3.svg",
    tone: "bg-emerald-50 text-emerald-900",
  },
]

const SERVICES = [
  { title: "Delivery across Bangladesh", body: "Inside Dhaka from ৳80" },
  { title: "Cash on delivery (test)", body: "Safe manual test payments" },
  { title: "7-day returns", body: "On eligible items" },
  { title: "Warranty support", body: "1-2 years on every product" },
]

export default function Hero({ countryCode }: { countryCode: string }) {
  const categories = DEPARTMENTS.flatMap((department) => department.categories)

  return (
    <div className="bg-slate-50 text-slate-900">
      <div className="content-container py-6 small:py-8">
        <div className="grid gap-4 small:grid-cols-[1.7fr_1fr]">
          <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 p-6 text-white small:p-10">
            <div className="relative z-10 max-w-md">
              <span className="inline-block rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wider">
                Medusa Bangladesh
              </span>
              <h1 className="mt-4 text-3xl font-extrabold leading-tight small:text-5xl">
                Tech for work, play and everything between.
              </h1>
              <p className="mt-4 text-sm leading-6 text-blue-100 small:text-base">
                600+ laptops, components, phones, monitors and accessories,
                priced in Taka and delivered nationwide.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href={`/${countryCode}/store`}
                  className="rounded-lg bg-amber-400 px-6 py-3 text-sm font-bold text-slate-950 transition hover:bg-amber-300"
                  data-testid="hero-shop-link"
                >
                  Shop all products
                </Link>
                <Link
                  href={`/${countryCode}/categories/processor`}
                  className="rounded-lg border border-white/40 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  Build a PC
                </Link>
              </div>
            </div>
            <div className="pointer-events-none absolute -bottom-6 -right-6 hidden h-72 w-72 xsmall:block small:h-80 small:w-80">
              <Image
                src="/catalog/gaming-laptop/1.svg"
                alt=""
                fill
                sizes="320px"
                className="object-contain opacity-90"
                priority
              />
            </div>
          </section>

          <div className="grid gap-4">
            {PROMOS.map((promo) => (
              <Link
                key={promo.title}
                href={`/${countryCode}/${promo.href}`}
                className={`relative flex min-h-[150px] items-center overflow-hidden rounded-2xl p-6 transition hover:shadow-md ${promo.tone}`}
              >
                <div className="relative z-10 max-w-[60%]">
                  <span className="text-xs font-bold uppercase tracking-wider opacity-80">
                    {promo.eyebrow}
                  </span>
                  <h2 className="mt-1 text-xl font-bold leading-tight">
                    {promo.title}
                  </h2>
                  <p className="mt-1 text-sm opacity-80">{promo.body}</p>
                </div>
                <div className="absolute -right-4 top-1/2 h-40 w-40 -translate-y-1/2">
                  <Image
                    src={promo.image}
                    alt=""
                    fill
                    sizes="160px"
                    className="object-contain"
                  />
                </div>
              </Link>
            ))}
          </div>
        </div>

        <ul className="mt-4 grid grid-cols-2 gap-3 small:grid-cols-4">
          {SERVICES.map((service) => (
            <li
              key={service.title}
              className="rounded-xl border border-slate-200 bg-white px-4 py-3"
            >
              <p className="text-sm font-semibold">{service.title}</p>
              <p className="text-xs text-slate-500">{service.body}</p>
            </li>
          ))}
        </ul>

        <section className="mt-10" aria-labelledby="home-categories">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-blue-700">
                Browse by category
              </p>
              <h2 id="home-categories" className="mt-1 text-2xl font-bold">
                Featured categories
              </h2>
            </div>
            <Link
              href={`/${countryCode}/store`}
              className="text-sm font-semibold text-blue-700 hover:underline"
            >
              View all products
            </Link>
          </div>

          <ul className="grid grid-cols-3 gap-3 xsmall:grid-cols-5 small:grid-cols-6 medium:grid-cols-10">
            {categories.map((category) => (
              <li key={category.handle}>
                <Link
                  href={`/${countryCode}/categories/${category.handle}`}
                  className="flex h-full flex-col items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 text-center transition hover:border-blue-400 hover:shadow-md"
                  data-testid="home-category-link"
                >
                  <span className="relative h-14 w-14">
                    <Image
                      src={categoryImage(category.handle)}
                      alt=""
                      fill
                      sizes="56px"
                      className="object-contain"
                    />
                  </span>
                  <span className="text-xs font-semibold leading-tight">
                    {category.name}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  )
}
