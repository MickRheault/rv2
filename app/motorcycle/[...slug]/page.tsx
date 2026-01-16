import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import Link from 'next/link'
import { ArrowLeftIcon } from '@heroicons/react/24/outline'

import { motorcycleService } from '@/services/motorcycles'
import { locationService } from '@/services/locations'
import MotorcycleDetails from '@/components/motorcycle/MotorcycleDetails'
import MotorcycleCard from '@/components/motorcycle/MotorcycleCard'
import MotorcycleCityList from '@/components/motorcycle/MotorcycleCityList'
import LocationHeroBanner from '@/components/location/LocationHeroBanner'
import { generateMetadata as generateSEOMetadata, generateMotorcycleSEO } from '@/lib/seo/config'
import { StructuredData, generateEnhancedMotorcycleSchema } from '@/lib/seo/structured-data'
import { generateSlug, formatLocationName } from '@/lib/utils'

interface PageProps {
    params: Promise<{ slug: string[] }>
}

// --- Metadata Generation ---

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const resolvedParams = await params
    const { slug } = resolvedParams

    // Case 1: Motorcycle Details (slug length 1 -> ID)
    if (slug.length === 1) {
        try {
            const id = slug[0]
            const motorcycle = await motorcycleService.getMotorcycleById(id)

            const seoConfig = generateMotorcycleSEO({
                id: motorcycle.id,
                model: motorcycle.model || undefined,
                brand: motorcycle.brands?.name || undefined,
                location: motorcycle.rental_shops?.location_name || motorcycle.rental_shops?.cities?.name || undefined,
                pricePerDay: motorcycle.rental_rate_per_day || undefined,
                currency: motorcycle.rental_rate_currency || undefined,
                year: motorcycle.year || undefined,
                category: motorcycle.categories?.name || undefined,
                image: motorcycle.motorcycle_images?.[0]?.images?.url || undefined,
            })

            return generateSEOMetadata({
                ...seoConfig,
                url: `/motorcycle/${id}`,
            })
        } catch (error) {
            return {
                title: 'Motorcycle Not Found',
                description: 'The requested motorcycle could not be found.'
            }
        }
    }

    // Case 2: Same Model Page (slug length 2 -> [country, model])
    // Case 2: Same Model Page (slug length 2 -> [country, model])
    if (slug.length === 2) {
        const [countrySlug, modelSlug] = slug
        const data = await getSameModelData(countrySlug, modelSlug)

        if (!data) {
            return { title: 'Not Found' }
        }

        const { countryData, motorcycles, displayBrandName, displayModelName } = data

        // Prepare cities list for metadata title
        const uniqueCities = Array.from(new Set(
            motorcycles.map(m => m.rental_shops?.cities?.name)
        )).filter(Boolean) as string[]

        const citiesListSpan = uniqueCities.sort().join(', ')
        const displayModel = `${displayBrandName} ${displayModelName}`

        // "Rent {Model} in {list of cities}, {Country}"
        const metaTitle = `Rent ${displayModel} in ${citiesListSpan ? citiesListSpan : 'all locations'}, ${countryData.name}`

        return {
            title: metaTitle,
            description: `Compare prices for ${displayModel} rentals in ${countryData.name}. Available in ${uniqueCities.length} cities.`
        }
    }

    return {
        title: 'Not Found'
    }
}

// --- Main Page Component ---

export default async function MotorcycleCatchAllPage({ params }: PageProps) {
    const resolvedParams = await params
    const { slug } = resolvedParams

    if (slug.length === 1) {
        return renderMotorcycleDetails(slug[0])
    } else if (slug.length === 2) {
        return renderSameModelPage(slug[0], slug[1])
    } else {
        notFound()
    }
}

// --- Case 1 Logic: Motorcycle Details ---

