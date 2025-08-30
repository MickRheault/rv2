import Link from 'next/link'
import { MagnifyingGlassIcon, MapPinIcon, CurrencyDollarIcon, ShieldCheckIcon } from '@heroicons/react/24/outline'
import AuthTokenDetector from '@/components/auth/AuthTokenDetector'
import HeroSearchForm from '@/components/search/HeroSearchForm'

export default function Home() {
  return (
    <>
      <AuthTokenDetector />
      {/* Hero Section */}
      <section className="relative min-h-[600px] flex items-center justify-center overflow-hidden">
        {/* Background Image */}
        <div 
          className="absolute inset-0 z-0"
          style={{
            backgroundImage: `url('https://images.unsplash.com/photo-1558980664-10e7170b5df9?q=80&w=1742&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D')`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat'
          }}
        >
          {/* Overlay */}
          <div className="absolute inset-0 bg-black/40"></div>
        </div>

        <div className="container-custom relative z-10">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-4xl md:text-6xl font-bold text-white mb-6 text-balance">
              Where do you want to ride?
            </h1>

            
            {/* Search Form */}
            <HeroSearchForm />
          </div>
        </div>
      </section>

      {/* Quick Stats removed per UI cleanup */}

      {/* Story/Promise Section (replaces feature grid) */}
      <section className="py-20 lg:py-32">
        <div className="container-custom">
          <div className="max-w-3xl mx-auto text-center space-y-6">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900">
              Ride the world, simply.
            </h2>
            <p className="text-lg md:text-xl text-gray-600">
              Discover verified rental shops, compare bikes at a glance, and go. No noise. Just the ride.
            </p>
          </div>
        </div>
      </section>

      {/* CTA Section removed per UI cleanup */}
    </>
  )
}