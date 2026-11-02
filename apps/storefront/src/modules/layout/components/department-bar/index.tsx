import { DEPARTMENTS } from "@lib/catalog/departments"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

/**
 * Desktop department bar with hover/focus dropdowns. Pure CSS, so it works
 * without client JavaScript. Hidden on mobile, where the side menu lists the
 * same departments.
 */
export default function DepartmentBar() {
  return (
    <div className="hidden small:block border-b border-slate-200 bg-white">
      <ul className="content-container flex items-center gap-x-1 h-11 text-sm font-medium text-slate-700">
        {DEPARTMENTS.map((department) => (
          <li key={department.name} className="relative group/dept h-full">
            <LocalizedClientLink
              href={`/categories/${department.handle}`}
              className="flex h-full items-center px-3 hover:text-blue-700 group-hover/dept:text-blue-700"
              data-testid="department-link"
            >
              {department.name}
            </LocalizedClientLink>
            {department.categories.length > 1 && (
              <div className="invisible opacity-0 group-hover/dept:visible group-hover/dept:opacity-100 group-focus-within/dept:visible group-focus-within/dept:opacity-100 transition-opacity absolute left-0 top-full z-50 min-w-[220px] rounded-b-lg border border-slate-200 bg-white py-2 shadow-lg">
                {department.categories.map((category) => (
                  <LocalizedClientLink
                    key={category.handle}
                    href={`/categories/${category.handle}`}
                    className="block px-4 py-2 text-slate-700 hover:bg-blue-50 hover:text-blue-700"
                  >
                    {category.name}
                  </LocalizedClientLink>
                ))}
              </div>
            )}
          </li>
        ))}
        <li className="ml-auto h-full">
          <LocalizedClientLink
            href="/store"
            className="flex h-full items-center px-3 font-semibold text-blue-700 hover:underline"
          >
            All products
          </LocalizedClientLink>
        </li>
      </ul>
    </div>
  )
}
