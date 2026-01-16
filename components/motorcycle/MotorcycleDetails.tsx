'use client'

import Link from 'next/link'
import Image from 'next/image'
import {
  MapPinIcon,
  StarIcon,
  CalendarIcon,
  CogIcon,
  ShieldCheckIcon,
  PhoneIcon,
  GlobeAltIcon,
  ArrowTopRightOnSquareIcon,
  DocumentTextIcon,
  CurrencyDollarIcon
} from '@heroicons/react/24/outline'
import { StarIcon as StarSolid } from '@heroicons/react/24/solid'
import { Card, CardHeader, CardTitle, CardContent, Badge, Button } from '@/components/ui'
import { FlagButton } from '@/components/common/FlagButton'
import { MotorcycleWithDetails } from '@/services/motorcycles'
import { getShopUrl } from '@/lib/utils/urls'
import SameModelWidget from '@/components/motorcycle/SameModelWidget'

interface MotorcycleDetailsProps {
  motorcycle: MotorcycleWithDetails
  sameModelCount?: number
  countryName?: string
}

export default function MotorcycleDetails({
  motorcycle,
  sameModelCount = 0,
  countryName = ''
}: MotorcycleDetailsProps) {
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
    motorcycle_conditions,
    rental_rate_tiers,
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

  // Availability badge removed per UI cleanup

  const features = motorcycle_features?.filter(mf => mf.features).map(mf => mf.features!) || []
  const specifications = specifications_details as any || {}
  const conditions = conditions_details as any || {}

  // Get the best (lowest) daily rate from rate tiers or fallback to base rate
  const getBestRate = () => {
    if (rental_rate_tiers && rental_rate_tiers.length > 0) {
      // Find the rate with min_days = 1 (daily rate) or the lowest rate
      const dailyRate = rental_rate_tiers.find(tier => tier.min_days === 1)
      if (dailyRate) {
        return { amount: dailyRate.rate_per_day, currency: dailyRate.currency }
      }
      // If no daily rate, get the lowest rate
      const lowestRate = rental_rate_tiers.reduce((prev, current) =>
        prev.rate_per_day < current.rate_per_day ? prev : current
      )
      return { amount: lowestRate.rate_per_day, currency: lowestRate.currency }
    }
    return { amount: rental_rate_per_day, currency: rental_rate_currency }
  }

  const bestRate = getBestRate()

  // Format duration text for rate tiers
  const formatDuration = (minDays: number, maxDays: number | null) => {
    if (minDays === 1 && (!maxDays || maxDays === 1)) {
      return 'Daily'
    }
    if (minDays === 7 && (!maxDays || maxDays === 7)) {
      return 'Weekly'
    }
    if (minDays === 30 && (!maxDays || maxDays === 30)) {
      return 'Monthly'
    }
    if (maxDays) {
      return `${minDays}-${maxDays} days`
    }
    return `${minDays}+ days`
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold text-gray-900">
              {brands?.name} {model}
            </h1>
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
            {formatCurrency(bestRate.amount, bestRate.currency)}
          </div>
          <div className="text-gray-600">
            {rental_rate_tiers && rental_rate_tiers.length > 0 ? 'starting from' : 'per day'}
          </div>
        </div>
      </div>

      {/* Gallery under header */}
      {motorcycle.motorcycle_images && motorcycle.motorcycle_images.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {motorcycle.motorcycle_images
            .filter(mi => mi.images?.url)
            .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
            .slice(0, 6)
            .map((mi) => (
              <div key={mi.images!.id} className="relative w-full h-48 bg-gray-100 rounded-lg overflow-hidden">
                <Image
                  src={mi.images!.url!}
                  alt={mi.images!.alt_text || `${brands?.name || ''} ${model || 'Motorcycle'}`}
                  fill
                  className="object-cover"
                />
              </div>
            ))}
        </div>
      )}

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

          {/* Rental Rates */}
          {rental_rate_tiers && rental_rate_tiers.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CurrencyDollarIcon className="w-5 h-5" />
                  Rental Rates
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {rental_rate_tiers
                    .sort((a, b) => a.min_days - b.min_days) // Sort by duration
                    .map((rateTier, index) => (
                      <div key={index} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50">
                        <div>
                          <div className="font-medium text-gray-900">
                            {formatDuration(rateTier.min_days, rateTier.max_days)}
                          </div>
                          <div className="text-sm text-gray-600">
                            {rateTier.max_days
                              ? `${rateTier.min_days} to ${rateTier.max_days} days`
                              : `${rateTier.min_days}+ days`
                            }
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-lg text-blue-600">
                            {formatCurrency(rateTier.rate_per_day, rateTier.currency)}
                          </div>
                          <div className="text-xs text-gray-500">per day</div>
                        </div>
                      </div>
                    ))}
                </div>

                {/* Fallback message if only basic rate exists */}
                {rental_rate_per_day && (
                  <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="flex items-center gap-2">
                      <div className="text-sm text-blue-800">
                        💡 <strong>Note:</strong> Additional pricing tiers may be available. Contact the rental shop for long-term rates and special offers.
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Fallback Basic Rate (when no rate tiers) */}
          {(!rental_rate_tiers || rental_rate_tiers.length === 0) && rental_rate_per_day && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CurrencyDollarIcon className="w-5 h-5" />
                  Rental Rate
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg bg-gray-50">
                  <div>
                    <div className="font-medium text-gray-900">Daily Rate</div>
                    <div className="text-sm text-gray-600">Standard pricing</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-2xl text-blue-600">
                      {formatCurrency(rental_rate_per_day, rental_rate_currency)}
                    </div>
                    <div className="text-sm text-gray-500">per day</div>
                  </div>
                </div>
                <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="text-sm text-blue-800">
                    💡 <strong>Tip:</strong> Contact the rental shop for weekly, monthly rates and special discounts for longer rentals.
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

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
          {motorcycle_conditions && motorcycle_conditions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DocumentTextIcon className="w-5 h-5" />
                  Rental Conditions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {motorcycle_conditions.map((condition, index) => (
                    <div key={`${condition.condition_type_id}-${index}`} className="border border-gray-200 rounded-lg p-3">
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
                          {condition.notes && (
                            <p className="text-sm text-gray-700 mt-1">
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

          {/* Legacy Conditions (Fallback) */}
          {(!motorcycle_conditions || motorcycle_conditions.length === 0) && conditions && Object.keys(conditions).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DocumentTextIcon className="w-5 h-5" />
                  Rental Conditions
                </CardTitle>
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
                <Link href={rental_shops ? getShopUrl(rental_shops) : '#'}>
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

          {/* Same Model Widget */}
          <SameModelWidget
            currentMotorcycleId={motorcycle.id}
            count={sameModelCount}
            countryName={countryName}
            brandName={brands?.name}
            modelName={model}
          />

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
        </div >
      </div >
    </div >
  )
} 