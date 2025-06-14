export default function Home() {
  return (
    <main className="min-h-screen">
      {/* Hero Section - Mobile First */}
      <div className="container-custom py-8 md:py-16">
        <div className="text-center animate-fade-in">
          {/* Logo/Brand */}
          <div className="mb-6">
            <h1 className="text-primary-600 font-bold tracking-tight">
              🏍️ RideVault
            </h1>
            <p className="text-sm text-gray-600 mt-2 md:text-base">
              Global Motorcycle Rental Platform
            </p>
          </div>

          {/* Main Heading - Responsive Typography */}
          <h2 className="text-gray-900 font-bold mb-4 leading-tight">
            Find Your Perfect Ride Anywhere
          </h2>
          
          <p className="text-gray-600 mb-8 max-w-2xl mx-auto leading-relaxed">
            Discover and compare motorcycle rentals from trusted providers worldwide. 
            From scooters to adventure bikes, find the perfect motorcycle for your journey.
          </p>

          {/* CTA Buttons - Mobile First Layout */}
          <div className="flex flex-col space-y-4 sm:flex-row sm:space-y-0 sm:space-x-4 sm:justify-center">
            <button className="btn-primary touch-target">
              Start Searching
            </button>
            <button className="btn-secondary touch-target">
              Browse Locations
            </button>
          </div>
        </div>

        {/* Features Grid - Responsive */}
        <div className="mt-16 md:mt-24">
          <h3 className="text-center text-gray-900 mb-8">
            Why Choose RideVault?
          </h3>
          
          <div className="grid-responsive">
            <div className="card p-6 text-center animate-slide-up">
              <div className="text-2xl mb-3">🗺️</div>
              <h4 className="font-semibold text-gray-900 mb-2">Global Coverage</h4>
              <p className="text-gray-600 text-sm">
                Access rental shops worldwide in one platform
              </p>
            </div>
            
            <div className="card p-6 text-center animate-slide-up">
              <div className="text-2xl mb-3">💰</div>
              <h4 className="font-semibold text-gray-900 mb-2">Best Prices</h4>
              <p className="text-gray-600 text-sm">
                Compare prices across multiple providers instantly
              </p>
            </div>
            
            <div className="card p-6 text-center animate-slide-up">
              <div className="text-2xl mb-3">🔍</div>
              <h4 className="font-semibold text-gray-900 mb-2">Smart Filters</h4>
              <p className="text-gray-600 text-sm">
                Find exactly what you need with advanced filtering
              </p>
            </div>

            <div className="card p-6 text-center animate-slide-up sm:col-span-2 lg:col-span-1">
              <div className="text-2xl mb-3">📱</div>
              <h4 className="font-semibold text-gray-900 mb-2">Mobile Optimized</h4>
              <p className="text-gray-600 text-sm">
                Perfect experience on any device, anywhere
              </p>
            </div>
          </div>
        </div>

        {/* Status Banner */}
        <div className="mt-16 p-4 bg-accent-50 border border-accent-200 rounded-lg">
          <div className="flex items-center justify-center space-x-2">
            <div className="w-2 h-2 bg-accent-500 rounded-full animate-pulse"></div>
            <p className="text-accent-700 font-medium text-sm text-center">
              ✅ Tailwind CSS configured successfully with mobile-first responsive design!
            </p>
          </div>
          <p className="text-accent-600 text-xs text-center mt-2">
            Next.js 14 + TypeScript + Tailwind CSS ready for development 🚀
          </p>
        </div>
      </div>
    </main>
  )
} 