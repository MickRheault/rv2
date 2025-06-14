import Image from 'next/image'
import Link from 'next/link'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { MotorcycleWithDetails } from '@/services/motorcycles'
import { formatCurrency, formatEngineCapacity } from '@/lib/utils'

interface MotorcycleCardProps {
  motorcycle: MotorcycleWithDetails
  showShopInfo?: boolean
  className?: string
}

export default function MotorcycleCard({ 
  motorcycle, 
  showShopInfo = true,
  className 
}: MotorcycleCardProps) {
  const shop = motorcycle.rental_shops
  const brand = motorcycle.brands
  const category = motorcycle.categories
  
  // Get location string
  const location = shop?.cities 
    ? `${shop.cities.name}, ${shop.cities.provinces?.name || ''}`
    : shop?.full_address || 'Location not specified'

  // Format pricing
  const price = motorcycle.rental_rate_per_day 
    ? formatCurrency(motorcycle.rental_rate_per_day, motorcycle.rental_rate_currency || 'USD')
    : 'Price on request'

  return (
    <Card className={className} hoverable variant="elevated">
      <CardHeader padding="none">
        {/* Motorcycle Image */}
        <div className="relative h-48 w-full overflow-hidden rounded-t-lg bg-gray-100">
          <Image
            src="/api/placeholder/400/300" // TODO: Integrate with motorcycle images
            alt={`${brand?.name || ''} ${motorcycle.model || 'Motorcycle'}`}
            fill
            className="object-cover transition-transform hover:scale-105"
          />
          
          {/* Category Badge */}
          {category && (
            <div className="absolute left-3 top-3">
              <span className="rounded-full bg-primary px-2 py-1 text-xs font-medium text-white">
                {category.name}
              </span>
            </div>
          )}
          
          {/* Price Badge */}
          <div className="absolute right-3 top-3">
            <div className="rounded-lg bg-white/90 px-2 py-1 backdrop-blur-sm">
              <span className="text-sm font-bold text-gray-900">
                {price}
                {motorcycle.rental_rate_per_day && (
                  <span className="text-xs text-gray-600">/day</span>
                )}
              </span>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Motorcycle Title */}
        <CardTitle className="line-clamp-1">
          {brand?.name} {motorcycle.model}
          {motorcycle.year && (
            <span className="ml-2 text-sm font-normal text-gray-500">
              ({motorcycle.year})
            </span>
          )}
        </CardTitle>

        {/* Specifications */}
        <div className="flex items-center space-x-4 text-sm text-gray-600">
          {motorcycle.engine_capacity_cc && (
            <div className="flex items-center space-x-1">
              <span className="text-xs">⚡</span>
              <span>{formatEngineCapacity(motorcycle.engine_capacity_cc)}</span>
            </div>
          )}
          
          {motorcycle.transmission && (
            <div className="flex items-center space-x-1">
              <span className="text-xs">⚙️</span>
              <span className="capitalize">{motorcycle.transmission}</span>
            </div>
          )}
        </div>

        {/* Shop Information */}
        {showShopInfo && shop && (
          <div className="space-y-1">
            <div className="flex items-center space-x-1 text-sm">
              <span className="text-xs">🏪</span>
              <span className="font-medium line-clamp-1">{shop.provider_name}</span>
            </div>
            
            <div className="flex items-center space-x-1 text-sm text-gray-600">
              <span className="text-xs">📍</span>
              <span className="line-clamp-1">{location}</span>
            </div>
            
            {shop.rating && (
              <div className="flex items-center space-x-1 text-sm">
                <span className="text-xs">⭐</span>
                <span className="font-medium">{shop.rating.toFixed(1)}</span>
                {shop.review_count && (
                  <span className="text-gray-600">({shop.review_count} reviews)</span>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>

      <CardFooter className="pt-3">
        <div className="flex w-full gap-2">
          <Link href={`/motorcycle/${motorcycle.id}`} className="flex-1">
            <Button variant="outline" fullWidth size="sm">
              View Details
            </Button>
          </Link>
          
          {shop && (
            <Link href={`/shop/${shop.id}`} className="flex-1">
              <Button variant="primary" fullWidth size="sm">
                Visit Shop
              </Button>
            </Link>
          )}
        </div>
      </CardFooter>
    </Card>
  )
} 