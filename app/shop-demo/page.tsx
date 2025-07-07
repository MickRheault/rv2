'use client'

import { useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import ShopCard from '@/components/shop/ShopCard'
import { Card, CardHeader, CardTitle, CardContent, Button } from '@/components/ui'
import { ShopWithDetails } from '@/services/shops'
import { PremiumTier } from '@/types/premium-listings'

// Create a query client for this demo
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
    },
  },
})

// Mock shop data for demo
const mockShops: ShopWithDetails[] = [
  {
    id: '1',
    provider_name: 'Bangkok Bike Rentals',
    location_name: 'Sukhumvit Branch',
    place_id: 'ChIJBangkokExample',
    full_address: '123 Sukhumvit Road, Watthana, Bangkok 10110, Thailand',
    city_id: '1',
    latitude: 13.7563,
    longitude: 100.5018,
    phone: '+66 2 123 4567',
    website: 'https://bangkokbikerentals.com',
    google_maps_url: 'https://maps.google.com/example1',
    business_status_id: 1,
    rating: 4.8,
    review_count: 156,
    slug: 'bangkok-bike-rentals-sukhumvit',
    business_description: 'Premium motorcycle rental service in the heart of Bangkok. We offer a wide range of motorcycles from scooters to sport bikes.',
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
    },
    business_statuses: {
      id: 1,
      status_code: 'verified',
      description: 'Verified business',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z'
    },
    rental_shop_inclusions: [
      {
        id: '1',
        shop_id: '1',
        inclusion_text: 'Helmet included',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      },
      {
        id: '2',
        shop_id: '1',
        inclusion_text: 'Free city map',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      },
      {
        id: '3',
        shop_id: '1',
        inclusion_text: '24/7 roadside assistance',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      },
      {
        id: '4',
        shop_id: '1',
        inclusion_text: 'Basic insurance coverage',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      }
    ],
    rental_shop_tours: [
      {
        id: '1',
        shop_id: '1',
        name: 'Bangkok City Tour',
        duration_text: '4 hours',
        distance_km: 25,
        price_text: '1,500 THB',
        currency: 'THB',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      },
      {
        id: '2',
        shop_id: '1',
        name: 'Temple Hopping Tour',
        duration_text: '6 hours',
        distance_km: 35,
        price_text: '2,000 THB',
        currency: 'THB',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      }
    ],
    rental_shop_service_locations: [
      {
        id: '1',
        shop_id: '1',
        location_name: 'Sukhumvit Branch',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      },
      {
        id: '2',
        shop_id: '1',
        location_name: 'Siam Square Pickup Point',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      },
      {
        id: '3',
        shop_id: '1',
        location_name: 'Airport Delivery Service',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      }
    ]
  },
  {
    id: '2',
    provider_name: 'Chiang Mai Scooters',
    location_name: null,
    place_id: 'ChIJChiangMaiExample',
    full_address: '456 Nimman Road, Su Thep, Mueang Chiang Mai District, Chiang Mai 50200, Thailand',
    city_id: '2',
    latitude: 18.7883,
    longitude: 98.9853,
    phone: '+66 53 987 654',
    website: 'https://chiangmaiscooters.co.th',
    google_maps_url: 'https://maps.google.com/example2',
    business_status_id: 2,
    rating: 4.6,
    review_count: 89,
    slug: 'chiang-mai-scooters',
    business_description: 'Your trusted partner for exploring Chiang Mai and northern Thailand. Specializing in automatic scooters perfect for city and mountain rides.',
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
    },
    business_statuses: {
      id: 2,
      status_code: 'active',
      description: 'Active business',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z'
    },
    rental_shop_inclusions: [
      {
        id: '5',
        shop_id: '2',
        inclusion_text: 'Helmet and rain gear',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      },
      {
        id: '6',
        shop_id: '2',
        inclusion_text: 'Mountain trail maps',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      }
    ],
    rental_shop_tours: [
      {
        id: '3',
        shop_id: '2',
        name: 'Doi Suthep Temple Tour',
        duration_text: '3 hours',
        distance_km: 20,
        price_text: '1,200 THB',
        currency: 'THB',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      }
    ],
    rental_shop_service_locations: [
      {
        id: '4',
        shop_id: '2',
        location_name: 'Nimman Road Shop',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      }
    ]
  },
  {
    id: '3',
    provider_name: 'Phuket Bike Paradise',
    location_name: 'Patong Beach Branch',
    place_id: 'ChIJPhuketExample',
    full_address: '789 Thaweewong Road, Patong, Kathu District, Phuket 83150, Thailand',
    city_id: '3',
    latitude: 7.8804,
    longitude: 98.2951,
    phone: null,
    website: null,
    google_maps_url: 'https://maps.google.com/example3',
    business_status_id: 3,
    rating: 3.8,
    review_count: 42,
    slug: 'phuket-bike-paradise',
    business_description: null,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    cities: {
      id: '3',
      name: 'Phuket',
      province_id: '3',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      provinces: {
        id: '3',
        name: 'Phuket',
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
    },
    business_statuses: {
      id: 3,
      status_code: 'pending',
      description: 'Pending verification',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z'
    },
    rental_shop_inclusions: [
      {
        id: '7',
        shop_id: '3',
        inclusion_text: 'Basic helmet',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      }
    ],
    rental_shop_tours: [],
    rental_shop_service_locations: [
      {
        id: '5',
        shop_id: '3',
        location_name: 'Patong Beach Shop',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      }
    ]
  }
]

