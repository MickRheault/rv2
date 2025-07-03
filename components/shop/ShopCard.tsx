import Link from 'next/link'
import { useState } from 'react'
import { clsx } from 'clsx'
import {
  StarIcon,
  MapPinIcon,
  PhoneIcon,
  GlobeAltIcon,
  HeartIcon,
  ShareIcon,
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

interface ShopCardProps {
  shop: ShopWithDetails
  showServices?: boolean
  showInclusions?: boolean
  compact?: boolean
  onFavoriteToggle?: (shopId: string, isFavorited: boolean) => void
  isFavorited?: boolean
  isPremium?: boolean
  premiumType?: 'gold' | 'platinum' | 'featured'
  className?: string
}

export default function ShopCard({ 
  shop, 
  showServices = true,
  showInclusions = true,
  compact = false,
  onFavoriteToggle,
  isFavorited = false,
  isPremium = false,
  premiumType = 'gold',
  className 
}: ShopCardProps) {
  const [showAllInclusions, setShowAllInclusions] = useState(false)
  
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

  // Handle favorite toggle
  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onFavoriteToggle?.(shop.id, !isFavorited)
  }

  // Handle share click
  const handleShareClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    // TODO: Implement share functionality
    console.log('Share shop:', shop.provider_name)
  }

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
    <Link href={`/shop/${shop.slug}`} className="block group">
      <Card className={clsx(
        'overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-1',
        compact ? 'h-auto' : 'h-full',
        isPremium && 'ring-2 ring-yellow-400 shadow-xl relative',
        isPremium && premiumType === 'featured' && 'ring-blue-500 shadow-blue-200',
        isPremium && premiumType === 'platinum' && 'ring-gray-400 shadow-gray-200',
        className
      )}>
        {/* Premium border glow effect */}
        {isPremium && (
          <div className={clsx(
            'absolute inset-0 rounded-2xl opacity-20 pointer-events-none',
            premiumType === 'gold' && 'bg-gradient-to-br from-yellow-400 to-yellow-600',
            premiumType === 'platinum' && 'bg-gradient-to-br from-gray-300 to-gray-500',
            premiumType === 'featured' && 'bg-gradient-to-br from-blue-500 to-purple-600 animate-pulse'
          )} />
        )}
        
        <CardHeader className={clsx('relative', compact ? 'p-3' : 'p-4')}>
          {/* Header with name and actions */}
          <div className="flex justify-between items-start mb-2">
            <div className="flex-1 min-w-0">
              <h3 className={clsx(
                'font-semibold text-gray-900 line-clamp-1',
                compact ? 'text-sm' : 'text-base'
              )}>
                {shop.provider_name}
              </h3>
              {shop.location_name && shop.location_name !== shop.provider_name && (
                <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">
                  {shop.location_name}
                </p>
              )}
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
              
              <button
                onClick={handleShareClick}
                className="p-1.5 hover:bg-gray-100 rounded-full transition-colors"
                aria-label="Share shop"
              >
                <ShareIcon className="w-4 h-4 text-gray-400" />
              </button>
            </div>
          </div>

          {/* Status badges */}
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            {isPremium && (
              <PremiumBadge type={premiumType} className="shadow-lg" />
            )}
            
            {isVerified && (
              <Badge variant="success" size="sm" className="flex items-center gap-1">
                <CheckCircleIcon className="w-3 h-3" />
                Verified
              </Badge>
            )}
            
            {businessStatus && !isVerified && (
              <Badge variant="secondary" size="sm" className="flex items-center gap-1">
                <ExclamationTriangleIcon className="w-3 h-3" />
                {businessStatus.status_code}
              </Badge>
            )}
            
            {tours.length > 0 && (
              <Badge variant="primary" size="sm" className="flex items-center gap-1">
                <MapIcon className="w-3 h-3" />
                Tours
              </Badge>
            )}
            
            {serviceLocations.length > 1 && (
              <Badge variant="secondary" size="sm" className="flex items-center gap-1">
                <TruckIcon className="w-3 h-3" />
                Delivery
              </Badge>
            )}
          </div>

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

          {/* Services */}
          {showServices && (tours.length > 0 || serviceLocations.length > 0) && !compact && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-gray-900">Services</h4>
              <div className="space-y-1">
                {tours.length > 0 && (
                  <div className="flex items-center space-x-2 text-sm text-gray-600">
                    <MapIcon className="w-4 h-4" />
                    <span>{tours.length} tour{tours.length > 1 ? 's' : ''} available</span>
                  </div>
                )}
                
                {serviceLocations.length > 0 && (
                  <div className="flex items-center space-x-2 text-sm text-gray-600">
                    <TruckIcon className="w-4 h-4" />
                    <span>
                      {serviceLocations.length > 1 
                        ? `${serviceLocations.length} pickup locations`
                        : 'Pickup available'
                      }
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Inclusions */}
          {showInclusions && inclusions.length > 0 && !compact && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-gray-900">Included</h4>
              <div className="space-y-1">
                {inclusions
                  .slice(0, showAllInclusions ? inclusions.length : 3)
                  .map((inclusion) => (
                    <div key={inclusion.id} className="flex items-center space-x-2 text-sm text-gray-600">
                      <CheckCircleIcon className="w-3 h-3 text-green-500 flex-shrink-0" />
                      <span className="line-clamp-1">{inclusion.inclusion_text}</span>
                    </div>
                  ))}
                
                {inclusions.length > 3 && (
                  <button
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      setShowAllInclusions(!showAllInclusions)
                    }}
                    className="text-xs text-blue-600 hover:text-blue-800 transition-colors"
                  >
                    {showAllInclusions 
                      ? 'Show less' 
                      : `+${inclusions.length - 3} more`
                    }
                  </button>
                )}
              </div>
            </div>
          )}

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
              <Button variant="outline" size="sm" className="flex-1">
                View Details
              </Button>
              
              <Button variant="primary" size="sm" className="flex-1">
                Browse Bikes
              </Button>
            </div>
          </CardFooter>
        )}
      </Card>
    </Link>
  )
} 