async function renderMotorcycleDetails(id: string) {
    try {
        const motorcycle = await motorcycleService.getMotorcycleById(id)

        if (!motorcycle) {
            notFound()
        }

        // Get count of same model motorcycles in the country
        let sameModelCount = 0
        let countryName = ''
        try {
            if (motorcycle.model && motorcycle.brand_id && motorcycle.rental_shops?.cities?.provinces?.country_code) {
                const sameModels = await motorcycleService.getSameModelMotorcyclesInCountry(
                    motorcycle.rental_shops.cities.provinces.country_code,
                    motorcycle.brand_id,
                    motorcycle.model,
                    motorcycle.id
                )
                sameModelCount = sameModels.length
                countryName = motorcycle.rental_shops.cities.provinces.countries?.name || ''
            }
        } catch (err) {
            console.error('Error fetching same model motorcycles:', err)
        }

        // Generate enhanced structured data for rich snippets
        const structuredData = generateEnhancedMotorcycleSchema({
            id: motorcycle.id,
            model: motorcycle.model || undefined,
            brand: motorcycle.brands?.name || undefined,
            year: motorcycle.year || undefined,
            category: motorcycle.categories?.name || undefined,
            description: `${motorcycle.brands?.name || ''} ${motorcycle.model || ''} motorcycle rental`.trim(),
            image: motorcycle.motorcycle_images?.[0]?.images?.url || undefined,
            features: motorcycle.motorcycle_features?.map(f => f.features?.name).filter(Boolean),
            engineSize: motorcycle.engine_capacity_cc || undefined,
            availability: true,
            // Enhanced data from rental rate tiers
            rentalRates: motorcycle.rental_rate_tiers?.map(tier => ({
                rateText: `${tier.min_days}-${tier.max_days || '+'} day rate`,
                minDays: tier.min_days,
                maxDays: tier.max_days || undefined,
                ratePerDay: tier.rate_per_day || undefined,
                currency: tier.currency || motorcycle.rental_rate_currency || undefined,
            })) || (motorcycle.rental_rate_per_day ? [{
                rateText: 'Standard Rate',
                minDays: 1,
                maxDays: undefined,
                ratePerDay: motorcycle.rental_rate_per_day,
                currency: motorcycle.rental_rate_currency || undefined,
            }] : []),
            // Parse specifications from JSON if available
            specifications: motorcycle.specifications_details ?
                (typeof motorcycle.specifications_details === 'object' ?
                    motorcycle.specifications_details :
                    undefined
                ) : undefined,
        })

        return (
            <>
                <StructuredData schema={structuredData} />
                <div className="min-h-screen bg-gray-50">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                        <div className="mb-8">
                            <MotorcycleDetails
                                motorcycle={motorcycle}
                                sameModelCount={sameModelCount}
                                countryName={countryName}
                            />
                        </div>

                        {/* Related Motorcycles */}
                        <RelatedMotorcycles
                            currentMotorcycleId={motorcycle.id}
                            shopId={motorcycle.shop_id}
                            categoryId={motorcycle.category_id}
                            brandId={motorcycle.brand_id}
                        />
                    </div>
                </div>
            </>
        )
    } catch (error) {
        console.error('Error loading motorcycle:', error)
        notFound()
    }
}

// --- Case 2 Logic: Same Model Page ---

// --- Helper Logic ---

async function getSameModelData(countrySlug: string, modelSlug: string) {
    // 1. Resolve Country
    const countryData = await locationService.getCountryByName(countrySlug.replace(/-/g, ' '))

    if (!countryData) {
        return null
    }

    // 2. Resolve Brand and Model from slug
    const brands = await motorcycleService.getBrands()
    const matchingBrand = brands.find(b => {
        const brandSlug = generateSlug(b.name)
        return modelSlug.startsWith(brandSlug + '-')
    })

    let motorcycles: any[] = []
    let displayBrandName = ''
    let displayModelName = ''

    if (matchingBrand) {
        const brandSlug = generateSlug(matchingBrand.name)
        const modelNameSlug = modelSlug.slice(brandSlug.length + 1) // Remove "brand-"

        const brandBikesInCountry = await motorcycleService.getSameModelMotorcyclesInCountry(
            countryData.code,
            matchingBrand.id,
            "%"
        )

        // Filter in memory for model match
        motorcycles = brandBikesInCountry.filter(bike => {
            const bikeSlug = generateSlug(`${bike.brands?.name} ${bike.model}`)
            return bikeSlug === modelSlug
        })

        if (motorcycles.length > 0) {
            displayBrandName = motorcycles[0].brands?.name || matchingBrand.name
            displayModelName = motorcycles[0].model || modelNameSlug
        } else {
            displayBrandName = matchingBrand.name
            displayModelName = formatLocationName(modelNameSlug)
        }
    } else {
        return null
    }

    return {
        countryData,
        motorcycles,
        displayBrandName,
        displayModelName
    }
}

