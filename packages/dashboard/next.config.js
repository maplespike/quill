/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  images: { unoptimized: true },
  env: {
    NEXT_PUBLIC_API_BASE: process.env.MAPLESPIKE_API_URL || 'https://dev-maplespike-api.lan/v1',
  },
}
module.exports = nextConfig