function ShopDemo() {
  const [favorites, setFavorites] = useState<Set<string>>(new Set())
  const [viewMode, setViewMode] = useState<'grid' | 'compact'>('grid')

  const handleFavoriteToggle = (shopId: string, isFavorited: boolean) => {
    setFavorites(prev => {
      const newFavorites = new Set(prev)
      if (isFavorited) {
        newFavorites.add(shopId)
      } else {
        newFavorites.delete(shopId)
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
            Shop Card Demo
          </h1>
          <p className="text-lg text-gray-600 mb-6">
            Enhanced rental shop cards with location, ratings, services, and contact info
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
                ⭐
              </div>
              <h3 className="font-semibold text-sm">Star Ratings</h3>
              <p className="text-xs text-gray-600 mt-1">Visual star ratings with half-star support</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4 text-center">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-2">
                📍
              </div>
              <h3 className="font-semibold text-sm">Location Info</h3>
              <p className="text-xs text-gray-600 mt-1">Full address with location hierarchy</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4 text-center">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-2">
                🏷️
              </div>
              <h3 className="font-semibold text-sm">Status Badges</h3>
              <p className="text-xs text-gray-600 mt-1">Verification and service indicators</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4 text-center">
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center mx-auto mb-2">
                📞
              </div>
              <h3 className="font-semibold text-sm">Contact Info</h3>
              <p className="text-xs text-gray-600 mt-1">Phone and website with click-to-action</p>
            </CardContent>
          </Card>
        </div>

        {/* Shop Cards */}
        <div className={`grid gap-6 ${
          viewMode === 'compact' 
            ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' 
            : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
        }`}>
          {mockShops.map((shop, index) => {
            // Create premium config for first two shops
            const premium = (index === 0 || index === 1) ? {
              isPremium: true,
              premiumType: (index === 0 ? 'platinum' : 'featured') as PremiumTier,
              boostScore: index === 0 ? 75 : 100,
              daysRemaining: index === 0 ? 15 : 3,
              endDate: new Date(Date.now() + (index === 0 ? 15 : 3) * 24 * 60 * 60 * 1000).toISOString()
            } : undefined
            
            return (
            <ShopCard
              key={shop.id}
              shop={shop}
              showServices={true}
              showInclusions={true}
              compact={viewMode === 'compact'}
              onFavoriteToggle={handleFavoriteToggle}
              isFavorited={favorites.has(shop.id)}
                premium={premium}
            />
            )
          })}
        </div>

        {/* Features Documentation */}
        <div className="mt-12">
          <Card>
            <CardHeader>
              <CardTitle>ShopCard Component Features</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold mb-2">Visual Features</h4>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li>• Visual star ratings with half-star precision</li>
                    <li>• Status badges (verified, tours, delivery)</li>
                    <li>• Hover effects and smooth transitions</li>
                    <li>• Responsive design with compact mode</li>
                    <li>• Professional card styling</li>
                  </ul>
                </div>
                
                <div>
                  <h4 className="font-semibold mb-2">Information Display</h4>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li>• Shop name and location details</li>
                    <li>• Full address with location hierarchy</li>
                    <li>• Rating and review count display</li>
                    <li>• Business description and status</li>
                    <li>• Contact information (phone, website)</li>
                  </ul>
                </div>
                
                <div>
                  <h4 className="font-semibold mb-2">Services & Inclusions</h4>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li>• Tour packages with count display</li>
                    <li>• Service location information</li>
                    <li>• Rental inclusions with expand/collapse</li>
                    <li>• Delivery and pickup indicators</li>
                    <li>• Service summary in compact mode</li>
                  </ul>
                </div>
                
                <div>
                  <h4 className="font-semibold mb-2">Interactive Features</h4>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li>• Favorite toggle with heart animation</li>
                    <li>• Share functionality (ready for implementation)</li>
                    <li>• Clickable phone and website links</li>
                    <li>• Navigation to shop details page</li>
                    <li>• Expandable inclusions list</li>
                  </ul>
                </div>
              </div>
              
              <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                <h4 className="font-semibold text-blue-900 mb-2">Usage Example</h4>
                <pre className="text-sm text-blue-800 overflow-x-auto">
{`<ShopCard
  shop={shopData}
  showServices={true}
  showInclusions={true}
  compact={false}
  onFavoriteToggle={handleFavorite}
  isFavorited={favorites.has(shop.id)}
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

export default function ShopDemoPage() {
  return (
    <QueryClientProvider client={queryClient}>
      <ShopDemo />
    </QueryClientProvider>
  )
} 