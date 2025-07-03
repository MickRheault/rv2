'use client'

import { useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import MotorcycleCard from '@/components/motorcycle/MotorcycleCard'
import { Card, CardHeader, CardTitle, CardContent, Button, Badge } from '@/components/ui'
import { MotorcycleWithDetails } from '@/services/motorcycles'

// Create a query client for this demo
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
    },
  },
})

// Mock motorcycle data for demo
const mockMotorcycles: MotorcycleWithDetails[] = [
  {
    id: '1',
    model: 'CBR600RR',
    year: 2023,
    engine_capacity_cc: 599,
    rental_rate_per_day: 85,
    rental_rate_currency: 'USD',
    availability_status: 'available',
    brand_id: '1',
    shop_id: '1',
    category_id: '1',
    conditions_details: null,
    specifications_details: null,
    source_url: null,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    brands: {
      id: '1',
      name: 'Honda',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z'
    },
    categories: {
      id: '1',
      name: 'Sport',
      description: 'High-performance sport motorcycles',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z'
    },
    rental_shops: {
      id: '1',
      provider_name: 'Bangkok Bike Rentals',
      full_address: '123 Sukhumvit Road, Bangkok',
      rating: 4.8,
      review_count: 156,
      slug: 'bangkok-bike-rentals',
      business_description: null,
      business_status_id: null,
      city_id: '1',
      google_maps_url: null,
      latitude: null,
      longitude: null,
      location_name: null,
      phone: null,
      place_id: null,
      website: null,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      cities: {
        id: '1',
        name: 'Bangkok',
        province_id: '1',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        provinces: {
          id: '1',
          name: 'Bangkok',
          country_code: 'TH',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
          countries: {
            code: 'TH',
            name: 'Thailand',
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z'
          }
        }
      }
    },
    motorcycle_images: [
      {
        image_id: '1',
        motorcycle_id: '1',
        sort_order: 1,
        images: {
          id: '1',
          url: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&h=600&fit=crop',
          alt_text: 'Honda CBR600RR Sport Motorcycle'
        }
      },
      {
        image_id: '2',
        motorcycle_id: '1',
        sort_order: 2,
        images: {
          id: '2',
          url: 'https://images.unsplash.com/photo-1571068316344-75bc76f77890?w=800&h=600&fit=crop',
          alt_text: 'Honda CBR600RR Side View'
        }
      }
    ],
    motorcycle_features: [
      {
        feature_id: '1',
        motorcycle_id: '1',
        features: {
          id: '1',
          name: 'ABS',
          description: 'Anti-lock Braking System',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z'
        }
      },
      {
        feature_id: '2',
        motorcycle_id: '1',
        features: {
          id: '2',
          name: 'GPS Navigation',
          description: 'Built-in GPS system',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z'
        }
      },
      {
        feature_id: '3',
        motorcycle_id: '1',
        features: {
          id: '3',
          name: 'Helmet Included',
          description: 'Free helmet provided',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z'
        }
      }
    ]
  },
  {
    id: '2',
    model: 'PCX 160',
    year: 2024,
    engine_capacity_cc: 157,
    rental_rate_per_day: 25,
    rental_rate_currency: 'USD',
    availability_status: 'available',
    brand_id: '1',
    shop_id: '2',
    category_id: '2',
    conditions_details: null,
    specifications_details: null,
    source_url: null,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    brands: {
      id: '1',
      name: 'Honda',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z'
    },
    categories: {
      id: '2',
      name: 'Scooter',
      description: 'Urban commuter scooters',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z'
    },
    rental_shops: {
      id: '2',
      provider_name: 'Chiang Mai Scooters',
      full_address: '456 Nimman Road, Chiang Mai',
      rating: 4.6,
      review_count: 89,
      slug: 'chiang-mai-scooters',
      business_description: null,
      business_status_id: null,
      city_id: '2',
      google_maps_url: null,
      latitude: null,
      longitude: null,
      location_name: null,
      phone: null,
      place_id: null,
      website: null,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      cities: {
        id: '2',
        name: 'Chiang Mai',
        province_id: '2',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        provinces: {
          id: '2',
          name: 'Chiang Mai',
          country_code: 'TH',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
          countries: {
            code: 'TH',
            name: 'Thailand',
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z'
          }
        }
      }
    },
    motorcycle_images: [
      {
        image_id: '3',
        motorcycle_id: '2',
        sort_order: 1,
        images: {
          id: '3',
          url: 'https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?w=800&h=600&fit=crop',
          alt_text: 'Honda PCX 160 Scooter'
        }
      }
    ],
    motorcycle_features: [
      {
        feature_id: '4',
        motorcycle_id: '2',
        features: {
          id: '4',
          name: 'Storage Box',
          description: 'Under-seat storage compartment',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z'
        }
      },
      {
        feature_id: '5',
        motorcycle_id: '2',
        features: {
          id: '5',
          name: 'USB Charging',
          description: 'Built-in USB charging port',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z'
        }
      }
    ]
  },
  {
    id: '3',
    model: 'Ninja 400',
    year: 2023,
    engine_capacity_cc: 399,
    rental_rate_per_day: 65,
    rental_rate_currency: 'USD',
    availability_status: 'maintenance',
    brand_id: '2',
    shop_id: '1',
    category_id: '1',
    conditions_details: null,
    specifications_details: null,
    source_url: null,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    brands: {
      id: '2',
      name: 'Kawasaki',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z'
    },
    categories: {
      id: '1',
      name: 'Sport',
      description: 'High-performance sport motorcycles',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z'
    },
    rental_shops: {
      id: '1',
      provider_name: 'Bangkok Bike Rentals',
      full_address: '123 Sukhumvit Road, Bangkok',
      rating: 4.8,
      review_count: 156,
      slug: 'bangkok-bike-rentals',
      business_description: null,
      business_status_id: null,
      city_id: '1',
      google_maps_url: null,
      latitude: null,
      longitude: null,
      location_name: null,
      phone: null,
      place_id: null,
      website: null,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      cities: {
        id: '1',
        name: 'Bangkok',
        province_id: '1',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        provinces: {
          id: '1',
          name: 'Bangkok',
          country_code: 'TH',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
          countries: {
            code: 'TH',
            name: 'Thailand',
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z'
          }
        }
      }
    },
    motorcycle_images: [
      {
        image_id: '4',
        motorcycle_id: '3',
        sort_order: 1,
        images: {
          id: '4',
          url: 'https://images.unsplash.com/photo-1609630875171-b1321377ee65?w=800&h=600&fit=crop',
          alt_text: 'Kawasaki Ninja 400'
        }
      }
    ],
    motorcycle_features: [
      {
        feature_id: '1',
        motorcycle_id: '3',
        features: {
          id: '1',
          name: 'ABS',
          description: 'Anti-lock Braking System',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z'
        }
      },
      {
        feature_id: '6',
        motorcycle_id: '3',
        features: {
          id: '6',
          name: 'Quick Shifter',
          description: 'Clutchless shifting technology',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z'
        }
      }
    ]
  }
]

