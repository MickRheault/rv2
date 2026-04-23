import Link from 'next/link'
import Image from 'next/image'
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
        <div className="absolute inset-0 z-0">
          <Image
            src="https://images.unsplash.com/photo-1558980664-10e7170b5df9?q=80&w=1742&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"
            alt="Motorcycle rider on scenic road"
            fill
            priority
            fetchPriority="high"
            className="object-cover"
            sizes="100vw"
          />
          {/* Overlay */}
          <div className="absolute inset-0 bg-black/40 z-10"></div>
        </div>

        <div className="container-custom relative z-20">
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
              Ride the world!
            </h2>
            <p className="text-lg md:text-xl text-gray-600">
              Discover rental shops and compare their bikes.
            </p>
          </div>
        </div>
      </section>

      {/* CTA Section removed per UI cleanup */}
    </>
  )
}