import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { motorcycleService } from '@/services/motorcycles'
import MotorcycleGallery from '@/components/motorcycle/MotorcycleGallery'
import MotorcycleDetails from '@/components/motorcycle/MotorcycleDetails'
import MotorcycleCard from '@/components/motorcycle/MotorcycleCard'

interface PageProps {
  params: { id: string }
}

// Generate metadata for SEO
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  try {
    const motorcycle = await motorcycleService.getMotorcycleById(params.id)
    const title = `${motorcycle.brands?.name} ${motorcycle.model} (${motorcycle.year}) - Motorcycle Rental`
    const description = `Rent a ${motorcycle.brands?.name} ${motorcycle.model} from ${motorcycle.rental_shops?.provider_name}. ${motorcycle.engine_capacity_cc}cc ${motorcycle.categories?.name}. Starting from ${motorcycle.rental_rate_currency} ${motorcycle.rental_rate_per_day}/day.`
    
    return {
      title,
      description,
      openGraph: {
        title,
        description,
        type: 'website',
        images: motorcycle.motorcycle_images?.[0]?.images?.url 
          ? [{ url: motorcycle.motorcycle_images[0].images.url }] 
          : []
      }
    }
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

    return (
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