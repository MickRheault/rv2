import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { shopService } from '@/services/shops'
import ShopDetails from '@/components/shop/ShopDetails'

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

    return {
      title: `${shop.provider_name} - Motorcycle Rental | RideVault`,
      description: shop.business_description || 
        `Rent motorcycles from ${shop.provider_name} in ${location}. ${shop.motorcycle_rentals.length} motorcycles available. ${shop.rating ? `${shop.rating}/5 rating` : ''}.`,
      openGraph: {
        title: `${shop.provider_name} - Motorcycle Rental`,
        description: shop.business_description || `Rent motorcycles from ${shop.provider_name} in ${location}`,
        type: 'website',
      },
    }
  } catch (error) {
    return {
      title: 'Shop Not Found | RideVault',
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

    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <ShopDetails shop={shop} />
        </div>
      </div>
    )
  } catch (error) {
    console.error('Error loading shop:', error)
    notFound()
  }
} 