import { NextResponse } from 'next/server'
import { locationService } from '@/services/locations'

// Revalidate every hour (3600 seconds)
// Next.js will cache this response and auto-regenerate after 1 hour
export const revalidate = 3600

export async function GET() {
  try {
    const [countries, locationsData] = await Promise.all([
      locationService.getCountries(),
      locationService.getLocationsWithShops()
    ])
    
    // Extract all cities from locations data with country mapping
    const allCities = Object.values(locationsData)
      .flatMap(countryData => 
        Object.values(countryData.provinces || {})
          .flatMap(province => province.cities || [])
          .map(city => ({
            id: city.id,
            name: city.name,
            fullName: city.name,
            countryCode: countryData.country.code
          }))
      )
      .sort((a, b) => a.name.localeCompare(b.name))

    const responseData = {
      countries,
      cities: allCities,
      generatedAt: new Date().toISOString(),
      stats: {
        totalCountries: countries.length,
        totalCities: allCities.length
      }
    }

    return NextResponse.json(responseData, {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      },
    })
  } catch (error) {
    console.error('Error fetching locations:', error)
    return NextResponse.json(
      { error: 'Failed to fetch locations' },
      { status: 500 }
    )
  }
}

