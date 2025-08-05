import Link from 'next/link'
import { ErrorState } from '@/components/ui/LoadingStates'
import Button from '@/components/ui/Button'

export default function CountryNotFound() {
  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <ErrorState
          type="notFound"
          title="Country Not Found"
          message="The country you're looking for doesn't exist in our database or the URL format is invalid."
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

        {/* Popular countries suggestion */}
        <div className="mt-12 text-center">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Popular Countries
          </h3>
          <div className="flex flex-wrap justify-center gap-3">
            <Link 
              href="/thailand" 
              className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Thailand
            </Link>
            <Link 
              href="/vietnam" 
              className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Vietnam
            </Link>
            <Link 
              href="/indonesia" 
              className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Indonesia
            </Link>
            <Link 
              href="/philippines" 
              className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Philippines
            </Link>
          </div>
        </div>
      </div>
    </main>
  )
}