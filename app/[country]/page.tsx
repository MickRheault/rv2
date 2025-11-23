import { Suspense } from 'react'
import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { CountryPageProps } from '@/types'
import { validateLocationParam, formatLocationName, isReservedRoute } from '@/lib/utils'
import { locationService } from '@/services/locations'
import { shopService } from '@/services/shops'
import { PageLoading, ErrorState } from '@/components/ui/LoadingStates'
import { StructuredData, generateLocationShopListingSchema } from '@/lib/seo/structured-data'
import CountryShopsGrid from './CountryShopsGrid'

// Generate dynamic metadata based on country parameter
export async function generateMetadata({ params }: CountryPageProps): Promise<Metadata> {
  // Validate and format country parameter
  const country = validateLocationParam(params.country)
  
  if (!country) {
    return {
      title: 'Country Not Found',
      description: 'The requested country could not be found.'
    }
  }
  
  try {
    // Check if country exists in database
    const countryData = await locationService.getCountryByName(country)
    
    if (!countryData) {
      return {
        title: 'Country Not Found',
        description: 'The requested country could not be found.'
      }
    }
    
    const countryDisplayName = formatLocationName(country)
    
    return {
      title: `Motorcycle Rental Shops in ${countryDisplayName}`,
      description: `Browse and compare motorcycle rental shops in ${countryDisplayName}. Find the perfect bike rental for your adventure.`,
      keywords: `motorcycle rental, ${countryDisplayName}, bike rental, scooter rental`,
    }
  } catch (error) {
    console.error('Error generating metadata for country:', error)
    return {
      title: 'Country Not Found',
      description: 'The requested country could not be found.'
    }
  }
}

export default async function CountryPage({ params }: CountryPageProps) {
  // Extract and validate country parameter
  const { country: rawCountry } = params
  
  // Check for reserved routes first
  if (isReservedRoute(rawCountry)) {
    notFound()
  }
  
  // Validate and sanitize the country parameter
  const country = validateLocationParam(rawCountry)
  
  // Return 404 for invalid country parameters
  if (!country) {
    notFound()
  }
  
  // Format country name for display
  const countryDisplayName = formatLocationName(country)

  // Fetch country details and shops
  try {
    const countryData = await locationService.getCountryByName(country)
    
    // Return 404 if country doesn't exist in database
    if (!countryData) {
      notFound()
    }

    // Fetch shops for this country with motorcycle counts
    const shopsResult = await shopService.getShopsWithCounts({
      countryCode: countryData.code,
      sortBy: 'rating_desc',
      limit: 100 // Show all shops for now, as per PRD requirements
    })

    const shops = shopsResult.shops || []

    // Generate JSON-LD structured data for the shop listings
    const currentUrl = `https://globalmotorentals.com/${country}/`
    const structuredData = generateLocationShopListingSchema({
      location: countryDisplayName,
      locationType: 'country',
      shops: shops,
      url: currentUrl,
    })

    return (
      <Suspense fallback={
        <PageLoading message={`Loading motorcycle rental shops in ${countryDisplayName}...`} />
      }>
        <StructuredData schema={structuredData} />
        <main className="min-h-screen bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-8">
              Motorcycle Rental Shops in {countryDisplayName}
            </h1>
            
            <CountryShopsGrid 
              shops={shops} 
              countryDisplayName={countryDisplayName} 
            />
          </div>
        </main>
      </Suspense>
    )
  } catch (error) {
    console.error('Error fetching country data:', error)
    
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
                message={`Unable to load rental shops for ${countryDisplayName}. Please check your internet connection and try again.`}
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
                message={`We're having trouble loading rental shops for ${countryDisplayName}. Please try again in a few moments.`}
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