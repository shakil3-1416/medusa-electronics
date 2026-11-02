import { isEmpty } from "./isEmpty"

type ConvertToLocaleParams = {
  amount: number
  currency_code: string
  minimumFractionDigits?: number
  maximumFractionDigits?: number
  locale?: string
}

export const convertToLocale = ({
  amount,
  currency_code,
  minimumFractionDigits,
  maximumFractionDigits,
  locale = "en-US",
}: ConvertToLocaleParams) => {
  if (!currency_code || isEmpty(currency_code)) {
    return amount.toString()
  }

  // Taka is shown as "৳1,25,000" style whole amounts, as Bangladeshi
  // retailers do, rather than "BDT 125,000.00".
  if (currency_code.toLowerCase() === "bdt") {
    const fraction = Number.isInteger(amount) ? 0 : 2
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "BDT",
      currencyDisplay: "narrowSymbol",
      minimumFractionDigits: minimumFractionDigits ?? fraction,
      maximumFractionDigits: Math.max(
        maximumFractionDigits ?? fraction,
        minimumFractionDigits ?? 0
      ),
    }).format(amount)
  }

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currency_code,
    minimumFractionDigits,
    maximumFractionDigits,
  }).format(amount)
}
