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
    '/test-*',
    '/ui-demo',
    '/motorcycle-demo',
    '/shop-demo',
    '/search-demo',
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
          '/test-*',
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
      
      // Helper function to format location for URL
      const formatLocationForUrl = (name) => {
        return name
          .toLowerCase()
          .replace(/\s+/g, '-')
          .replace(/[^a-z0-9-]/g, '')
          .replace(/-+/g, '-')
          .replace(/^-|-$/g, '')
      }
      
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
      
      // Fetch all locations with shops for country and city pages
      const { data: locations, error: locationsError } = await supabase
        .from('cities')
        .select(`
          id,
          name,
          updated_at,
          provinces (
            name,
            countries (
              code,
              name
            )
          )
        `)
        .limit(5000)
      
      // Add country pages
      if (!locationsError && locations) {
        const countriesMap = new Map()
        
        locations.forEach(city => {
          const countryCode = city.provinces?.countries?.code
          const countryName = city.provinces?.countries?.name
          
          if (countryCode && countryName && !countriesMap.has(countryCode)) {
            countriesMap.set(countryCode, {
              name: countryName,
              updated_at: city.updated_at
            })
          }
        })
        
        // Add country pages to sitemap
        countriesMap.forEach((country) => {
          const countrySlug = formatLocationForUrl(country.name)
          additionalPaths.push({
            loc: `/${countrySlug}`,
            changefreq: 'weekly',
            priority: 0.8,
            lastmod: country.updated_at || new Date().toISOString(),
          })
        })
        
        // Add city pages to sitemap
        locations.forEach(city => {
          const countryName = city.provinces?.countries?.name
          const cityName = city.name
          
          if (countryName && cityName) {
            const countrySlug = formatLocationForUrl(countryName)
            const citySlug = formatLocationForUrl(cityName)
            
            additionalPaths.push({
              loc: `/${countrySlug}/${citySlug}`,
              changefreq: 'weekly',
              priority: 0.8,
              lastmod: city.updated_at || new Date().toISOString(),
            })
          }
        })
      }
      
      // Fetch all shops with location data
      const { data: shops, error: shopsError } = await supabase
        .from('rental_shops')
        .select(`
          slug, 
          updated_at,
          cities (
            name,
            provinces (
              name,
              countries (
                name
              )
            )
          )
        `)
        .limit(2000)
      
      if (!shopsError && shops) {
        shops.forEach(shop => {
          // Skip shops without complete location data (country/city required for new URL format)
          if (!shop.cities?.provinces?.countries?.name || !shop.cities?.name) {
            console.warn(`⚠️  Skipping shop ${shop.slug} - missing location data for sitemap`)
            return
          }

          const country = formatLocationForUrl(shop.cities.provinces.countries.name)
          const city = formatLocationForUrl(shop.cities.name)
          const shopUrl = `/shop/${country}/${city}/${shop.slug}`

          additionalPaths.push({
            loc: shopUrl,
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
      
      // Count different route types
      const countryCount = additionalPaths.filter(p => p.loc.split('/').length === 2 && p.loc !== '/search' && p.loc !== '/browse').length
      const cityCount = additionalPaths.filter(p => p.loc.split('/').length === 3 && !p.loc.includes('/motorcycle/') && !p.loc.includes('/shop/')).length
      const shopCount = shops?.length || 0
      const motorcycleCount = motorcycles?.length || 0
      
      console.log(`✅ Generated ${additionalPaths.length} dynamic routes:`)
      console.log(`   🌍 ${countryCount} country pages`)
      console.log(`   🏙️  ${cityCount} city pages`)
      console.log(`   🏪 ${shopCount} shop pages`)
      console.log(`   📍 ${motorcycleCount} motorcycle pages`)
      console.log(`   🔍 ${searchPaths.length} search pages`)
      
      return additionalPaths
      
    } catch (error) {
      console.error('❌ Error generating dynamic sitemap paths:', error)
      // Don't fail the build if we can't fetch dynamic paths
      return []
    }
  },
}