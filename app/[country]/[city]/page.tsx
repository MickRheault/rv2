import { Suspense } from 'react'
import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { CityPageProps } from '@/types'
import { validateLocationParam, formatLocationName, validateCountryCityCombo, isReservedRoute } from '@/lib/utils'
import { locationService } from '@/services/locations'
import { shopService } from '@/services/shops'
import { PageLoading, ErrorState } from '@/components/ui/LoadingStates'
import { StructuredData, generateLocationShopListingSchema } from '@/lib/seo/structured-data'
import { BuildingStorefrontIcon } from '@heroicons/react/24/outline'
import CityShopsGrid from './CityShopsGrid'
import LocationHeroBanner from '@/components/location/LocationHeroBanner'
import { motorcycleService } from '@/services/motorcycles'
import MotorcycleTable from '@/components/motorcycle/MotorcycleTable'
import { generateMetadata as generateSEOMetadata } from '@/lib/seo/config'

// Generate dynamic metadata based on city and country parameters
export async function generateMetadata({ params }: CityPageProps): Promise<Metadata> {
  const resolvedParams = await params
  // Validate and format parameters
  const country = validateLocationParam(resolvedParams.country)
  const city = validateLocationParam(resolvedParams.city)

  if (!country || !city) {
    return {
      title: 'City Not Found',
      description: 'The requested city could not be found.'
    }
  }

  try {
    // Get country data for validation
    const countryData = await locationService.getCountryByName(country)
    if (!countryData) {
      return {
        title: 'City Not Found',
        description: 'The requested city could not be found.'
      }
    }

    const countryDisplayName = formatLocationName(country)
    const cityDisplayName = formatLocationName(city)

    return generateSEOMetadata({
      title: `Motorcycle Rentals in ${cityDisplayName}, ${countryDisplayName} - Choose the best bike from the best rental`,
      description: `Find and compare motorcycle rental shops in ${cityDisplayName}, ${countryDisplayName}. Browse bikes, compare prices, and book your perfect ride.`,
      keywords: ['motorcycle rental', cityDisplayName, countryDisplayName, 'bike rental', 'scooter rental'],
      url: `/${country}/${city}`,
    })
  } catch (error) {
    console.error('Error generating city metadata:', error)
    return {
      title: 'City Not Found',
      description: 'The requested city could not be found.'
    }
  }
}

export default async function CityPage({ params }: CityPageProps) {
  const resolvedParams = await params
  // Extract and validate parameters
  const { country: rawCountry, city: rawCity } = resolvedParams

  // Check for reserved routes first
  if (isReservedRoute(rawCountry) || isReservedRoute(rawCity)) {
    notFound()
  }

  // Validate and sanitize the parameters
  const country = validateLocationParam(rawCountry)
  const city = validateLocationParam(rawCity)

  // Return 404 for invalid parameters
  if (!country || !city) {
    notFound()
  }

  // Enhanced validation for country/city combination
  const comboValidation = validateCountryCityCombo(country, city)
  if (!comboValidation.isValid) {
    console.warn(`Invalid country/city combination: ${country}/${city} - ${comboValidation.error}`)
    notFound()
  }

  // Format names for display
  const countryDisplayName = formatLocationName(country)
  const cityDisplayName = formatLocationName(city)

  // Fetch city data and shops
  try {
    // First, validate that the country exists
    const countryData = await locationService.getCountryByName(country)

    // Return 404 if country doesn't exist in database
    if (!countryData) {
      notFound()
    }

    // Get city data by name within the country
    const cityData = await locationService.getCityByName(city, countryData.code)

    // Return 404 if city doesn't exist in this country
    if (!cityData) {
      notFound()
    }

    // Fetch shops for this specific city with motorcycle counts
    const shopsResult = await shopService.getShopsWithCounts({
      cityId: cityData.id,
      sortBy: 'rating_desc',
      limit: 100 // Show all shops for now, as per PRD requirements
    })

    const shops = shopsResult.shops || []

    // Fetch motorcycles for the city
    const motorcyclesResult = await motorcycleService.getMotorcycles({
      cityId: cityData.id,
      limit: 10000
    })
    const motorcycles = motorcyclesResult.motorcycles || []

    // Generate JSON-LD structured data for the shop listings
    const currentUrl = `https://globalmotorentals.com/${country}/${city}/`
    const structuredData = generateLocationShopListingSchema({
      location: `${cityDisplayName}, ${countryDisplayName}`,
      locationType: 'city',
      shops: shops,
      url: currentUrl,
    })

    return (
      <Suspense fallback={
        <PageLoading message={`Loading motorcycle rental shops in ${cityDisplayName}, ${countryDisplayName}...`} />
      }>
        <StructuredData schema={structuredData} />
        <main className="min-h-screen bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <LocationHeroBanner
              locationName={cityDisplayName}
              countryName={countryDisplayName}
              locationType="city"
              shopCount={shops.length}
            />

            {/* City-wide Motorcycle List */}
            {motorcycles.length > 0 && (
              <section className="mt-8 mb-12">
                <MotorcycleTable
                  motorcycles={motorcycles}
                  title={`All Motorcycles in ${cityDisplayName} (${motorcycles.length})`}
                  showShopColumn={true}
                />
              </section>
            )}

            <section className="mt-12">
              <div className="flex items-center gap-2 mb-6">
                <BuildingStorefrontIcon className="w-5 h-5 text-gray-400" />
                <h2 className="text-xl md:text-2xl font-bold text-gray-900">
                  Rental Shops in {cityDisplayName} ({shops.length})
                </h2>
              </div>
              <CityShopsGrid
                shops={shops}
                cityDisplayName={cityDisplayName}
                countryDisplayName={countryDisplayName}
              />
            </section>
          </div>
        </main>
      </Suspense>
    )
  } catch (error: any) {
    // Let Next.js navigation errors (like notFound) bubble up without logging
    if (error && typeof error === 'object' && error.digest && typeof error.digest === 'string' && error.digest.includes('NEXT_HTTP_ERROR_FALLBACK')) {
      throw error;
    }

    console.error('Error fetching city data:', error)

    // Handle different types of errors more gracefully
    if (error instanceof Error) {
      // Network or connection errors
      if (error.message.includes('fetch') || error.message.includes('network') || error.message.includes('timeout')) {
        return (
          <main className="min-h-screen bg-gray-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
              <ErrorState
                type="network"
                title="Connection Error"
                message={`Unable to load rental shops for ${cityDisplayName}, ${countryDisplayName}. Please check your internet connection and try again.`}
                onRetry={() => window.location.reload()}
                className="mt-16"
              />
            </div>
          </main>
        )
      }

      // Database or service errors
      if (error.message.includes('database') || error.message.includes('service')) {
        return (
          <main className="min-h-screen bg-gray-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
              <ErrorState
                type="error"
                title="Service Unavailable"
                message={`We're having trouble loading rental shops for ${cityDisplayName}, ${countryDisplayName}. Please try again in a few moments.`}
                onRetry={() => window.location.reload()}
                className="mt-16"
              />
            </div>
          </main>
        )
      }
    }

    // For unknown errors or data not found, use 404
    notFound()
  }
}