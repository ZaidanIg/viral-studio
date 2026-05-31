import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { hostname: 'utfs.io' },          // UploadThing
      { hostname: '*.supabase.co' },    // Supabase Storage
      { hostname: 'lh3.googleusercontent.com' }, // Google OAuth avatars
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '5mb',
    },
  },
}

export default nextConfig
