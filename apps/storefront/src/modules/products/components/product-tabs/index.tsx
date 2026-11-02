"use client"

import Back from "@modules/common/icons/back"
import FastDelivery from "@modules/common/icons/fast-delivery"
import Refresh from "@modules/common/icons/refresh"

import Accordion from "./accordion"
import { HttpTypes } from "@medusajs/types"

type ProductTabsProps = {
  product: HttpTypes.StoreProduct
}

const ProductTabs = ({ product }: ProductTabsProps) => {
  const tabs = [
    {
      label: "Delivery & Returns",
      component: <ShippingInfoTab />,
    },
    {
      label: "Warranty",
      component: <WarrantyTab product={product} />,
    },
  ]

  return (
    <div className="w-full">
      <Accordion type="multiple">
        {tabs.map((tab, i) => (
          <Accordion.Item
            key={i}
            title={tab.label}
            headingSize="medium"
            value={tab.label}
          >
            {tab.component}
          </Accordion.Item>
        ))}
      </Accordion>
    </div>
  )
}

const WarrantyTab = ({ product }: ProductTabsProps) => {
  const warranty =
    typeof product.metadata?.warranty === "string"
      ? product.metadata.warranty
      : null

  return (
    <div className="text-small-regular py-6">
      <p className="max-w-sm">
        {warranty
          ? `${warranty} service warranty against manufacturing defects.`
          : "Warranty terms are provided with the product."}{" "}
        Keep your invoice and original packaging for warranty claims.
      </p>
    </div>
  )
}

const ShippingInfoTab = () => {
  return (
    <div className="text-small-regular py-6">
      <div className="grid grid-cols-1 gap-y-6">
        <div className="flex items-start gap-x-2">
          <FastDelivery />
          <div>
            <span className="font-semibold">Fast delivery</span>
            <p className="max-w-sm">
              Inside Dhaka in 1-2 days (from ৳80). Outside Dhaka in 2-4
              days (from ৳150). Express same/next day delivery in Dhaka.
            </p>
          </div>
        </div>
        <div className="flex items-start gap-x-2">
          <Refresh />
          <div>
            <span className="font-semibold">Check on delivery</span>
            <p className="max-w-sm">
              Inspect the sealed box in front of the delivery person before
              accepting your order.
            </p>
          </div>
        </div>
        <div className="flex items-start gap-x-2">
          <Back />
          <div>
            <span className="font-semibold">7-day returns</span>
            <p className="max-w-sm">
              Unused items in original packaging can be returned within 7
              days of delivery.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ProductTabs
