import { HttpTypes } from "@medusajs/types"
import { Container } from "@modules/common/components/ui"
import Image from "next/image"
import { ReactNode } from "react"

type ImageGalleryProps = {
  images: HttpTypes.StoreProductImage[]
  caption?: ReactNode
}

const ImageGallery = ({ images, caption }: ImageGalleryProps) => {
  return (
    <div className="flex items-start relative">
      <div className="flex flex-col flex-1 gap-y-4">
        {images.map((image, index) => {
          return (
            <Container
              key={image.id}
              className="relative aspect-square w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-none"
              id={image.id}
            >
              {!!image.url && (
                <Image
                  src={image.url}
                  priority={index <= 2 ? true : false}
                  className="absolute inset-0 p-6"
                  alt={`Product image ${index + 1}`}
                  fill
                  sizes="(max-width: 576px) 280px, (max-width: 768px) 360px, (max-width: 992px) 480px, 800px"
                  style={{
                    objectFit: "contain",
                  }}
                />
              )}
            </Container>
          )
        })}
        {caption && (
          <div
            className="text-xs text-slate-500"
            data-testid="image-caption"
          >
            {caption}
          </div>
        )}
      </div>
    </div>
  )
}

export default ImageGallery
