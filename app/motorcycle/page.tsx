import { Metadata } from 'next'
import Link from 'next/link'
import { motorcycleService } from '@/services/motorcycles'
import { generateSlug, formatLocationName } from '@/lib/utils'

export const metadata: Metadata = {
    title: 'All Motorcycle Rentals by City',
    description: 'Browse all available motorcycle rentals worldwide, organized by country and city.',
}

export const revalidate = 3600 // Revalidate every hour

interface GroupedData {
    [countryCode: string]: {
        countryName: string
        cities: {
            [cityId: string]: {
                cityName: string
                models: Set<string> // Set of "Brand Model"
            }
        }
    }
}

export default async function MotorcycleHubPage() {
    let motorcycles: any[] = []
    try {
        motorcycles = await motorcycleService.getAllMotorcyclesForHub() || []
    } catch {
        // Gracefully handle missing database (e.g. local builds without Supabase)
        motorcycles = []
    }

    // Group data
    const groupedData: GroupedData = {}

    if (motorcycles) {
        motorcycles.forEach((bike: any) => {
            const city = bike.rental_shops.cities
            const province = city.provinces
            const country = province.countries

            const countryCode = country.code
            const cityId = city.id

            if (!groupedData[countryCode]) {
                groupedData[countryCode] = {
                    countryName: country.name,
                    cities: {}
                }
            }

            if (!groupedData[countryCode].cities[cityId]) {
                groupedData[countryCode].cities[cityId] = {
                    cityName: city.name,
                    models: new Set()
                }
            }

            const brandName = bike.brands?.name || ''
            const modelName = bike.model || ''
            const fullName = `${brandName} ${modelName}`.trim()

            if (fullName) {
                groupedData[countryCode].cities[cityId].models.add(fullName)
            }
        })
    }

    // Sort countries by name
    const sortedCountries = Object.entries(groupedData).sort(([, a], [, b]) =>
        a.countryName.localeCompare(b.countryName)
    )

    return (
        <div className="min-h-screen bg-transparent">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                <h1 className="text-3xl font-bold text-gray-900 mb-8">
                    Motorcycle Rentals by Location
                </h1>

                <div className="space-y-12">
                    {sortedCountries.map(([countryCode, countryData]) => (
                        <div key={countryCode} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 md:p-8">
                            <div className="space-y-8">
                                {Object.entries(countryData.cities)
                                    .sort(([, a], [, b]) => a.cityName.localeCompare(b.cityName))
                                    .map(([cityId, cityData]) => {
                                        const sortedModels = Array.from(cityData.models).sort()

                                        return (
                                            <div key={cityId} className="flex flex-col gap-4">
                                                <div className="flex items-baseline gap-3">
                                                    <h3 className="text-lg font-semibold text-gray-800">
                                                        {cityData.cityName}
                                                    </h3>
                                                    <span className="text-sm text-gray-500">
                                                        {countryData.countryName}
                                                    </span>
                                                </div>

                                                <div className="flex flex-wrap gap-3">
                                                    {sortedModels.map((model) => {
                                                        // Slug logic: "brand-model-slug"
                                                        // But need to match the /[...slug] logic for 2 params
                                                        // 2 params: /country-code/brand-model-slug

                                                        // The app/motorcycle/[...slug] Case 2 expects: [countrySlug, modelSlug]
                                                        // countrySlug should be country name slug?
                                                        // Let's check getSameModelData in page.tsx
                                                        // It uses locationService.getCountryByName(countrySlug.replace(/-/g, ' '))
                                                        // So we should use country name slug

                                                        const countrySlug = generateSlug(countryData.countryName)
                                                        const modelSlug = generateSlug(model)

                                                        return (
                                                            <Link
                                                                key={model}
                                                                href={`/motorcycle/${countrySlug}/${modelSlug}`}
                                                                className="px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-full border border-blue-200 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                                                            >
                                                                {model}
                                                            </Link>
                                                        )
                                                    })}
                                                </div>
                                            </div>
                                        )
                                    })}
                            </div>
                        </div>
                    ))}

                    {sortedCountries.length === 0 && (
                        <div className="text-center py-12 text-gray-500">
                            No motorcycles available at the moment.
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
