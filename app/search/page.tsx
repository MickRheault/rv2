import { Suspense } from 'react'
import { Metadata } from 'next'
import SearchPageContent from './SearchPageContent'
import { generateMetadata as generateSEOMetadata, PAGE_CONFIGS } from '@/lib/seo/config'
import { searchService } from '@/services/search'
import { motorcycleService } from '@/services/motorcycles'

export const revalidate = 86400

export const metadata: Metadata = generateSEOMetadata(PAGE_CONFIGS.search)

export default async function SearchPage() {
  const [popularResult, filterOptionsResult] = await Promise.allSettled([
    searchService.getPopularSearchLocations(6),
    motorcycleService.getFilterOptions()
  ])

  const initialPopularLocations =
    popularResult.status === 'fulfilled' ? popularResult.value : undefined
  const initialFilterOptions =
    filterOptionsResult.status === 'fulfilled' ? filterOptionsResult.value : undefined

  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading search...</p>
        </div>
      </div>
    }>
      <SearchPageContent
        initialPopularLocations={initialPopularLocations}
        initialFilterOptions={initialFilterOptions}
      />
    </Suspense>
  )
}