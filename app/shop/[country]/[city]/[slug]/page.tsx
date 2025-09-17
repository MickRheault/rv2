import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { shopService } from '@/services/shops'
import { PremiumUtilsService } from '@/services/premium-listings'
import ShopDetails from '@/components/shop/ShopDetails'
import { generateMetadata as generateSEOMetadata, generateShopSEO } from '@/lib/seo/config'
import { StructuredData, generateRentalShopSchema, generateRentalServiceSchema, generateTourSchema, generateEnhancedMotorcycleSchema } from '@/lib/seo/structured-data'
import { parseShopLocation, validateShopLocation } from '@/lib/utils/urls'

interface ShopPageProps {
  params: {
    country: string
    city: string
    slug: string
  }
}

export async function generateMetadata({ params }: ShopPageProps): Promise<Metadata> {
  try {
    const { country, city, slug } = params
    const { countryName, cityName } = parseShopLocation(country, city)
    
    const shop = await shopService.getShopByLocationAndSlug(countryName, cityName, slug)
    
    // Validate that the shop actually matches the URL location
    if (!validateShopLocation(shop, country, city)) {
      throw new Error('Shop location mismatch')
    }
    
    const location = `${shop.cities?.name}, ${shop.cities?.provinces?.name || ''}, ${shop.cities?.provinces?.countries?.name || ''}`.replace(/,\s*,/g, ',').replace(/,$/, '')

    const seoConfig = generateShopSEO({
      id: shop.id,
      name: shop.provider_name,
      location: location,
      city: shop.cities?.name || undefined,
      country: shop.cities?.provinces?.countries?.name || undefined,
      description: shop.business_description || undefined,
      rating: shop.rating || undefined,
    })

    return generateSEOMetadata({
      ...seoConfig,
      url: `/shop/${country}/${city}/${slug}`,
    })
  } catch (error) {
    return {
      title: 'Shop Not Found | Global Moto Rentals',
      description: 'The requested motorcycle rental shop could not be found.',
    }
  }
}

export default async function ShopPage({ params }: ShopPageProps) {
  try {
    const { country, city, slug } = params
    const { countryName, cityName } = parseShopLocation(country, city)
    
    console.log('🔍 Shop page debug:', {
      urlParams: { country, city, slug },
      parsedLocation: { countryName, cityName }
    })
    
    let shop = await shopService.getShopByLocationAndSlug(countryName, cityName, slug)
    
    // If location-based lookup fails, try fallback to just slug
    if (!shop) {
      console.log('🔄 Location-based lookup failed, trying fallback by slug only...')
      try {
        shop = await shopService.getShopBySlug(slug)
        console.log('🎯 Fallback successful, found shop:', shop.provider_name)
        
        // Log the actual location vs expected
        const actualLocation = shop.cities ? 
          `${shop.cities.name}, ${shop.cities.provinces?.countries?.name}` : 
          'No location data'
        console.log('🗺️ Location mismatch - Expected:', `${countryName}, ${cityName}`, 'Actual:', actualLocation)
      } catch (fallbackError) {
        console.log('❌ Fallback also failed')
        notFound()
      }
    }
    
    if (!shop) {
      notFound()
    }

    // For now, let's be more lenient with location validation to debug
    const locationMatches = validateShopLocation(shop, country, city)
    if (!locationMatches) {
      console.log('⚠️ Location validation failed but proceeding for debugging')
    }

    // Fetch premium information for the shop (use same method as search results)
    let premium = undefined
    try {
      // Use the same method as search results for consistency
      const premiumMap = await PremiumUtilsService.getPremiumEntities('rental_shop', [shop.id])
      
      const premiumInfo = premiumMap.get(shop.id)
      
      if (premiumInfo) {
        premium = {
          isPremium: true,
          premiumType: premiumInfo.tier,
          boostScore: premiumInfo.boostScore
        }
      } else {
        premium = { isPremium: false }
      }
    } catch (error) {
      console.error('Error fetching premium info:', error)
      premium = { isPremium: false }
    }

    // Generate structured data for the shop
    const shopSchema = generateRentalShopSchema({
      id: shop.id,
      name: shop.provider_name,
      description: shop.business_description || undefined,
      address: shop.full_address || undefined,
      city: shop.cities?.name || undefined,
      country: shop.cities?.provinces?.countries?.name || undefined,
      phone: shop.phone || undefined,
      website: shop.website || undefined,
      latitude: shop.latitude || undefined,
      longitude: shop.longitude || undefined,
      rating: shop.rating || undefined,
      reviewCount: shop.review_count || undefined,
    })

    // Generate rental service schema
    const serviceSchema = generateRentalServiceSchema({
      shopId: shop.slug,
      shopName: shop.provider_name,
      rentalInclusions: shop.rental_shop_inclusions?.map(inc => inc.inclusion_text).filter(Boolean),
      serviceLocations: shop.rental_shop_service_locations?.map(loc => loc.location_name).filter(Boolean),
    })

    // Generate tour schemas if tours are available
    const tourSchemas = shop.rental_shop_tours?.map(tour => 
      generateTourSchema([{
        name: tour.name,
        durationText: tour.duration_text || undefined,
        distanceKm: tour.distance_km || undefined,
        priceText: tour.price_text || undefined,
        currency: tour.currency || undefined,
      }])
    ).flat() || []

    // Generate enhanced motorcycle schemas for all motorcycles offered by this shop
    const motorcycleSchemas = shop.motorcycle_rentals?.map(motorcycle => 
      generateEnhancedMotorcycleSchema({
        id: motorcycle.id,
        model: motorcycle.model || undefined,
        brand: motorcycle.brands?.name || undefined,
        year: motorcycle.year || undefined,
        category: motorcycle.categories?.name || undefined,
        description: `${motorcycle.brands?.name || ''} ${motorcycle.model || ''} motorcycle rental at ${shop.provider_name}`.trim(),
        engineSize: motorcycle.engine_capacity_cc || undefined,
        availability: motorcycle.availability_status === 'available',
        // Basic rental rates from shop's motorcycle rentals
        rentalRates: motorcycle.rental_rate_per_day ? [{
          rateText: 'Daily Rate',
          minDays: 1,
          maxDays: undefined,
          ratePerDay: motorcycle.rental_rate_per_day,
          currency: motorcycle.rental_rate_currency || undefined,
        }] : [],
        // Parse specifications from JSON if available
        specifications: motorcycle.specifications_details ? 
          (typeof motorcycle.specifications_details === 'object' ? 
            motorcycle.specifications_details : 
            undefined
          ) : undefined,
      })
    ) || []

    return (
      <>
        <StructuredData schema={shopSchema} />
        <StructuredData schema={serviceSchema} />
        {tourSchemas.map((tourSchema, index) => (
          <StructuredData key={`tour-${index}`} schema={tourSchema} />
        ))}
        {motorcycleSchemas.map((motorcycleSchema, index) => (
          <StructuredData key={`motorcycle-${index}`} schema={motorcycleSchema} />
        ))}
        <div className="min-h-screen bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <ShopDetails shop={shop} premium={premium} />
          </div>
        </div>
      </>
    )
  } catch (error) {
    console.error('Error loading shop:', error)
    notFound()
  }
}
