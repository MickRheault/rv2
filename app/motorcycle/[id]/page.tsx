import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { motorcycleService } from '@/services/motorcycles'
import MotorcycleGallery from '@/components/motorcycle/MotorcycleGallery'
import MotorcycleDetails from '@/components/motorcycle/MotorcycleDetails'
import MotorcycleCard from '@/components/motorcycle/MotorcycleCard'
import { generateMetadata as generateSEOMetadata, generateMotorcycleSEO } from '@/lib/seo/config'
import { StructuredData, generateMotorcycleSchema } from '@/lib/seo/structured-data'

interface PageProps {
  params: { id: string }
}

// Generate enhanced metadata for SEO
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  try {
    const motorcycle = await motorcycleService.getMotorcycleById(params.id)
    
    const seoConfig = generateMotorcycleSEO({
      id: motorcycle.id,
      model: motorcycle.model || undefined,
      brand: motorcycle.brands?.name || undefined,
      location: motorcycle.rental_shops?.location_name || motorcycle.rental_shops?.cities?.name || undefined,
      pricePerDay: motorcycle.rental_rate_per_day || undefined,
      year: motorcycle.year || undefined,
      category: motorcycle.categories?.name || undefined,
      image: motorcycle.motorcycle_images?.[0]?.images?.url || undefined,
    })
    
    return generateSEOMetadata({
      ...seoConfig,
      url: `/motorcycle/${params.id}`,
    })
  } catch (error) {
    return {
      title: 'Motorcycle Not Found',
      description: 'The requested motorcycle could not be found.'
    }
  }
}

export default async function MotorcycleDetailPage({ params }: PageProps) {
  try {
    const motorcycle = await motorcycleService.getMotorcycleById(params.id)
    
    if (!motorcycle) {
      notFound()
    }

    // Transform images for the gallery component
    const images = motorcycle.motorcycle_images
      ?.filter(mi => mi.images)
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
      .map(mi => ({
        id: mi.images!.id,
        url: mi.images!.url,
        alt_text: mi.images!.alt_text
      })) || []

    const motorcycleName = `${motorcycle.brands?.name} ${motorcycle.model}`

    // Generate structured data for rich snippets
    const structuredData = generateMotorcycleSchema({
      id: motorcycle.id,
      model: motorcycle.model || undefined,
      brand: motorcycle.brands?.name || undefined,
      year: motorcycle.year || undefined,
      category: motorcycle.categories?.name || undefined,
      description: `${motorcycle.brands?.name || ''} ${motorcycle.model || ''} motorcycle rental`.trim(),
      pricePerDay: motorcycle.rental_rate_per_day || undefined,
      currency: motorcycle.rental_rate_currency || undefined,
      image: motorcycle.motorcycle_images?.[0]?.images?.url || undefined,
      location: motorcycle.rental_shops?.location_name || motorcycle.rental_shops?.cities?.name || undefined,
      features: motorcycle.motorcycle_features?.map(f => f.features?.name).filter(Boolean),
      engineSize: motorcycle.engine_capacity_cc || undefined,
      availability: true,
    })

    return (
      <>
        <StructuredData schema={structuredData} />
        <div className="min-h-screen bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            {/* Image Gallery */}
            <div>
              <MotorcycleGallery 
                images={images} 
                motorcycleName={motorcycleName}
              />
            </div>

            {/* Motorcycle Details */}
            <div>
              <MotorcycleDetails motorcycle={motorcycle} />
            </div>
          </div>

          {/* Related Motorcycles */}
          <RelatedMotorcycles 
            currentMotorcycleId={motorcycle.id}
            shopId={motorcycle.shop_id}
            categoryId={motorcycle.category_id}
            brandId={motorcycle.brand_id}
          />
          </div>
        </div>
      </>
    )
  } catch (error) {
    console.error('Error loading motorcycle:', error)
    notFound()
  }
}

interface RelatedMotorcyclesProps {
  currentMotorcycleId: string
  shopId: string
  categoryId: string | null
  brandId: string
}

async function RelatedMotorcycles({ 
  currentMotorcycleId, 
  shopId, 
  categoryId, 
  brandId 
}: RelatedMotorcyclesProps) {
  try {
    // Get motorcycles from the same shop first
    const shopMotorcycles = await motorcycleService.getMotorcyclesByShop(shopId, 6)
    const filteredShopMotorcycles = shopMotorcycles.filter((m: any) => m.id !== currentMotorcycleId)

    if (filteredShopMotorcycles.length > 0) {
      return (
        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            More from this rental shop
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredShopMotorcycles.slice(0, 3).map((motorcycle: any) => (
              <MotorcycleCard key={motorcycle.id} motorcycle={motorcycle} />
            ))}
          </div>
        </section>
      )
    }

    // If no motorcycles from same shop, get similar motorcycles by category
    if (categoryId) {
      const categoryResult = await motorcycleService.getMotorcycles({
        categoryId,
        limit: 4
      })
      const filteredCategoryMotorcycles = categoryResult.motorcycles.filter((m: any) => m.id !== currentMotorcycleId)

      if (filteredCategoryMotorcycles.length > 0) {
        return (
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-6">
              Similar motorcycles
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredCategoryMotorcycles.slice(0, 3).map((motorcycle: any) => (
                <MotorcycleCard key={motorcycle.id} motorcycle={motorcycle} />
              ))}
            </div>
          </section>
        )
      }
    }

    return null
  } catch (error) {
    console.error('Error loading related motorcycles:', error)
    return null
  }
} 