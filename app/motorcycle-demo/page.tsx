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
          {mockMotorcycles.map((motorcycle) => (
            <MotorcycleCard
              key={motorcycle.id}
              motorcycle={motorcycle}
              showShopInfo={true}
              showFeatures={true}
              compact={viewMode === 'compact'}
              onFavoriteToggle={handleFavoriteToggle}
              isFavorited={favorites.has(motorcycle.id)}
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