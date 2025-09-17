import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { clsx } from 'clsx'
import {
  StarIcon,
  MapPinIcon,
  PhoneIcon,
  GlobeAltIcon,
  HeartIcon,
  ClockIcon,
  TruckIcon,
  MapIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline'
import { HeartIcon as HeartSolid, StarIcon as StarSolid } from '@heroicons/react/24/solid'
import { Card, CardContent, CardFooter, CardHeader, Badge, PremiumBadge } from '@/components/ui'
import Button from '@/components/ui/Button'
import { ShopWithDetails } from '@/services/shops'
import { PremiumTier, PremiumStatus, PremiumFeatureConfig } from '@/types/premium-listings'
import { getShopUrl } from '@/lib/utils/urls'

interface ShopCardProps {
  shop: ShopWithDetails
  showServices?: boolean
  showInclusions?: boolean
  compact?: boolean
  onFavoriteToggle?: (shopId: string, isFavorited: boolean) => void
  isFavorited?: boolean
  premium?: PremiumFeatureConfig
  className?: string
}

export default function ShopCard({ 
  shop, 
  showServices = false,
  showInclusions = false,
  compact = false,
  onFavoriteToggle,
  isFavorited = false,
  premium,
  className 
}: ShopCardProps) {
  const [showAllInclusions, setShowAllInclusions] = useState(false)
  const router = useRouter()
  
  // Get location string
  const location = shop.cities 
    ? `${shop.cities.name}, ${shop.cities.provinces?.name || ''}`
    : shop.full_address || 'Location not specified'

  // Get business status info
  const businessStatus = shop.business_statuses
  const isVerified = businessStatus?.status_code === 'verified' || businessStatus?.status_code === 'active'
  
  // Get services
  const tours = shop.rental_shop_tours || []
  const serviceLocations = shop.rental_shop_service_locations || []
  const inclusions = shop.rental_shop_inclusions || []

  // Premium status
  const isPremium = premium?.isPremium ?? false
  const premiumType = premium?.premiumType ?? 'gold'
  


  // Handle card click for navigation
  const handleCardClick = (e: React.MouseEvent) => {
    // Don't navigate if clicking on interactive elements
    const target = e.target as HTMLElement
    if (
      target.closest('button') ||
      target.closest('a') ||
      target.tagName === 'BUTTON' ||
      target.tagName === 'A'
    ) {
      return
    }
    router.push(getShopUrl(shop))
  }

  // Handle favorite toggle
  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onFavoriteToggle?.(shop.id, !isFavorited)
  }

  // Share removed per UI cleanup

  // Render star rating
  const renderStars = (rating: number) => {
    const stars = []
    const fullStars = Math.floor(rating)
    const hasHalfStar = rating % 1 >= 0.5
    
    for (let i = 0; i < 5; i++) {
      if (i < fullStars) {
        stars.push(
          <StarSolid key={i} className="w-4 h-4 text-yellow-400" />
        )
      } else if (i === fullStars && hasHalfStar) {
        stars.push(
          <div key={i} className="relative w-4 h-4">
            <StarIcon className="absolute inset-0 w-4 h-4 text-gray-300" />
            <div className="absolute inset-0 w-1/2 overflow-hidden">
              <StarSolid className="w-4 h-4 text-yellow-400" />
            </div>
          </div>
        )
      } else {
        stars.push(
          <StarIcon key={i} className="w-4 h-4 text-gray-300" />
        )
      }
    }
    return stars
  }

  return (
    <Card 
      className={clsx(
        'overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-1 cursor-pointer group',
        compact ? 'h-auto' : 'h-full',
        className
      )}
      onClick={handleCardClick}
    >
        
        <CardHeader className={clsx('relative', compact ? 'p-3' : 'p-4')}>
          {/* Header with name and actions */}
          <div className="flex justify-between items-start mb-1">
            <div className="flex-1 min-w-0">
              <h3 className={clsx(
                'font-semibold text-gray-900 line-clamp-1',
                compact ? 'text-sm' : 'text-base'
              )}>
                {shop.provider_name}
              </h3>
              {/* Removed secondary location/slug line under the title */}
            </div>
            
            {/* Action buttons */}
            <div className="flex space-x-1 ml-2">
              {onFavoriteToggle && (
                <button
                  onClick={handleFavoriteClick}
                  className="p-1.5 hover:bg-gray-100 rounded-full transition-colors"
                  aria-label={isFavorited ? 'Remove from favorites' : 'Add to favorites'}
                >
                  {isFavorited ? (
                    <HeartSolid className="w-4 h-4 text-red-500" />
                  ) : (
                    <HeartIcon className="w-4 h-4 text-gray-400" />
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Status badges */}
          {/* Keep only Premium badge; render container only when present to avoid extra spacing */}
          {isPremium && (
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <div className="flex items-center gap-1">
                <Badge variant={premiumType} size="sm">
                  {premiumType === 'gold' && '⭐ Premium'}
                  {premiumType === 'platinum' && '💎 Premium+'}
                  {premiumType === 'featured' && '🌟 Featured'}
                </Badge>
                {premium?.daysRemaining && premium.daysRemaining <= 7 && (
                  <Badge variant="warning" size="sm">
                    {premium.daysRemaining}d left
                  </Badge>
                )}
              </div>
            </div>
          )}

          {/* Rating and location */}
          <div className="space-y-2">
            {/* Rating */}
            {shop.rating && (
              <div className="flex items-center space-x-2">
                <div className="flex items-center space-x-1">
                  {renderStars(shop.rating)}
                </div>
                <span className={clsx(
                  'font-medium text-gray-900',
                  compact ? 'text-sm' : 'text-base'
                )}>
                  {shop.rating.toFixed(1)}
                </span>
                {shop.review_count && (
                  <span className="text-xs text-gray-500">
                    ({shop.review_count} reviews)
                  </span>
                )}
              </div>
            )}

            {/* Location */}
            <div className="flex items-start space-x-1 text-sm text-gray-600">
              <MapPinIcon className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span className="line-clamp-2">{location}</span>
            </div>
          </div>
        </CardHeader>

        <CardContent className={clsx('space-y-3', compact ? 'p-3 pt-0' : 'p-4 pt-0')}>
          {/* Bike types (categories) */}
          {(() => {
            const categoryNames = shop.category_names || []
            if (!categoryNames || categoryNames.length === 0 || compact) return null
            const maxToShow = 5
            const shown = categoryNames.slice(0, maxToShow)
            const remaining = categoryNames.length - shown.length
            return (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-gray-900">Bike types</h4>
                <div className="flex flex-wrap gap-2">
                  {shown.map((name) => (
                    <Badge key={name} variant="secondary" size="sm">
                      {name}
                    </Badge>
                  ))}
                  {remaining > 0 && (
                    <Badge variant="secondary" size="sm">+{remaining} more</Badge>
                  )}
                </div>
              </div>
            )
          })()}
          {/* Business description */}
          {shop.business_description && !compact && (
            <p className="text-sm text-gray-600 line-clamp-2">
              {shop.business_description}
            </p>
          )}

          {/* Contact information */}
          <div className="space-y-1">
            {shop.phone && (
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <PhoneIcon className="w-4 h-4" />
                <a 
                  href={`tel:${shop.phone}`}
                  className="hover:text-blue-600 transition-colors"
                  onClick={(e) => e.stopPropagation()}
                >
                  {shop.phone}
                </a>
              </div>
            )}
            
            {shop.website && (
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <GlobeAltIcon className="w-4 h-4" />
                <a 
                  href={shop.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-blue-600 transition-colors truncate"
                  onClick={(e) => e.stopPropagation()}
                >
                  {shop.website.replace(/^https?:\/\//, '')}
                </a>
              </div>
            )}
          </div>

          {/* Services and Inclusions removed per design update */}

          {/* Compact view summary */}
          {compact && (inclusions.length > 0 || tours.length > 0) && (
            <div className="flex items-center space-x-3 text-xs text-gray-500">
              {inclusions.length > 0 && (
                <span>{inclusions.length} inclusions</span>
              )}
              {tours.length > 0 && (
                <span>{tours.length} tours</span>
              )}
              {serviceLocations.length > 1 && (
                <span>Multiple locations</span>
              )}
            </div>
          )}
        </CardContent>

        {!compact && (
          <CardFooter className="p-4 pt-0">
            <div className="flex w-full gap-2">
              <a
                href={getShopUrl(shop)}
                onClick={(e) => e.stopPropagation()}
                className="flex-1"
              >
                <Button variant="outline" size="sm" className="w-full">
                  View Details
                </Button>
              </a>
              <a
                href={getShopUrl(shop)}
                onClick={(e) => e.stopPropagation()}
                className="flex-1"
              >
                <Button variant="primary" size="sm" className="w-full">
                  Browse Bikes
                </Button>
              </a>
            </div>
          </CardFooter>
        )}
    </Card>
  )
} 