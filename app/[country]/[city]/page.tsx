import { Suspense } from 'react'
import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { CityPageProps } from '@/types'
import { validateLocationParam, formatLocationName } from '@/lib/utils'

// TODO: Dynamic metadata generation will be implemented in sub-task 7.5.2
export const metadata: Metadata = {
  title: 'Motorcycle Rental Shops by City',
  description: 'Browse motorcycle rental shops by city'
}

export default function CityPage({ params }: CityPageProps) {
  // Extract and validate parameters
  const { country: rawCountry, city: rawCity } = params
  
  // Validate and sanitize the parameters
  const country = validateLocationParam(rawCountry)
  const city = validateLocationParam(rawCity)
  
  // Return 404 for invalid parameters
  if (!country || !city) {
    notFound()
  }
  
  // Format names for display
  const countryDisplayName = formatLocationName(country)
  const cityDisplayName = formatLocationName(city)

  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading shops...</p>
        </div>
      </div>
    }>
      <main className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">
            Motorcycle Rental Shops in {cityDisplayName}, {countryDisplayName}
          </h1>
          
          {/* TODO: Shop cards will be implemented in sub-task 7.3.3 */}
          <div className="text-center py-12">
            <p className="text-gray-600">
              City shop listings will be displayed here
            </p>
          </div>
        </div>
      </main>
    </Suspense>
  )
}