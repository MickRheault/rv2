import Link from 'next/link'
import { ErrorState } from '@/components/ui/LoadingStates'
import Button from '@/components/ui/Button'

export default function CityNotFound() {
  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <ErrorState
          type="notFound"
          title="City Not Found"
          message="The city you're looking for doesn't exist in our database, doesn't belong to the specified country, or the URL format is invalid."
          className="mt-16"
        />
        
        {/* Additional actions */}
        <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
          <Button
            variant="primary"
            className="flex-1 sm:flex-none"
          >
            <Link href="/browse" className="flex items-center justify-center w-full">
              Browse All Locations
            </Link>
          </Button>
          
          <Button
            variant="outline"
            className="flex-1 sm:flex-none"
          >
            <Link href="/search" className="flex items-center justify-center w-full">
              Search Motorcycles
            </Link>
          </Button>
          
          <Button
            variant="outline"
            className="flex-1 sm:flex-none"
          >
            <Link href="/" className="flex items-center justify-center w-full">
              Go Home
            </Link>
          </Button>
        </div>

        {/* Popular city suggestions */}
        <div className="mt-12 text-center">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Popular Cities
          </h3>
          <div className="flex flex-wrap justify-center gap-3">
            <Link 
              href="/thailand/bangkok" 
              className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Bangkok, Thailand
            </Link>
            <Link 
              href="/thailand/chiang-mai" 
              className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Chiang Mai, Thailand
            </Link>
            <Link 
              href="/vietnam/hanoi" 
              className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Hanoi, Vietnam
            </Link>
            <Link 
              href="/vietnam/ho-chi-minh-city" 
              className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Ho Chi Minh City, Vietnam
            </Link>
          </div>
        </div>


      </div>
    </main>
  )
}