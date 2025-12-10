'use client'

import Link from 'next/link'

interface City {
  id: string
  name: string
  slug?: string
}

interface LocationHeroBannerProps {
  locationName: string
  countryName?: string
  countrySlug?: string
  locationType: 'country' | 'city'
  shopCount: number
  cities?: City[]
}

export default function LocationHeroBanner({ 
  locationName, 
  countryName,
  countrySlug,
  locationType,
  shopCount,
  cities = []
}: LocationHeroBannerProps) {
  const title = locationType === 'city'
    ? `Motorcycle Rentals in ${locationName}, ${countryName}`
    : `Motorcycle Rentals in ${locationName}`

  const subtitle = shopCount > 0
    ? `Discover ${shopCount} rental ${shopCount === 1 ? 'shop' : 'shops'} and start your adventure`
    : 'Explore motorcycle rental options for your next adventure'

  return (
    <div className="relative h-[400px] w-full overflow-hidden rounded-2xl mb-8">
      {/* Background Gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-purple-600 to-blue-800">
        {/* Overlay pattern for texture */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }} />
        </div>
        {/* Dark overlay for text readability */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/30 to-black/40" />
      </div>

      {/* Content */}
      <div className="relative h-full flex flex-col items-center justify-center text-center px-4 sm:px-6 lg:px-8">
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-4 drop-shadow-lg">
          {title}
        </h1>
        <p className="text-lg sm:text-xl text-white/90 max-w-2xl drop-shadow-md">
          {subtitle}
        </p>
        
        {/* City Links - Only show on country pages */}
        {locationType === 'country' && cities.length > 0 && countrySlug && (
          <div className="mt-6 max-w-4xl">
            <p className="text-sm text-white/80 mb-3 font-medium">Popular Cities:</p>
            <div className="flex flex-wrap justify-center gap-2">
              {cities.slice(0, 10).map((city) => {
                const citySlug = city.slug || city.name.toLowerCase().replace(/\s+/g, '-')
                return (
                  <Link
                    key={city.id}
                    href={`/${countrySlug}/${citySlug}`}
                    className="px-4 py-2 bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-full text-white text-sm font-medium transition-all duration-200 hover:scale-105 border border-white/20 hover:border-white/40"
                  >
                    {city.name}
                  </Link>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

