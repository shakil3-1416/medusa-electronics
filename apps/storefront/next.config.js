const checkEnvVariables = require("./check-env-variables")

checkEnvVariables()

/**
 * Medusa Cloud-related environment variables
 */
const S3_HOSTNAME = process.env.MEDUSA_CLOUD_S3_HOSTNAME
const S3_PATHNAME = process.env.MEDUSA_CLOUD_S3_PATHNAME

/**
 * Remote image hosts: the Medusa backend (local file uploads) and an optional
 * extra CDN/bucket host. Catalog illustrations are served from /public.
 */
const remoteHost = (url) => {
  try {
    const { protocol, hostname, port } = new URL(url)
    return { protocol: protocol.replace(":", ""), hostname, port: port || "" }
  } catch {
    return null
  }
}
const BACKEND_IMAGE_HOST = remoteHost(process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL)
const EXTRA_IMAGE_HOST = remoteHost(process.env.NEXT_PUBLIC_IMAGE_HOST_URL)
// Catalog images stored as absolute storefront URLs (so Medusa Admin can
// preview them) point back at this site.
const SITE_IMAGE_HOST = remoteHost(process.env.NEXT_PUBLIC_BASE_URL)

/**
 * @type {import('next').NextConfig}
 */
const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [{ key: "Link", value: '</.well-known/ucp>; rel="ucp"' }],
      },
      {
        source: "/:countryCode/products/:handle",
        headers: [{ key: "Vary", value: "Accept" }],
      },
    ]
  },
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: "/:countryCode/products/:handle([^/.]+).md",
          destination: "/:countryCode/products/:handle/markdown",
        },
        {
          source: "/:countryCode/products/:handle([^/.]+)",
          has: [{ type: "header", key: "accept", value: ".*text/markdown.*" }],
          destination: "/:countryCode/products/:handle/markdown",
        },
      ],
    }
  },
  logging: {
    fetches: {
      fullUrl: true,
    },
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      ...(process.env.NODE_ENV !== "production"
        ? [{ protocol: "http", hostname: "localhost" }]
        : []),
      ...(BACKEND_IMAGE_HOST ? [BACKEND_IMAGE_HOST] : []),
      ...(EXTRA_IMAGE_HOST ? [EXTRA_IMAGE_HOST] : []),
      ...(SITE_IMAGE_HOST ? [SITE_IMAGE_HOST] : []),
      {
        protocol: "https",
        hostname: "*.s3.*.amazonaws.com",
      },
      {
        protocol: "https",
        hostname: "*.s3.amazonaws.com",
      },
      ...(S3_HOSTNAME && S3_PATHNAME
        ? [
            {
              protocol: "https",
              hostname: S3_HOSTNAME,
              pathname: S3_PATHNAME,
            },
          ]
        : []),
    ],
  },
}

module.exports = nextConfig
