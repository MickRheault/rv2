/** @type {import('next-sitemap').IConfig} */
module.exports = {
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
  generateRobotsTxt: true,
  sitemapSize: 7000,
  changefreq: 'daily',
  priority: 0.7,
  exclude: [
    '/admin',
    '/admin/*',
    '/auth/*',
    '/_not-found',
    '/api/*'
  ],
  robotsTxtOptions: {
    policies: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/admin',
          '/admin/*',
          '/api/*',
          '/auth/*',
          '/_next/*',
        ],
      },
    ],
    additionalSitemaps: [
      // Will be dynamically generated
    ],
  },
  transform: async (config, path) => {
    // Custom priority and frequency based on route type
    
    // Homepage - highest priority
    if (path === '/') {
      return {
        loc: path,
        changefreq: 'daily',
        priority: 1.0,
        lastmod: new Date().toISOString(),
      }
    }
    
    // Motorcycle detail pages - high priority
    if (path.includes('/motorcycle/')) {
      return {
        loc: path,
        changefreq: 'weekly',
        priority: 0.9,
        lastmod: new Date().toISOString(),
      }
    }
    
    // Shop detail pages - high priority
    if (path.includes('/shop/')) {
      return {
        loc: path,
        changefreq: 'weekly',
        priority: 0.9,
        lastmod: new Date().toISOString(),
      }
    }
    
    // Search page - important for discovery
    if (path === '/search') {
      return {
        loc: path,
        changefreq: 'daily',
        priority: 0.8,
        lastmod: new Date().toISOString(),
      }
    }
    
    // Main category/info pages
    if (['/about', '/contact', '/help', '/safety', '/how-it-works'].includes(path)) {
      return {
        loc: path,
        changefreq: 'monthly',
        priority: 0.6,
        lastmod: new Date().toISOString(),
      }
    }
    
    // Legal pages
    if (['/privacy', '/terms', '/cookies'].includes(path)) {
      return {
        loc: path,
        changefreq: 'yearly',
        priority: 0.3,
        lastmod: new Date().toISOString(),
      }
    }
    
    // Default for other pages
    return {
      loc: path,
      changefreq: config.changefreq,
      priority: config.priority,
      lastmod: new Date().toISOString(),
    }
  },
  additionalPaths: async (config) => {
    try {
      // For sitemap generation, we need to use a different approach
      // since we're in a Node.js context, not Next.js
      const { createClient } = require('@supabase/supabase-js')
      
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      )
      
      console.log('🗺️  Generating dynamic sitemap routes...')
      
      const additionalPaths = []
      
      // Fetch all motorcycles
      const { data: motorcycles, error: motorcyclesError } = await supabase
        .from('motorcycle_rentals')
        .select('id, updated_at')
        .limit(2000)
      
      if (!motorcyclesError && motorcycles) {
        motorcycles.forEach(motorcycle => {
          additionalPaths.push({
            loc: `/motorcycle/${motorcycle.id}`,
            changefreq: 'weekly',
            priority: 0.9,
            lastmod: motorcycle.updated_at || new Date().toISOString(),
          })
        })
      }
      
      // Fetch all shops
      const { data: shops, error: shopsError } = await supabase
        .from('rental_shops')
        .select('slug, updated_at')
        .limit(2000)
      
      if (!shopsError && shops) {
        shops.forEach(shop => {
          additionalPaths.push({
            loc: `/shop/${shop.slug}`,
            changefreq: 'weekly',
            priority: 0.9,
            lastmod: shop.updated_at || new Date().toISOString(),
          })
        })
      }
      
      // Add some key search pages
      const searchPaths = [
        { loc: '/search', changefreq: 'daily', priority: 0.8 },
        { loc: '/browse', changefreq: 'daily', priority: 0.7 },
      ]
      
      searchPaths.forEach(path => {
        additionalPaths.push({
          ...path,
          lastmod: new Date().toISOString(),
        })
      })
      
      console.log(`✅ Generated ${additionalPaths.length} dynamic routes:`)
      console.log(`   📍 ${motorcycles?.length || 0} motorcycle pages`)
      console.log(`   🏪 ${shops?.length || 0} shop pages`)
      console.log(`   🔍 ${searchPaths.length} search pages`)
      
      return additionalPaths
      
    } catch (error) {
      console.error('❌ Error generating dynamic sitemap paths:', error)
      // Don't fail the build if we can't fetch dynamic paths
      return []
    }
  },
}