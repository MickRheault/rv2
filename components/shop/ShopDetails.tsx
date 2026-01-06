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
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell
} from '@/components/ui/Table'
import { ShopWithMotorcycles } from '@/services/shops'
import MotorcycleCard from '@/components/motorcycle/MotorcycleCard'
import GoogleMap from './GoogleMap'
import { PremiumFeatureConfig } from '@/types/premium-listings'
import { formatCurrency, formatEngineCapacity } from '@/lib/utils'

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

  // Operational status badge removed per UI cleanup

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

              {/* Operational status removed per UI cleanup */}
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
                      className={`w-5 h-5 ${i < Math.floor(rating) ? 'text-yellow-400' : 'text-gray-300'
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
          <div className="lg:min-w-[240px] space-y-4">
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

            {/* Removed Share Shop per UI cleanup */}
          </div>
        </div>
        {/* Available Motorcycles moved under header */}
        {motorcycle_rentals.length > 0 && (
          <div className="mt-4">
            <div className="flex items-center gap-2 mb-2">
              <BuildingStorefrontIcon className="w-4 h-4 text-gray-400" />
              <h2 className="text-base font-bold text-gray-900">
                Motorcycles Available ({motorcycle_rentals.length})
              </h2>
            </div>

            {/* Table View */}
            <div className="mb-2 overflow-hidden">
              <Table className="w-full text-[11px] border-collapse">
                <TableHeader className="bg-transparent">
                  <TableRow className="border-b border-gray-100 hover:bg-transparent">
                    <TableHead className="py-1 px-0 text-left font-bold uppercase tracking-tighter text-[9px] text-gray-400">Bike</TableHead>
                    <TableHead className="py-1 px-0 text-center font-bold uppercase tracking-tighter text-[9px] text-gray-400 w-8">CC</TableHead>
                    <TableHead className="py-1 px-0 text-right font-bold uppercase tracking-tighter text-[9px] text-gray-400 w-12">Price</TableHead>
                    <TableHead className="py-1 px-0 text-right font-bold uppercase tracking-tighter text-[9px] text-gray-400 w-10">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y-0">
                  {motorcycle_rentals.map((motorcycle) => {
                    // Get best rate
                    const getBestRate = () => {
                      if (motorcycle.rental_rate_tiers && motorcycle.rental_rate_tiers.length > 0) {
                        const dailyRate = motorcycle.rental_rate_tiers.find((tier) => tier.min_days === 1)
                        if (dailyRate) {
                          return { amount: dailyRate.rate_per_day, currency: dailyRate.currency }
                        }
                        const lowestRate = motorcycle.rental_rate_tiers.reduce((prev, current) =>
                          prev.rate_per_day < current.rate_per_day ? prev : current
                        )
                        return { amount: lowestRate.rate_per_day, currency: lowestRate.currency }
                      }
                      return {
                        amount: motorcycle.rental_rate_per_day,
                        currency: motorcycle.rental_rate_currency
                      }
                    }

                    const bestRate = getBestRate()
                    const price = bestRate.amount
                      ? formatCurrency(bestRate.amount, bestRate.currency || 'USD')
                      : 'On request'

                    return (
                      <TableRow key={motorcycle.id} className="hover:bg-gray-50/30 border-b border-gray-50 last:border-0">
                        <TableCell className="py-0.5 px-0 font-medium leading-tight">
                          <span className="line-clamp-1">
                            {motorcycle.brands?.name} {motorcycle.model}
                          </span>
                        </TableCell>
                        <TableCell className="py-0.5 px-0 text-center text-gray-400 whitespace-nowrap">
                          {motorcycle.engine_capacity_cc || '-'}
                        </TableCell>
                        <TableCell className="py-0.5 px-0 text-right font-bold text-gray-900 whitespace-nowrap">
                          {price}
                        </TableCell>
                        <TableCell className="py-0.5 px-0 text-right">
                          <Link
                            href={`/motorcycle/${motorcycle.id}`}
                            className="text-blue-600 font-bold"
                          >
                            View
                          </Link>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
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

          {/* Available Motorcycles moved to the top under header per UI cleanup */}
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

          {/* Quick Stats removed per UI cleanup */}
        </div>
      </div>
    </div>
  )
} 