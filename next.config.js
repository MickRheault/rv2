/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Temporarily disabled for MVP - will re-enable after all routes are created
    // typedRoutes: true,
  },
  images: {
    domains: [
      'localhost',
      // Add Supabase storage domain
      'supabase.co',
      // Add other image domains as needed
    ],
    formats: ['image/webp', 'image/avif'],
  },
  async headers() {
    return [
      {
        // Apply security headers to all routes
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig; 