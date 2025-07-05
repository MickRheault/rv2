'use client'

import Link from 'next/link'
import { 
  MapPinIcon, 
  StarIcon, 
  CalendarIcon, 
  CogIcon, 
  ShieldCheckIcon, 
  PhoneIcon, 
  GlobeAltIcon, 
  ArrowTopRightOnSquareIcon 
} from '@heroicons/react/24/outline'
import { StarIcon as StarSolid } from '@heroicons/react/24/solid'
import { Card, CardHeader, CardTitle, CardContent, Badge, Button } from '@/components/ui'
import { FlagButton } from '@/components/common/FlagButton'
import { MotorcycleWithDetails } from '@/services/motorcycles'

interface MotorcycleDetailsProps {
  motorcycle: MotorcycleWithDetails
}

export default function MotorcycleDetails({ motorcycle }: MotorcycleDetailsProps) {
  const {
    model,
    year,
    engine_capacity_cc,
    rental_rate_per_day,
    rental_rate_currency,
    availability_status,
    brands,
    categories,
    rental_shops,
    motorcycle_features,
    specifications_details,
    conditions_details
  } = motorcycle

  const formatCurrency = (amount: number | null, currency: string | null) => {
    if (!amount || !currency) return 'Price on request'
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const formatLocation = () => {
    if (!rental_shops?.cities) return rental_shops?.full_address || 'Location not specified'
    
    const { cities } = rental_shops
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

  const getAvailabilityBadge = () => {
    switch (availability_status?.toLowerCase()) {
      case 'available':
        return <Badge variant="success">Available</Badge>
      case 'rented':
        return <Badge variant="danger">Currently Rented</Badge>
      case 'maintenance':
        return <Badge variant="warning">Under Maintenance</Badge>
      default:
        return <Badge variant="secondary">Status Unknown</Badge>
    }
  }

  const features = motorcycle_features?.filter(mf => mf.features).map(mf => mf.features!) || []
  const specifications = specifications_details as any || {}
  const conditions = conditions_details as any || {}

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold text-gray-900">
              {brands?.name} {model}
            </h1>
            {getAvailabilityBadge()}
          </div>
          <div className="flex items-center gap-2 text-gray-600">
            <CalendarIcon className="w-4 h-4" />
            <span>{year}</span>
            {categories && (
              <>
                <span>•</span>
                <span>{categories.name}</span>
              </>
            )}
            {engine_capacity_cc && (
              <>
                <span>•</span>
                <span>{engine_capacity_cc}cc</span>
              </>
            )}
          </div>
          <div className="mt-3">
            <FlagButton
              contentType="motorcycle"
              entityId={motorcycle.id}
              entityData={motorcycle}
              variant="link"
              className="text-gray-500 hover:text-red-600"
            />
          </div>
        </div>
        
        <div className="text-right">
          <div className="text-3xl font-bold text-blue-600">
            {formatCurrency(rental_rate_per_day, rental_rate_currency)}
          </div>
          <div className="text-gray-600">per day</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Specifications */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CogIcon className="w-5 h-5" />
                Specifications
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="font-medium">Brand</span>
                    <span>{brands?.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium">Model</span>
                    <span>{model}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium">Year</span>
                    <span>{year}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium">Category</span>
                    <span>{categories?.name}</span>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="font-medium">Engine</span>
                    <span>{engine_capacity_cc}cc</span>
                  </div>
                  {specifications.transmission && (
                    <div className="flex justify-between">
                      <span className="font-medium">Transmission</span>
                      <span>{specifications.transmission}</span>
                    </div>
                  )}
                  {specifications.fuel_type && (
                    <div className="flex justify-between">
                      <span className="font-medium">Fuel Type</span>
                      <span>{specifications.fuel_type}</span>
                    </div>
                  )}
                  {specifications.max_speed && (
                    <div className="flex justify-between">
                      <span className="font-medium">Max Speed</span>
                      <span>{specifications.max_speed}</span>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Features */}
          {features.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheckIcon className="w-5 h-5" />
                  Features & Inclusions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {features.map((feature) => (
                    <Badge key={feature.id} variant="secondary" className="text-sm border border-gray-300">
                      {feature.name}
                    </Badge>
                  ))}
                </div>
                {features.some(f => f.description) && (
                  <div className="mt-4 space-y-2">
                    {features
                      .filter(f => f.description)
                      .map((feature) => (
                        <div key={feature.id} className="text-sm text-gray-600">
                          <span className="font-medium">{feature.name}:</span> {feature.description}
                        </div>
                      ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Rental Conditions */}
          {conditions && Object.keys(conditions).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Rental Conditions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-sm">
                  {conditions.min_age && (
                    <div className="flex justify-between">
                      <span className="font-medium">Minimum Age</span>
                      <span>{conditions.min_age} years</span>
                    </div>
                  )}
                  {conditions.license_required && (
                    <div className="flex justify-between">
                      <span className="font-medium">License Required</span>
                      <span>{conditions.license_required}</span>
                    </div>
                  )}
                  {conditions.deposit && (
                    <div className="flex justify-between">
                      <span className="font-medium">Security Deposit</span>
                      <span>{formatCurrency(conditions.deposit, rental_rate_currency)}</span>
                    </div>
                  )}
                  {conditions.fuel_policy && (
                    <div className="flex justify-between">
                      <span className="font-medium">Fuel Policy</span>
                      <span>{conditions.fuel_policy}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Rental Shop Info */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Rental Shop</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold text-lg">{rental_shops?.provider_name}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <MapPinIcon className="w-4 h-4 text-gray-500" />
                  <span className="text-sm text-gray-600">{formatLocation()}</span>
                </div>
              </div>

              {rental_shops?.rating && (
                <div className="flex items-center gap-2">
                  <StarSolid className="w-4 h-4 text-yellow-400" />
                  <span className="font-medium">{rental_shops.rating.toFixed(1)}</span>
                  {rental_shops.review_count && (
                    <span className="text-gray-600 text-sm">
                      ({rental_shops.review_count} reviews)
                    </span>
                  )}
                </div>
              )}

              <div className="space-y-2">
                {rental_shops?.phone && (
                  <div className="flex items-center gap-2 text-sm">
                    <PhoneIcon className="w-4 h-4 text-gray-500" />
                    <a href={`tel:${rental_shops.phone}`} className="text-blue-600 hover:underline">
                      {rental_shops.phone}
                    </a>
                  </div>
                )}
                {rental_shops?.website && (
                  <div className="flex items-center gap-2 text-sm">
                    <GlobeAltIcon className="w-4 h-4 text-gray-500" />
                    <a 
                      href={rental_shops.website} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline flex items-center gap-1"
                    >
                      Visit Website
                      <ArrowTopRightOnSquareIcon className="w-3 h-3" />
                    </a>
                  </div>
                )}
              </div>

              <div className="pt-4 space-y-2">
                <Link href={`/shop/${rental_shops?.slug || rental_shops?.id}`}>
                  <Button className="w-full">
                    View Shop Details
                  </Button>
                </Link>
                <Button variant="outline" className="w-full">
                  Contact Shop
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" className="w-full">
                Add to Favorites
              </Button>
              <Button variant="outline" className="w-full">
                Add to Compare
              </Button>
              <Button variant="outline" className="w-full">
                Share Listing
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
} 