// --- Case 2 Logic: Same Model Page ---

async function renderSameModelPage(countrySlug: string, modelSlug: string) {
    const data = await getSameModelData(countrySlug, modelSlug)

    if (!data) {
        notFound()
    }

    const { countryData, motorcycles, displayBrandName, displayModelName } = data

    // Prepare cities
    const uniqueCities = Array.from(new Set(
        motorcycles.map(m => JSON.stringify({
            id: m.rental_shops?.cities?.id,
            name: m.rental_shops?.cities?.name,
            slug: (m.rental_shops?.cities as any)?.slug
        }))
    ))
        .map(s => JSON.parse(s))
        .filter(c => c.id && c.name)

    const displayModel = `${displayBrandName} ${displayModelName}`
    const countryName = countryData.name

    // Hero Title: "{Model} for rent in {Country}"
    const heroTitle = `${displayModel} for rent in ${countryName}`

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="mb-6">
                    <Link
                        href={`/${countrySlug}`}
                        className="inline-flex items-center text-sm text-gray-600 hover:text-blue-600 transition-colors"
                    >
                        <ArrowLeftIcon className="w-4 h-4 mr-1" />
                        Back to {countryName} rentals
                    </Link>
                </div>

                <LocationHeroBanner
                    locationName={heroTitle}
                    countryName={countryName}
                    countrySlug={countrySlug}
                    locationType="country"
                    shopCount={motorcycles.length}
                    cities={uniqueCities}
                    isCustomTitle={true}
                />

                <div className="mt-8">
                    <h2 className="text-xl text-gray-600 mb-8">
                        Found {motorcycles.length} available motorcycles in {uniqueCities.length} cities
                    </h2>

                    <MotorcycleCityList motorcycles={motorcycles} />
                </div>
            </div>
        </div>
    )
}

// --- Components ---

interface RelatedMotorcyclesProps {
    currentMotorcycleId: string
    shopId: string
    categoryId: string | null
    brandId: string
}

async function RelatedMotorcycles({
    currentMotorcycleId,
    shopId,
    categoryId,
    brandId
}: RelatedMotorcyclesProps) {
    try {
        // Get motorcycles from the same shop first
        const shopMotorcycles = await motorcycleService.getMotorcyclesByShop(shopId, 6)
        const filteredShopMotorcycles = shopMotorcycles.filter((m: any) => m.id !== currentMotorcycleId)

        if (filteredShopMotorcycles.length > 0) {
            return (
                <section>
                    <h2 className="text-2xl font-bold text-gray-900 mb-6">
                        More from this rental shop
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredShopMotorcycles.slice(0, 3).map((motorcycle: any) => (
                            <MotorcycleCard key={motorcycle.id} motorcycle={motorcycle} />
                        ))}
                    </div>
                </section>
            )
        }

        // If no motorcycles from same shop, get similar motorcycles by category
        if (categoryId) {
            const categoryResult = await motorcycleService.getMotorcycles({
                categoryId,
                limit: 4
            })
            const filteredCategoryMotorcycles = categoryResult.motorcycles.filter((m: any) => m.id !== currentMotorcycleId)

            if (filteredCategoryMotorcycles.length > 0) {
                return (
                    <section>
                        <h2 className="text-2xl font-bold text-gray-900 mb-6">
                            Similar motorcycles
                        </h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                            {filteredCategoryMotorcycles.slice(0, 3).map((motorcycle: any) => (
                                <MotorcycleCard key={motorcycle.id} motorcycle={motorcycle} />
                            ))}
                        </div>
                    </section>
                )
            }
        }

        return null
    } catch (error) {
        console.error('Error loading related motorcycles:', error)
        return null
    }
}
