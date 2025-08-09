'use client'

import Link from 'next/link'
import { 
  StarIcon, 
  MapPinIcon, 
  PhoneIcon, 
  GlobeAltIcon, 
  ArrowTopRightOnSquareIcon,
  CheckIcon,
  TruckIcon,
  MapIcon,
  BuildingStorefrontIcon,
  DocumentTextIcon
} from '@heroicons/react/24/outline'
import { StarIcon as StarSolid } from '@heroicons/react/24/solid'
import { Card, CardHeader, CardTitle, CardContent, Badge, Button } from '@/components/ui'
import { ShopWithMotorcycles } from '@/services/shops'
import MotorcycleCard from '@/components/motorcycle/MotorcycleCard'
import GoogleMap from './GoogleMap'
import { PremiumFeatureConfig } from '@/types/premium-listings'

interface ShopDetailsProps {
  shop: ShopWithMotorcycles
  premium?: PremiumFeatureConfig
}

export default function ShopDetails({ shop, premium }: ShopDetailsProps) {
  const {
    provider_name,
    business_description,
    full_address,
    phone,
    website,
    rating,
    review_count,
    latitude,
    longitude,
    google_maps_url,
    place_id,
    cities,
    business_statuses,
    rental_shop_inclusions,
    rental_shop_tours,
    rental_shop_service_locations,
    rental_shop_conditions,
    motorcycle_rentals
  } = shop

  const formatLocation = () => {
    if (!cities) return full_address
    
    const parts = []
    if (cities.name) parts.push(cities.name)
    if (cities.provinces?.name && cities.provinces.name !== cities.name) {
      parts.push(cities.provinces.name)
    }
    if (cities.provinces?.countries?.name) {
      parts.push(cities.provinces.countries.name)
    }
    
    return parts.join(', ')
  }

  const getBusinessStatusBadge = () => {
    if (!business_statuses) return null
    
    const status = business_statuses.status_code.toLowerCase()
    switch (status) {
      case 'active':
        return <Badge variant="success">Active</Badge>
      case 'temporarily_closed':
        return <Badge variant="warning">Temporarily Closed</Badge>
      case 'permanently_closed':
        return <Badge variant="danger">Permanently Closed</Badge>
      default:
        return <Badge variant="secondary">{business_statuses.status_code}</Badge>
    }
  }

  return (
    <div className="space-y-8">
      {/* Shop Header */}
      <div className={`bg-white rounded-lg shadow-sm border p-6 ${premium?.isPremium ? 'ring-2 ring-yellow-400 shadow-lg' : ''}`}>
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-3 flex-wrap">
              <h1 className="text-3xl font-bold text-gray-900">{provider_name}</h1>
              
              {premium?.isPremium && (
                <Badge variant={premium.premiumType} size="md" className="shadow-lg">
                  {premium.premiumType === 'gold' && '⭐ Premium'}
                  {premium.premiumType === 'platinum' && '💎 Premium+'}
                  {premium.premiumType === 'featured' && '🌟 Featured'}
                </Badge>
              )}
              
              {getBusinessStatusBadge()}
            </div>
            
            {premium?.isPremium && premium.daysRemaining && premium.daysRemaining <= 7 && (
              <div className="mb-3">
                <Badge variant="warning" size="sm">
                  ⏰ Premium expires in {premium.daysRemaining} day{premium.daysRemaining > 1 ? 's' : ''}
                </Badge>
              </div>
            )}
            
            <div className="flex items-center gap-2 text-gray-600 mb-4">
              <MapPinIcon className="w-5 h-5" />
              <span>{formatLocation()}</span>
            </div>

            {rating && (
              <div className="flex items-center gap-2 mb-4">
                <div className="flex items-center">
                  {[...Array(5)].map((_, i) => (
                    <StarSolid
                      key={i}
                      className={`w-5 h-5 ${
                        i < Math.floor(rating) ? 'text-yellow-400' : 'text-gray-300'
                      }`}
                    />
                  ))}
                </div>
                <span className="font-medium text-lg">{rating.toFixed(1)}</span>
                {review_count && (
                  <span className="text-gray-600">
                    ({review_count} {review_count === 1 ? 'review' : 'reviews'})
                  </span>
                )}
              </div>
            )}

            {business_description && (
              <p className="text-gray-700 leading-relaxed">{business_description}</p>
            )}
          </div>

          {/* Contact Actions */}
          <div className="lg:min-w-[240px] space-y-3">
            {phone && (
              <a href={`tel:${phone}`} className="w-full">
                <Button variant="primary" className="w-full flex items-center gap-2">
                  <PhoneIcon className="w-4 h-4" />
                  Call Shop
                </Button>
              </a>
            )}
            
            {website && (
              <a 
                href={website} 
                target="_blank" 
                rel="noopener noreferrer"
                className="w-full"
              >
                <Button variant="outline" className="w-full flex items-center gap-2">
                  <GlobeAltIcon className="w-4 h-4" />
                  Visit Website
                  <ArrowTopRightOnSquareIcon className="w-3 h-3" />
                </Button>
              </a>
            )}

            <Button variant="outline" className="w-full">
              Share Shop
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-8">
          {/* Inclusions */}
          {rental_shop_inclusions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckIcon className="w-5 h-5" />
                  What&apos;s Included
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {rental_shop_inclusions.map((inclusion) => (
                    <div key={inclusion.id} className="flex items-center gap-2">
                      <CheckIcon className="w-4 h-4 text-green-600 flex-shrink-0" />
                      <span className="text-gray-700">{inclusion.inclusion_text}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Rental Conditions */}
          {rental_shop_conditions && rental_shop_conditions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DocumentTextIcon className="w-5 h-5" />
                  Rental Conditions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {rental_shop_conditions.map((condition) => (
                    <div key={condition.id} className="border border-gray-200 rounded-lg p-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-medium text-gray-900 text-sm">
                            {condition.condition_types?.name}
                          </h4>
                          {condition.condition_types?.description && (
                            <p className="text-xs text-gray-500 mt-1">
                              {condition.condition_types.description}
                            </p>
                          )}
                          <p className="text-sm text-gray-700 mt-1 font-medium">
                            {condition.condition_value}
                          </p>
                          {condition.notes && (
                            <p className="text-xs text-gray-600 mt-1">
                              {condition.notes}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Tours */}
          {rental_shop_tours.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapIcon className="w-5 h-5" />
                  Tours Available
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {rental_shop_tours.map((tour) => (
                    <div key={tour.id} className="border border-gray-200 rounded-lg p-4">
                      <h4 className="font-semibold text-gray-900 mb-2">{tour.name}</h4>
                      <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                        {tour.duration_text && (
                          <span>Duration: {tour.duration_text}</span>
                        )}
                        {tour.distance_km && (
                          <span>Distance: {tour.distance_km} km</span>
                        )}
                        {tour.price_text && (
                          <span className="font-medium text-gray-900">
                            Price: {tour.price_text}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Service Locations */}
          {rental_shop_service_locations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TruckIcon className="w-5 h-5" />
                  Pickup & Drop-off Locations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {rental_shop_service_locations.map((location) => (
                    <div key={location.id} className="flex items-center gap-2">
                      <MapPinIcon className="w-4 h-4 text-blue-600 flex-shrink-0" />
                      <span className="text-gray-700">{location.location_name}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Available Motorcycles */}
          {motorcycle_rentals.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BuildingStorefrontIcon className="w-5 h-5" />
                  Available Motorcycles ({motorcycle_rentals.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {motorcycle_rentals.slice(0, 6).map((motorcycle) => (
                    <MotorcycleCard 
                      key={motorcycle.id} 
                      motorcycle={motorcycle as any}
                      showShopInfo={false}
                      compact={true}
                    />
                  ))}
                </div>
                
                {motorcycle_rentals.length > 6 && (
                  <div className="mt-6 text-center">
                    <Link href={`/search?shop=${shop.id}`}>
                      <Button variant="outline">
                        View All {motorcycle_rentals.length} Motorcycles
                      </Button>
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Premium Status */}
          {premium?.isPremium && (
            <Card className="border-yellow-200 bg-gradient-to-br from-yellow-50 to-orange-50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="text-yellow-600">
                    {premium.premiumType === 'gold' && '⭐'}
                    {premium.premiumType === 'platinum' && '💎'}
                    {premium.premiumType === 'featured' && '🌟'}
                  </span>
                  Premium Shop
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Tier</span>
                  {premium.premiumType && (
                    <Badge variant={premium.premiumType} size="sm">
                      {premium.premiumType.charAt(0).toUpperCase() + premium.premiumType.slice(1)}
                    </Badge>
                  )}
                </div>
                
                {premium.boostScore && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Boost Score</span>
                    <span className="font-medium text-yellow-600">+{premium.boostScore}%</span>
                  </div>
                )}
                
                {premium.daysRemaining && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Days Remaining</span>
                    <span className={`font-medium ${premium.daysRemaining <= 7 ? 'text-red-600' : 'text-green-600'}`}>
                      {premium.daysRemaining}
                    </span>
                  </div>
                )}
                
                {premium.endDate && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Expires</span>
                    <span className="font-medium text-gray-900">
                      {new Date(premium.endDate).toLocaleDateString()}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Location & Map */}
          <Card>
            <CardHeader>
              <CardTitle>Location</CardTitle>
            </CardHeader>
            <CardContent>
              <GoogleMap
                latitude={latitude}
                longitude={longitude}
                shopName={provider_name}
                address={full_address}
                googleMapsUrl={google_maps_url}
                placeId={place_id}
              />
            </CardContent>
          </Card>

          {/* Contact Information */}
          <Card>
            <CardHeader>
              <CardTitle>Contact Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Address</h4>
                <p className="text-gray-600 text-sm">{full_address}</p>
              </div>
              
              {phone && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Phone</h4>
                  <a 
                    href={`tel:${phone}`}
                    className="text-blue-600 hover:underline text-sm"
                  >
                    {phone}
                  </a>
                </div>
              )}
              
              {website && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Website</h4>
                  <a 
                    href={website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline text-sm break-all"
                  >
                    {website.replace(/^https?:\/\//, '')}
                  </a>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Stats */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Stats</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Motorcycles</span>
                <span className="font-medium">{motorcycle_rentals.length}</span>
              </div>
              
              {rating && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Rating</span>
                  <span className="font-medium">{rating.toFixed(1)}/5</span>
                </div>
              )}
              
              {review_count && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Reviews</span>
                  <span className="font-medium">{review_count}</span>
                </div>
              )}
              
              <div className="flex justify-between">
                <span className="text-gray-600">Tours</span>
                <span className="font-medium">{rental_shop_tours.length}</span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-gray-600">Service Locations</span>
                <span className="font-medium">{rental_shop_service_locations.length}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
} 