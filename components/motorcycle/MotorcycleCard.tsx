'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import { clsx } from 'clsx'
import {
  HeartIcon,
  ShareIcon,
  MapPinIcon,
  StarIcon,
  CalendarIcon,
  CogIcon,
  ShieldCheckIcon,
  WifiIcon,
  GlobeAltIcon
} from '@heroicons/react/24/outline'
import { HeartIcon as HeartSolid } from '@heroicons/react/24/solid'
import { Card, CardContent, CardFooter, CardHeader, Badge } from '@/components/ui'
import Button from '@/components/ui/Button'
import { MotorcycleWithDetails } from '@/services/motorcycles'
import { formatCurrency, formatEngineCapacity } from '@/lib/utils'

interface MotorcycleCardProps {
  motorcycle: MotorcycleWithDetails
  showShopInfo?: boolean
  showFeatures?: boolean
  compact?: boolean
  onFavoriteToggle?: (motorcycleId: string, isFavorited: boolean) => void
  isFavorited?: boolean
  className?: string
}

export default function MotorcycleCard({ 
  motorcycle, 
  showShopInfo = true,
  showFeatures = true,
  compact = false,
  onFavoriteToggle,
  isFavorited = false,
  className 
}: MotorcycleCardProps) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [imageError, setImageError] = useState(false)
  
  const shop = motorcycle.rental_shops
  const brand = motorcycle.brands
  const category = motorcycle.categories
  
  // Get sorted images
  const images = motorcycle.motorcycle_images
    ?.filter(img => img.images?.url)
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
    .map(img => img.images!) || []
  
  // Get features
  const features = motorcycle.motorcycle_features
    ?.filter(f => f.features)
    .map(f => f.features!)
    .slice(0, compact ? 3 : 5) || []
  
  // Get location string
  const location = shop?.cities 
    ? `${shop.cities.name}, ${shop.cities.provinces?.name || ''}`
    : shop?.full_address || 'Location not specified'

  // Format pricing
  const price = motorcycle.rental_rate_per_day 
    ? formatCurrency(motorcycle.rental_rate_per_day, motorcycle.rental_rate_currency || 'USD')
    : 'Price on request'

  // Get primary image
  const primaryImage = images[currentImageIndex] || images[0]
  const fallbackImage = '/api/placeholder/400/300'

  // Handle favorite toggle
  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onFavoriteToggle?.(motorcycle.id, !isFavorited)
  }

  // Handle image navigation
  const nextImage = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (images.length > 1) {
      setCurrentImageIndex((prev) => (prev + 1) % images.length)
    }
  }

  const prevImage = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (images.length > 1) {
      setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length)
    }
  }

  // Get feature icon
  const getFeatureIcon = (featureName: string) => {
    const name = featureName.toLowerCase()
    if (name.includes('abs') || name.includes('brake')) return <ShieldCheckIcon className="w-3 h-3" />
    if (name.includes('gps') || name.includes('navigation')) return <MapPinIcon className="w-3 h-3" />
    if (name.includes('wifi') || name.includes('internet')) return <WifiIcon className="w-3 h-3" />
    if (name.includes('helmet')) return <ShieldCheckIcon className="w-3 h-3" />
    return <CogIcon className="w-3 h-3" />
  }

  return (
    <Link href={`/motorcycle/${motorcycle.id}`} className="block group">
      <Card className={clsx(
        'overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-1',
        compact ? 'h-auto' : 'h-full',
        className
      )}>
        <CardHeader className="p-0 relative">
          {/* Motorcycle Image */}
          <div className={clsx(
            'relative w-full overflow-hidden bg-gray-100',
            compact ? 'h-40' : 'h-48'
          )}>
            <Image
              src={!imageError && primaryImage?.url ? primaryImage.url : fallbackImage}
              alt={primaryImage?.alt_text || `${brand?.name || ''} ${motorcycle.model || 'Motorcycle'}`}
              fill
              className="object-cover transition-transform duration-300 group-hover:scale-105"
              onError={() => setImageError(true)}
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            />
            
            {/* Image Navigation */}
            {images.length > 1 && !compact && (
              <>
                <button
                  onClick={prevImage}
                  className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/20 hover:bg-black/40 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label="Previous image"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <button
                  onClick={nextImage}
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/20 hover:bg-black/40 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label="Next image"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
                
                {/* Image indicators */}
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex space-x-1">
                  {images.map((_, index) => (
                    <div
                      key={index}
                      className={clsx(
                        'w-1.5 h-1.5 rounded-full transition-colors',
                        index === currentImageIndex ? 'bg-white' : 'bg-white/50'
                      )}
                    />
                  ))}
                </div>
              </>
            )}
            
            {/* Overlays */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
            
            {/* Top row: Category and Actions */}
            <div className="absolute top-3 left-3 right-3 flex justify-between items-start">
              {/* Category Badge */}
              {category && (
                <Badge variant="primary" size="sm" className="bg-blue-600 text-white">
                  {category.name}
                </Badge>
              )}
              
              {/* Action buttons */}
              <div className="flex space-x-1">
                {onFavoriteToggle && (
                  <button
                    onClick={handleFavoriteClick}
                    className="p-1.5 bg-white/90 hover:bg-white rounded-full transition-colors backdrop-blur-sm"
                    aria-label={isFavorited ? 'Remove from favorites' : 'Add to favorites'}
                  >
                    {isFavorited ? (
                      <HeartSolid className="w-4 h-4 text-red-500" />
                    ) : (
                      <HeartIcon className="w-4 h-4 text-gray-600" />
                    )}
                  </button>
                )}
                
                <button
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    // TODO: Implement share functionality
                  }}
                  className="p-1.5 bg-white/90 hover:bg-white rounded-full transition-colors backdrop-blur-sm"
                  aria-label="Share motorcycle"
                >
                  <ShareIcon className="w-4 h-4 text-gray-600" />
                </button>
              </div>
            </div>
            
            {/* Price Badge */}
            <div className="absolute bottom-3 right-3">
              <div className="bg-white/95 backdrop-blur-sm rounded-lg px-2 py-1">
                <div className="text-sm font-bold text-gray-900">
                  {price}
                  {motorcycle.rental_rate_per_day && (
                    <span className="text-xs text-gray-600 ml-1">/day</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className={clsx('space-y-3', compact ? 'p-3' : 'p-4')}>
          {/* Motorcycle Title */}
          <div>
            <h3 className={clsx(
              'font-semibold text-gray-900 line-clamp-1',
              compact ? 'text-sm' : 'text-base'
            )}>
              {brand?.name} {motorcycle.model}
            </h3>
            {motorcycle.year && (
              <p className="text-xs text-gray-500 mt-0.5">
                {motorcycle.year} Model
              </p>
            )}
          </div>

          {/* Specifications */}
          <div className="flex items-center space-x-4 text-xs text-gray-600">
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
            
            {motorcycle.availability_status && (
              <div className="flex items-center space-x-1">
                <div className={clsx(
                  'w-2 h-2 rounded-full',
                  motorcycle.availability_status === 'available' ? 'bg-green-500' : 'bg-orange-500'
                )} />
                <span className="capitalize">{motorcycle.availability_status}</span>
              </div>
            )}
          </div>

          {/* Features */}
          {showFeatures && features.length > 0 && (
            <div className="space-y-1">
              <div className="flex flex-wrap gap-1">
                {features.map((feature) => (
                  <div
                    key={feature.id}
                    className="flex items-center space-x-1 bg-gray-100 rounded-full px-2 py-1 text-xs text-gray-700"
                    title={feature.description || feature.name}
                  >
                    {getFeatureIcon(feature.name)}
                    <span className="truncate max-w-20">{feature.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Shop Information */}
          {showShopInfo && shop && !compact && (
            <div className="pt-2 border-t border-gray-100 space-y-1">
              <div className="flex items-center space-x-1 text-sm">
                <GlobeAltIcon className="w-3 h-3 text-gray-400" />
                <span className="font-medium line-clamp-1 text-gray-900">{shop.provider_name}</span>
              </div>
              
              <div className="flex items-center justify-between text-xs text-gray-600">
                <div className="flex items-center space-x-1">
                  <MapPinIcon className="w-3 h-3" />
                  <span className="line-clamp-1">{location}</span>
                </div>
                
                {shop.rating && (
                  <div className="flex items-center space-x-1">
                    <StarIcon className="w-3 h-3 text-yellow-500 fill-current" />
                    <span className="font-medium">{shop.rating.toFixed(1)}</span>
                    {shop.review_count && (
                      <span className="text-gray-500">({shop.review_count})</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>

        {!compact && (
          <CardFooter className="p-4 pt-0">
            <div className="flex w-full gap-2">
              <Button variant="outline" size="sm" className="flex-1">
                View Details
              </Button>
              
              {shop && (
                <Button variant="primary" size="sm" className="flex-1">
                  Visit Shop
                </Button>
              )}
            </div>
          </CardFooter>
        )}
      </Card>
    </Link>
  )
} 