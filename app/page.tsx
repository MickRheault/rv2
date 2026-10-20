import Image from 'next/image'
import AuthTokenDetector from '@/components/auth/AuthTokenDetector'
import HeroDiscoveryCard from '@/components/search/HeroDiscoveryCard'

export default function Home() {
  return (
    <>
      <AuthTokenDetector />
      {/* Hero Section */}
      <section className="relative min-h-[600px] flex items-center justify-center overflow-hidden">
        {/* Background Image */}
        <div className="absolute inset-0 z-0">
          {/* Mobile Background Image */}
          <Image
            src="/images/hero-home-mobile.jpg"
            alt="Motorcycle rider on scenic road"
            fill
            priority
            fetchPriority="high"
            className="object-cover md:hidden"
            sizes="100vw"
          />
          {/* Desktop Background Image */}
          <Image
            src="/images/hero-home.jpg"
            alt="Motorcycle rider on scenic road"
            fill
            priority
            fetchPriority="high"
            className="hidden md:block object-cover"
            sizes="100vw"
          />
          {/* Overlay */}
          <div className="absolute inset-0 bg-black/40 z-10"></div>
        </div>

        <div className="container-custom relative z-20 py-12">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-4xl md:text-6xl font-bold text-white mb-4 text-balance">
              Where do you want to ride?
            </h1>
            <p className="text-lg md:text-xl text-white/90 mb-8 max-w-2xl mx-auto">
              Ask our AI rental assistant or browse motorcycles by country and city.
            </p>

            {/* AI Chat & Location Search Discovery Card */}
            <HeroDiscoveryCard />
          </div>
        </div>
      </section>
    </>
  )
}