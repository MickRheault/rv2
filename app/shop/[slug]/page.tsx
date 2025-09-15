import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { shopService } from '@/services/shops'
import { PremiumUtilsService } from '@/services/premium-listings'
import ShopDetails from '@/components/shop/ShopDetails'
import { generateMetadata as generateSEOMetadata, generateShopSEO } from '@/lib/seo/config'
import { StructuredData, generateRentalShopSchema, generateRentalServiceSchema, generateTourSchema, generateEnhancedMotorcycleSchema } from '@/lib/seo/structured-data'

interface ShopPageProps {
  params: {
    slug: string
  }
}

export async function generateMetadata({ params }: ShopPageProps): Promise<Metadata> {
  try {
    const shop = await shopService.getShopBySlug(params.slug)
    
    const location = shop.cities ? 
      `${shop.cities.name}, ${shop.cities.provinces?.name || ''}, ${shop.cities.provinces?.countries?.name || ''}`.replace(/,\s*,/g, ',').replace(/,$/, '') :
      shop.full_address

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
      url: `/shop/${params.slug}`,
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
    const shop = await shopService.getShopBySlug(params.slug)
    
    if (!shop) {
      notFound()
    }

    // Fetch premium information for the shop (use same method as search results)
    let premium = undefined
    try {
      console.log('=== SHOP PAGE PREMIUM DEBUG ===')
      console.log('Shop ID:', shop.id)
      console.log('Shop provider name:', shop.provider_name)
      console.log('Entity ID that will be searched for:', shop.id)
      console.log('Entity ID type:', typeof shop.id)
      console.log('About to call getPremiumEntities with:')
      console.log('  - content_type:', 'rental_shop')
      console.log('  - entity_ids array:', [shop.id])
      console.log('  - entity_ids array length:', [shop.id].length)
      console.log('  - entity_ids[0]:', [shop.id][0])
      console.log('  - searching for entity_id:', shop.id)
      
      // Use the same method as search results for consistency
      const premiumMap = await PremiumUtilsService.getPremiumEntities('rental_shop', [shop.id])
      console.log('Premium map result:', premiumMap)
      console.log('Premium map size:', premiumMap.size)
      console.log('Premium map keys:', Array.from(premiumMap.keys()))
      console.log('Premium map has shop.id?', premiumMap.has(shop.id))
      console.log('Exact entity ID searched for in premium query:', shop.id)
      
      const premiumInfo = premiumMap.get(shop.id)
      console.log('Premium info for entity ID', shop.id, ':', premiumInfo)
      
      if (premiumInfo) {
        premium = {
          isPremium: true,
          premiumType: premiumInfo.tier,
          boostScore: premiumInfo.boostScore
        }
        console.log('Setting premium to:', premium)
      } else {
        premium = { isPremium: false }
        console.log('No premium info found, setting isPremium to false')
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