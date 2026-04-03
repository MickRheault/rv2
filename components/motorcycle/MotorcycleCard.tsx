'use client'

import Link from 'next/link'
import { clsx } from 'clsx'
import {
  HeartIcon,
  MapPinIcon,
  StarIcon,
  CalendarIcon,
  CogIcon,
  GlobeAltIcon
} from '@heroicons/react/24/outline'
import { HeartIcon as HeartSolid } from '@heroicons/react/24/solid'
import { Card, Badge, PremiumBadge } from '@/components/ui'
import { MotorcycleWithDetails } from '@/services/motorcycles'
import { formatCurrency, formatEngineCapacity } from '@/lib/utils'

interface MotorcycleCardProps {
  motorcycle: MotorcycleWithDetails
  showShopInfo?: boolean
  showFeatures?: boolean
  compact?: boolean
  onFavoriteToggle?: (motorcycleId: string, isFavorited: boolean) => void
  isFavorited?: boolean
  isPremium?: boolean
  premiumType?: 'gold' | 'platinum' | 'featured'
  className?: string
}

export default function MotorcycleCard({ 
  motorcycle, 
  showShopInfo = true,
  showFeatures = false,
  compact = false,
  onFavoriteToggle,
  isFavorited = false,
  isPremium = false,
  premiumType = 'gold',
  className 
}: MotorcycleCardProps) {
  const shop = motorcycle.rental_shops
  const brand = motorcycle.brands
  const category = motorcycle.categories
  
  // Get location string
  const location = shop?.cities 
    ? `${shop.cities.name}, ${shop.cities.provinces?.name || ''}`
    : shop?.full_address || 'Location not specified'

  // Get the best (lowest) daily rate from rate tiers or fallback to base rate
  // This matches the logic in MotorcycleDetails component
  const getBestRate = () => {
    if (motorcycle.rental_rate_tiers && motorcycle.rental_rate_tiers.length > 0) {
      // Find the tier with the shortest min_days
      const shortestPeriodTier = motorcycle.rental_rate_tiers.reduce((prev, current) => 
        prev.min_days < current.min_days ? prev : current
      )
      return { amount: shortestPeriodTier.rate_per_day, currency: shortestPeriodTier.currency }
    }
    return { amount: motorcycle.rental_rate_per_day, currency: motorcycle.rental_rate_currency }
  }

  const bestRate = getBestRate()
  const hasRateTiers = motorcycle.rental_rate_tiers && motorcycle.rental_rate_tiers.length > 0
  
  // Format pricing
  const price = bestRate.amount
    ? formatCurrency(bestRate.amount, bestRate.currency || 'USD')
    : 'Price on request'

  // Handle favorite toggle
  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onFavoriteToggle?.(motorcycle.id, !isFavorited)
  }

  return (
    <Link href={`/motorcycle/${motorcycle.id}`} className="block group">
      <Card 
        padding="none"
        className={clsx(
          'overflow-hidden transition-all duration-300 hover:shadow-md hover:border-gray-300 w-full',
          isPremium && 'ring-2 ring-yellow-400 shadow-lg relative',
          isPremium && premiumType === 'featured' && 'ring-blue-500 shadow-blue-200',
          isPremium && premiumType === 'platinum' && 'ring-gray-400 shadow-gray-200',
          className
        )}
      >
        {/* Premium border glow effect */}
        {isPremium && (
          <div className={clsx(
            'absolute inset-0 rounded-lg opacity-10 pointer-events-none',
            premiumType === 'gold' && 'bg-gradient-to-br from-yellow-400 to-yellow-600',
            premiumType === 'platinum' && 'bg-gradient-to-br from-gray-300 to-gray-500',
            premiumType === 'featured' && 'bg-gradient-to-br from-blue-500 to-purple-600'
          )} />
        )}
        
        <div className="p-3 space-y-2">
          {/* Header with title and badges */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-gray-900 line-clamp-1 text-sm">
                {brand?.name} {motorcycle.model}
              </h3>
              {motorcycle.year && (
                <p className="text-xs text-gray-500">
                  {motorcycle.year} Model
                </p>
              )}
            </div>
            
            <div className="flex items-center gap-1 flex-shrink-0">
              {/* Premium Badge or Category Badge */}
              {isPremium && (
                <PremiumBadge type={premiumType} className="text-xs" />
              )}
              {category && (
                <Badge 
                  variant={isPremium ? "secondary" : "primary"} 
                  size="sm" 
                  className={clsx(
                    "text-xs",
                    isPremium ? "bg-gray-100 text-gray-700" : "bg-blue-600 text-white"
                  )}
                >
                  {category.name}
                </Badge>
              )}
              
              {/* Favorite button */}
              {onFavoriteToggle && (
                <button
                  onClick={handleFavoriteClick}
                  className="p-1 hover:bg-gray-100 rounded-full transition-colors"
                  aria-label={isFavorited ? 'Remove from favorites' : 'Add to favorites'}
                >
                  {isFavorited ? (
                    <HeartSolid className="w-3 h-3 text-red-500" />
                  ) : (
                    <HeartIcon className="w-3 h-3 text-gray-400" />
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Specifications and Price */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3 text-xs text-gray-600">
              {motorcycle.engine_capacity_cc && (
                <div className="flex items-center space-x-1">
                  <CogIcon className="w-3 h-3" />
                  <span>{formatEngineCapacity(motorcycle.engine_capacity_cc)}</span>
                </div>
              )}
              
              {motorcycle.year && (
                <div className="flex items-center space-x-1">
                  <CalendarIcon className="w-3 h-3" />
                  <span>{motorcycle.year}</span>
                </div>
              )}
            </div>
            
            {/* Price */}
            <div className="text-right">
              <div className="text-sm font-bold text-gray-900">
                {price}
              </div>
              <div className="text-xs text-gray-500">
                {hasRateTiers ? 'starting from' : '/day'}
              </div>
            </div>
          </div>

          {/* Shop Information - Compact */}
          {showShopInfo && shop && (
            <div className="pt-2 border-t border-gray-100">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center space-x-1 flex-1 min-w-0">
                  <GlobeAltIcon className="w-3 h-3 text-gray-400 flex-shrink-0" />
                  <span className="font-medium line-clamp-1 text-gray-900 truncate">{shop.provider_name}</span>
                </div>
                
                {shop.rating && (
                  <div className="flex items-center space-x-1 flex-shrink-0 ml-2">
                    <StarIcon className="w-3 h-3 text-yellow-500 fill-current" />
                    <span className="font-medium text-gray-700">{shop.rating.toFixed(1)}</span>
                  </div>
                )}
              </div>
              
              <div className="flex items-center space-x-1 mt-1 text-xs text-gray-500">
                <MapPinIcon className="w-3 h-3 flex-shrink-0" />
                <span className="line-clamp-1 truncate">{location}</span>
              </div>
            </div>
          )}
        </div>
      </Card>
    </Link>
  )
} 