function MotorcycleDemo() {
  const [favorites, setFavorites] = useState<Set<string>>(new Set())
  const [viewMode, setViewMode] = useState<'grid' | 'compact'>('grid')

  const handleFavoriteToggle = (motorcycleId: string, isFavorited: boolean) => {
    setFavorites(prev => {
      const newFavorites = new Set(prev)
      if (isFavorited) {
        newFavorites.add(motorcycleId)
      } else {
        newFavorites.delete(motorcycleId)
      }
      return newFavorites
    })
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Motorcycle Card Demo
          </h1>
          <p className="text-lg text-gray-600 mb-6">
            Enhanced motorcycle cards with images, specs, pricing, and features
          </p>
          
          {/* View Mode Toggle */}
          <div className="flex justify-center space-x-2">
            <Button
              variant={viewMode === 'grid' ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setViewMode('grid')}
            >
              Grid View
            </Button>
            <Button
              variant={viewMode === 'compact' ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setViewMode('compact')}
            >
              Compact View
            </Button>
          </div>
        </div>

        {/* Premium Badge Showcase */}
        <div className="mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="text-center">Premium Listing Badge Examples</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap justify-center gap-4">
                <div className="text-center">
                  <div className="bg-gradient-to-r from-yellow-400 to-yellow-600 text-white px-3 py-1 rounded-full text-sm font-medium shadow-lg inline-flex items-center">
                    <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Premium
                  </div>
                  <p className="text-xs text-gray-600 mt-1">Gold Tier</p>
                </div>
                
                <div className="text-center">
                  <div className="bg-gradient-to-r from-gray-300 to-gray-500 text-white px-3 py-1 rounded-full text-sm font-medium shadow-lg inline-flex items-center">
                    <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                    Premium+
                  </div>
                  <p className="text-xs text-gray-600 mt-1">Platinum Tier</p>
                </div>
                
                <div className="text-center">
                  <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white px-3 py-1 rounded-full text-sm font-medium shadow-lg inline-flex items-center animate-pulse">
                    <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    Featured
                  </div>
                  <p className="text-xs text-gray-600 mt-1">Featured Tier</p>
                </div>
              </div>
              <p className="text-sm text-gray-600 text-center mt-4">
                Premium listings get enhanced visibility with special badges, border effects, and priority placement in search results.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Feature Highlights */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="p-4 text-center">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-2">
                📸
              </div>
              <h3 className="font-semibold text-sm">Image Gallery</h3>
              <p className="text-xs text-gray-600 mt-1">Multiple images with navigation</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4 text-center">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-2">
                ⚡
              </div>
              <h3 className="font-semibold text-sm">Features Display</h3>
              <p className="text-xs text-gray-600 mt-1">Visual feature badges with icons</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4 text-center">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-2">
                💰
              </div>
              <h3 className="font-semibold text-sm">Smart Pricing</h3>
              <p className="text-xs text-gray-600 mt-1">Currency formatting and rates</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4 text-center">
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center mx-auto mb-2">
                ❤️
              </div>
              <h3 className="font-semibold text-sm">Favorites</h3>
              <p className="text-xs text-gray-600 mt-1">Interactive favorite toggle</p>
            </CardContent>
          </Card>
        </div>

        {/* Motorcycle Cards */}
        <div className={`grid gap-6 ${
          viewMode === 'compact' 
            ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' 
            : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
        }`}>
          {mockMotorcycles.map((motorcycle, index) => (
            <MotorcycleCard
              key={motorcycle.id}
              motorcycle={motorcycle}
              showShopInfo={true}
              showFeatures={true}
              compact={viewMode === 'compact'}
              onFavoriteToggle={handleFavoriteToggle}
              isFavorited={favorites.has(motorcycle.id)}
              isPremium={index === 0 || index === 2} // Make first and third cards premium
              premiumType={index === 0 ? 'featured' : index === 2 ? 'gold' : 'gold'}
            />
          ))}
        </div>

        {/* Features Documentation */}
        <div className="mt-12">
          <Card>
            <CardHeader>
              <CardTitle>Component Features</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold mb-2">Visual Enhancements</h4>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li>• Image gallery with navigation controls</li>
                    <li>• Hover effects and smooth transitions</li>
                    <li>• Category and availability badges</li>
                    <li>• Professional gradient overlays</li>
                    <li>• Responsive image handling with fallbacks</li>
                  </ul>
                </div>
                
                <div>
                  <h4 className="font-semibold mb-2">Interactive Features</h4>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li>• Favorite toggle with heart animation</li>
                    <li>• Share functionality (placeholder)</li>
                    <li>• Image carousel with indicators</li>
                    <li>• Clickable card for navigation</li>
                    <li>• Compact mode for dense layouts</li>
                  </ul>
                </div>
                
                <div>
                  <h4 className="font-semibold mb-2">Information Display</h4>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li>• Smart pricing with currency support</li>
                    <li>• Feature badges with descriptive icons</li>
                    <li>• Shop ratings and review counts</li>
                    <li>• Engine capacity and year specs</li>
                    <li>• Availability status indicators</li>
                  </ul>
                </div>
                
                <div>
                  <h4 className="font-semibold mb-2">Technical Features</h4>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li>• TypeScript with full type safety</li>
                    <li>• Responsive design with Tailwind CSS</li>
                    <li>• Accessibility features (ARIA labels)</li>
                    <li>• Error handling for missing images</li>
                    <li>• Performance optimized with Next.js Image</li>
                  </ul>
                </div>
              </div>
              
              <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                <h4 className="font-semibold text-blue-900 mb-2">Usage Example</h4>
                <pre className="text-sm text-blue-800 overflow-x-auto">
{`<MotorcycleCard
  motorcycle={motorcycleData}
  showShopInfo={true}
  showFeatures={true}
  compact={false}
  onFavoriteToggle={handleFavorite}
  isFavorited={favorites.has(motorcycle.id)}
  isPremium={true}
  premiumType="featured" // 'gold' | 'platinum' | 'featured'
/>`}
                </pre>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default function MotorcycleDemoPage() {
  return (
    <QueryClientProvider client={queryClient}>
      <MotorcycleDemo />
    </QueryClientProvider>
  )
} 