'use client'

import Link from 'next/link'
import Image from 'next/image'
import {
  MapPinIcon,
  StarIcon,
  CalendarIcon,
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
import { isMotorcycleAvailable } from '@/services/shops'
import { getShopUrl } from '@/lib/utils/urls'
import { formatMotorcycleYear } from '@/lib/utils'
import {
  convertLegacyRateTiersToOffers,
  formatDurationUnitLabel,
  formatExtensionBillingPhrase,
  formatOfferBillingUnitPhrase,
  formatOfferDurationRangeLabel,
  hydrateRentalOffersFromRows,
  selectPrimaryHeadlineOffer,
  type NormalizedRentalOffer,
  type StandaloneOfferType,
} from '@/lib/rental-offers'
import SameModelWidget from '@/components/motorcycle/SameModelWidget'

interface MotorcycleDetailsProps {
  motorcycle: MotorcycleWithDetails
  sameModelCount?: number
  countryName?: string
}

const OFFER_TYPE_LABELS: Record<StandaloneOfferType, string> = {
  daily: 'Daily Rate',
  hourly: 'Hourly Rental',
  package: 'Fixed Package',
  monthly: 'Monthly Rental',
}

function resolveDisplayOffers(motorcycle: MotorcycleWithDetails): NormalizedRentalOffer[] {
  const hydrated = hydrateRentalOffersFromRows((motorcycle as any).rental_offers)
  if (hydrated.length > 0) {
    return hydrated
  }

  if (motorcycle.rental_rate_tiers && motorcycle.rental_rate_tiers.length > 0) {
    try {
      return convertLegacyRateTiersToOffers(motorcycle.rental_rate_tiers)
    } catch {
      // Fallback for any historical fractional rows if encountered un-backfilled
    }
  }

  if (motorcycle.rental_rate_per_day && motorcycle.rental_rate_per_day > 0 && motorcycle.rental_rate_currency) {
    return [
      {
        offerType: 'daily',
        amount: motorcycle.rental_rate_per_day,
        currency: motorcycle.rental_rate_currency.trim().toUpperCase(),
        billingBasis: 'per_day',
        durationUnit: 'day',
        minDuration: 1,
        maxDuration: null,
        minCommitment: null,
        billingIncrement: null,
        supplierLabel: null,
        isFrom: false,
        sortOrder: 0,
        dailyEquivalent: null,
        extensions: [],
      },
    ]
  }

  return []
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
    rental_rate_currency,
    brands,
    categories,
    rental_shops,
    motorcycle_features,
    motorcycle_conditions,
    specifications_details,
    conditions_details
  } = motorcycle
  const formattedYear = formatMotorcycleYear(year, (motorcycle as any).year_to)

  const formatOfferAmount = (
    amount: number | null | undefined,
    currency: string | null | undefined,
    preserveDecimals: boolean = false
  ) => {
    if (amount === null || amount === undefined || !currency) return 'Price on request'
    const hasFraction = preserveDecimals || !Number.isInteger(amount)
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.trim().toUpperCase(),
      minimumFractionDigits: hasFraction ? 2 : 0,
      maximumFractionDigits: hasFraction ? 2 : 0,
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

  const features = motorcycle_features?.filter(mf => mf.features).map(mf => mf.features!) || []
  const specifications = specifications_details as any || {}
  const conditions = conditions_details as any || {}

  const offers = resolveDisplayOffers(motorcycle)
  const headlineOffer = selectPrimaryHeadlineOffer(offers)
  const fallbackCurrency = rental_rate_currency || headlineOffer?.currency || null

  const formatIncrementLabel = (value: number, unit: string) => {
    const cleanUnit = unit.replace('_', ' ')
    return `Billed in ${value}-${cleanUnit} increments`
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold text-gray-900">
              {brands?.name} {model}
            </h1>
            {!isMotorcycleAvailable(motorcycle) && (
              <Badge variant="default" className="bg-amber-50 text-amber-800 border border-amber-200">
                Currently Unavailable
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 text-gray-600">
            {formattedYear && (
              <div className="flex items-center space-x-1">
                <CalendarIcon className="w-4 h-4" />
                <span>{formattedYear}</span>
              </div>
            )}
            {categories && (
              <>
                {formattedYear && <span>•</span>}
                <span>{categories.name}</span>
              </>
            )}
            {engine_capacity_cc && (
              <>
                {(formattedYear || categories) && <span>•</span>}
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
            {headlineOffer
              ? `${headlineOffer.isFrom ? 'From ' : ''}${formatOfferAmount(headlineOffer.amount, headlineOffer.currency)}`
              : 'Price on request'}
          </div>
          {headlineOffer && (
            <div className="text-gray-600">
              {formatOfferBillingUnitPhrase(headlineOffer)}
            </div>
          )}
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

          {/* Flexible Rental Offers */}
          {offers.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CurrencyDollarIcon className="w-5 h-5" />
                  Rental Offers
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {offers.map((offer, index) => {
                    const offerKey = offer.id ?? `${offer.offerType}-${index}`
                    return (
                      <div
                        key={offerKey}
                        data-testid={`rental-offer-${offerKey}`}
                        className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-medium text-gray-900">
                                {offer.supplierLabel || OFFER_TYPE_LABELS[offer.offerType]}
                              </span>
                              <Badge variant="secondary" className="text-xs border border-gray-200">
                                {OFFER_TYPE_LABELS[offer.offerType]}
                              </Badge>
                            </div>
                            <div className="text-sm text-gray-600">
                              {formatOfferDurationRangeLabel(offer)}
                            </div>
                            {offer.minCommitment && (
                              <div className="text-xs text-gray-600">
                                Min. commitment: {offer.minCommitment.value}{' '}
                                {formatDurationUnitLabel(offer.minCommitment.unit, offer.minCommitment.value)}
                              </div>
                            )}
                            {offer.billingIncrement && (
                              <div className="text-xs text-gray-600">
                                {formatIncrementLabel(offer.billingIncrement.value, offer.billingIncrement.unit)}
                              </div>
                            )}
                          </div>

                          <div className="sm:text-right">
                            <div className="font-bold text-lg text-blue-600">
                              {offer.isFrom ? 'From ' : ''}
                              {formatOfferAmount(offer.amount, offer.currency)}
                            </div>
                            <div className="text-xs font-medium text-gray-600">
                              {formatOfferBillingUnitPhrase(offer)}
                            </div>
                            {offer.dailyEquivalent !== null && (
                              <div className="text-xs text-gray-500 mt-1">
                                {formatOfferAmount(offer.dailyEquivalent, offer.currency, true)}/day daily equivalent
                              </div>
                            )}
                          </div>
                        </div>

                        {offer.extensions.length > 0 && (
                          <div className="mt-3 pt-2 border-t border-dashed border-gray-200 space-y-1.5">
                            {offer.extensions.map((ext, extIdx) => (
                              <div
                                key={ext.id ?? `${offerKey}-ext-${extIdx}`}
                                className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-700 bg-gray-50 px-3 py-1.5 rounded"
                              >
                                <span>
                                  {ext.supplierLabel || 'Extension rate'}
                                  {ext.billingIncrement
                                    ? ` (${formatIncrementLabel(ext.billingIncrement.value, ext.billingIncrement.unit)})`
                                    : ''}
                                </span>
                                <span className="font-semibold text-gray-900">
                                  + {ext.isFrom ? 'From ' : ''}
                                  {formatOfferAmount(ext.amount, ext.currency)}{' '}
                                  {formatExtensionBillingPhrase(ext)}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
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
                      <span>{formatOfferAmount(conditions.deposit, fallbackCurrency)}</span>
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
                  <div className="flex items-center">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <span key={star}>
                        {star <= Math.round(rental_shops.rating!) ? (
                          <StarSolid className="w-4 h-4 text-yellow-400" />
                        ) : (
                          <StarIcon className="w-4 h-4 text-gray-300" />
                        )}
                      </span>
                    ))}
                  </div>
                  <span className="font-medium">{rental_shops.rating.toFixed(1)}</span>
                  {rental_shops.review_count && (
                    <span className="text-sm text-gray-500">
                      ({rental_shops.review_count} reviews)
                    </span>
                  )}
                </div>
              )}

              {rental_shops?.business_description && (
                <p className="text-sm text-gray-600 line-clamp-3">
                  {rental_shops.business_description}
                </p>
              )}

              <div className="space-y-2 pt-2">
                {rental_shops?.phone && (
                  <div className="flex items-center gap-2 text-sm">
                    <PhoneIcon className="w-4 h-4 text-gray-500" />
                    <a
                      href={`tel:${rental_shops.phone}`}
                      className="text-blue-600 hover:text-blue-800"
                    >
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
                      className="text-blue-600 hover:text-blue-800 flex items-center gap-1"
                    >
                      Visit Website
                      <ArrowTopRightOnSquareIcon className="w-3 h-3" />
                    </a>
                  </div>
                )}
              </div>

              <div className="space-y-2 pt-4">
                {rental_shops && (
                  <Link href={getShopUrl(rental_shops)}>
                    <Button variant="primary" className="w-full">
                      View Shop Details
                    </Button>
                  </Link>
                )}
                <Button variant="outline" className="w-full">
                  Contact Shop
                </Button>
              </div>
            </CardContent>
          </Card>

          <SameModelWidget
            currentMotorcycleId={motorcycle.id}
            count={sameModelCount}
            brandName={brands?.name || ''}
            modelName={model || ''}
            countryName={countryName}
          />

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
