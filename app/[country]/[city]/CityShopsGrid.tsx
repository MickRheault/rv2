'use client'

import { ShopWithDetails } from '@/services/shops'
import ShopCard from '@/components/shop/ShopCard'
import ShopCardSkeleton from '../ShopCardSkeleton'
import { ErrorState } from '@/components/ui/LoadingStates'

interface CityShopsGridProps {
  shops: ShopWithDetails[]
  cityDisplayName: string
  countryDisplayName: string
  isLoading?: boolean
}

export default function CityShopsGrid({ 
  shops, 
  cityDisplayName, 
  countryDisplayName, 
  isLoading = false 
}: CityShopsGridProps) {
  // Show loading state with skeleton cards
  if (isLoading) {
    return (
      <>
        {/* Loading summary */}
        <div className="mb-6">
          <div className="h-5 bg-gray-200 rounded w-64 animate-pulse"></div>
        </div>
        
        {/* Loading skeleton grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, index) => (
            <ShopCardSkeleton key={index} />
          ))}
        </div>
      </>
    )
  }

  return (
    <>
      {/* Results summary */}
      <div className="mb-6">
        <p className="text-gray-600">
          {shops.length === 0 
            ? `No rental shops found in ${cityDisplayName}, ${countryDisplayName}`
            : `Found ${shops.length} rental shop${shops.length === 1 ? '' : 's'} in ${cityDisplayName}, ${countryDisplayName}`
          }
        </p>
      </div>

      {/* Shop cards grid */}
      {shops.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {shops.map((shop) => (
            <ShopCard
              key={shop.id}
              shop={shop}
              premium={shop.premium}
            />
          ))}
        </div>
      )}

      {/* Empty state */}
      {shops.length === 0 && (
        <ErrorState
          type="notFound"
          title={`No rental shops in ${cityDisplayName}`}
          message={`We haven't found any motorcycle rental shops in ${cityDisplayName}, ${countryDisplayName} yet. Check back later as we continue to expand our coverage.`}
          onRetry={() => window.location.reload()}
          retryLabel="Refresh"
          className="mt-8"
        />
      )}
    </>
  )
}
