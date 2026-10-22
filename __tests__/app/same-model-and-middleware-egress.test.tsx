import React from 'react'
import { render, screen } from '@testing-library/react'
import MotorcycleRouterPage, { revalidate as motorcycleRouterRevalidate } from '@/app/motorcycle/[...slug]/page'
import MotorcycleHubPage, { revalidate as motorcycleHubRevalidate } from '@/app/motorcycle/page'
import { revalidate as locationsApiRevalidate } from '@/app/api/locations/route'
import { middleware } from '@/middleware'
import { motorcycleService } from '@/services/motorcycles'
import { locationService } from '@/services/locations'
import { clearAllTtlCaches } from '@/services/shops'
import { createServerClient } from '@supabase/ssr'
import {
  POPULAR_LOCATIONS_TTL_MS,
  FILTER_OPTIONS_TTL_MS,
  readCachedPopularLocationsEntry,
  writeCachedPopularLocations,
} from '@/lib/cache/popularLocationsCache'
import { purgePublicCache } from '@/lib/cache/purgePublicCache'
import { revalidatePath } from 'next/cache'

const mockLinkCalls: Array<Record<string, any>> = []

jest.mock('next/link', () => ({
  __esModule: true,
  default: (props: any) => {
    mockLinkCalls.push(props)
    return <a href={props.href} data-prefetch={String(props.prefetch)}>{props.children}</a>
  },
}))

jest.mock('next/server', () => ({
  NextResponse: {
    next: jest.fn(() => ({
      cookies: {
        set: jest.fn(),
      },
    })),
  },
}))

jest.mock('next/navigation', () => ({
  notFound: jest.fn(() => {
    throw new Error('NEXT_NOT_FOUND')
  }),
  permanentRedirect: jest.fn(),
  useRouter: jest.fn(() => ({ push: jest.fn() })),
}))

jest.mock('@supabase/ssr', () => ({
  createServerClient: jest.fn(),
  createBrowserClient: jest.fn(() => ({})),
}))

jest.mock('@/components/motorcycle/MotorcycleDetails', () => ({
  __esModule: true,
  default: ({ sameModelCount, countryName }: any) => (
    <div data-testid="motorcycle-details">
      Count: {sameModelCount} in {countryName}
    </div>
  ),
}))

jest.mock('@/components/motorcycle/MotorcycleCard', () => ({
  __esModule: true,
  default: ({ motorcycle }: any) => <div data-testid="motorcycle-card">{motorcycle.id}</div>,
}))

jest.mock('@/components/motorcycle/MotorcycleCityList', () => ({
  __esModule: true,
  default: ({ motorcycles }: any) => (
    <div data-testid="motorcycle-city-list">Bikes: {motorcycles.length}</div>
  ),
}))

jest.mock('@/components/location/LocationHeroBanner', () => ({
  __esModule: true,
  default: ({ locationName }: any) => <div data-testid="hero-banner">{locationName}</div>,
}))

jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}))

jest.mock('@/services/shops', () => ({
  ...jest.requireActual('@/services/shops'),
  clearAllTtlCaches: jest.fn(),
}))

jest.mock('@/services/motorcycles', () => ({
  motorcycleService: {
    getMotorcycleById: jest.fn(),
    getSameModelCountInCountry: jest.fn(),
    resolveModelNameBySlug: jest.fn(),
    getSameModelMotorcyclesInCountry: jest.fn(),
    getMotorcyclesByShop: jest.fn(),
    getMotorcycles: jest.fn(),
    getBrands: jest.fn(),
    getAllMotorcyclesForHub: jest.fn(),
  },
}))

jest.mock('@/services/locations', () => ({
  locationService: {
    getCountryByName: jest.fn(),
  },
}))

describe('App Route & Middleware Egress Mitigations (#180)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockLinkCalls.length = 0
  })

  describe('/motorcycle/[...slug] page', () => {
    it('uses getSameModelCountInCountry instead of getSameModelMotorcyclesInCountry on /motorcycle/[id]', async () => {
      ;(motorcycleService.getMotorcycleById as jest.Mock).mockResolvedValue({
        id: 'bike-123',
        model: 'Click 125',
        brand_id: 'brand-honda',
        shop_id: 'shop-1',
        category_id: 'cat-1',
        availability_status: 'available',
        brands: { id: 'brand-honda', name: 'Honda' },
        categories: { id: 'cat-1', name: 'Scooter' },
        rental_shops: {
          id: 'shop-1',
          cities: {
            name: 'Chiang Mai',
            provinces: {
              country_code: 'TH',
              countries: { code: 'TH', name: 'Thailand' },
            },
          },
        },
      })
      ;(motorcycleService.getSameModelCountInCountry as jest.Mock).mockResolvedValue(9)
      ;(motorcycleService.getMotorcyclesByShop as jest.Mock).mockResolvedValue([])
      ;(motorcycleService.getMotorcycles as jest.Mock).mockResolvedValue({
        motorcycles: [],
        total: 0,
      })

      const ui: any = await MotorcycleRouterPage({
        params: Promise.resolve({ slug: ['bike-123'] }),
      })

      expect(motorcycleService.getSameModelCountInCountry).toHaveBeenCalledWith(
        'TH',
        'brand-honda',
        'Click 125',
        'bike-123'
      )
      expect(
        motorcycleService.getSameModelMotorcyclesInCountry
      ).not.toHaveBeenCalled()
      expect(JSON.stringify(ui)).toContain('"sameModelCount":9')
      expect(JSON.stringify(ui)).toContain('"countryName":"Thailand"')
    })

    it('resolves the exact model name via resolveModelNameBySlug before calling getSameModelMotorcyclesInCountry on /motorcycle/[country]/[model]', async () => {
      ;(locationService.getCountryByName as jest.Mock).mockResolvedValue({
        code: 'TH',
        name: 'Thailand',
      })
      ;(motorcycleService.getBrands as jest.Mock).mockResolvedValue([
        { id: 'brand-honda', name: 'Honda' },
      ])
      ;(motorcycleService.resolveModelNameBySlug as jest.Mock).mockResolvedValue(
        'Click 125i'
      )
      ;(
        motorcycleService.getSameModelMotorcyclesInCountry as jest.Mock
      ).mockResolvedValue([
        {
          id: 'bike-1',
          model: 'Click 125i',
          brands: { id: 'brand-honda', name: 'Honda' },
          rental_shops: {
            id: 'shop-1',
            cities: { id: 'city-1', name: 'Chiang Mai', slug: 'chiang-mai' },
          },
        },
      ])

      const ui = await MotorcycleRouterPage({
        params: Promise.resolve({ slug: ['thailand', 'honda-click-125i'] }),
      })
      render(ui)

      expect(motorcycleService.resolveModelNameBySlug).toHaveBeenCalledWith(
        'brand-honda',
        'Honda',
        'honda-click-125i'
      )
      expect(
        motorcycleService.getSameModelMotorcyclesInCountry
      ).toHaveBeenCalledWith('TH', 'brand-honda', 'Click 125i')
      expect(
        motorcycleService.getSameModelMotorcyclesInCountry
      ).not.toHaveBeenCalledWith(expect.anything(), expect.anything(), '%')
    })

    it('skips getSameModelMotorcyclesInCountry when resolveModelNameBySlug returns null', async () => {
      ;(locationService.getCountryByName as jest.Mock).mockResolvedValue({
        code: 'VN',
        name: 'Vietnam',
      })
      ;(motorcycleService.getBrands as jest.Mock).mockResolvedValue([
        { id: 'brand-yamaha', name: 'Yamaha' },
      ])
      ;(motorcycleService.resolveModelNameBySlug as jest.Mock).mockResolvedValue(
        null
      )

      const ui = await MotorcycleRouterPage({
        params: Promise.resolve({ slug: ['vietnam', 'yamaha-nonexistent-999'] }),
      })
      render(ui)

      expect(
        motorcycleService.getSameModelMotorcyclesInCountry
      ).not.toHaveBeenCalled()
    })
  })

  describe('/motorcycle hub page prefetching', () => {
    it('renders /motorcycle/[country]/[model] links with prefetch={false}', async () => {
      ;(motorcycleService.getAllMotorcyclesForHub as jest.Mock).mockResolvedValue([
        {
          id: 'bike-1',
          model: 'Click 125',
          brands: { name: 'Honda' },
          rental_shops: {
            id: 'shop-1',
            cities: {
              id: 'city-1',
              name: 'Chiang Mai',
              provinces: {
                id: 'prov-1',
                name: 'Chiang Mai',
                country_code: 'TH',
                countries: { code: 'TH', name: 'Thailand' },
              },
            },
          },
        },
      ])

      const ui = await MotorcycleHubPage()
      render(ui)

      const hubLink = mockLinkCalls.find(
        (props) => props.href === '/motorcycle/thailand/honda-click-125'
      )
      expect(hubLink).toBeDefined()
      expect(hubLink?.prefetch).toBe(false)
    })
  })

  describe('middleware.ts auth cookie short-circuit', () => {
    it('skips createServerClient and supabase.auth.getUser when no sb- auth cookie is present', async () => {
      const mockGetUser = jest.fn()
      ;(createServerClient as jest.Mock).mockReturnValue({
        auth: { getUser: mockGetUser },
      })

      const anonymousReq: any = {
        headers: new Headers(),
        cookies: {
          getAll: jest.fn(() => [{ name: '_ga', value: '123' }]),
          set: jest.fn(),
        },
      }

      await middleware(anonymousReq)
      expect(createServerClient).not.toHaveBeenCalled()
      expect(mockGetUser).not.toHaveBeenCalled()

      const authenticatedReq: any = {
        headers: new Headers(),
        cookies: {
          getAll: jest.fn(() => [
            { name: 'sb-zwibykqxbgqqramnyhks-auth-token', value: 'token-xyz' },
          ]),
          set: jest.fn(),
        },
      }

      mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
      await middleware(authenticatedReq)
      expect(createServerClient).toHaveBeenCalledTimes(1)
      expect(mockGetUser).toHaveBeenCalledTimes(1)
    })
  })

  describe('24-hour TTLs, ?nocache=1 client bypass, and purgePublicCache', () => {
    it('exports revalidate = 86400 (24 hours) on public ISR routes', () => {
      expect(motorcycleRouterRevalidate).toBe(86400)
      expect(motorcycleHubRevalidate).toBe(86400)
      expect(locationsApiRevalidate).toBe(86400)
    })

    it('standardizes client localStorage TTLs to 24 hours and skips/clears cache when ?nocache=1 is in URL', () => {
      expect(POPULAR_LOCATIONS_TTL_MS).toBe(24 * 60 * 60 * 1000)
      expect(FILTER_OPTIONS_TTL_MS).toBe(24 * 60 * 60 * 1000)

      writeCachedPopularLocations([
        {
          type: 'city',
          id: 'city-1',
          name: 'Chiang Mai',
          fullName: 'Chiang Mai, Thailand',
          shopCount: 10,
          motorcycleCount: 50,
        },
      ])
      expect(readCachedPopularLocationsEntry()?.data).toHaveLength(1)

      window.history.pushState({}, '', '/search?nocache=1')
      expect(readCachedPopularLocationsEntry()).toBeUndefined()
      window.history.pushState({}, '', '/')
      expect(readCachedPopularLocationsEntry()).toBeUndefined()
    })

    it('purges in-memory reference caches and calls revalidatePath("/", "layout") via purgePublicCache', () => {
      purgePublicCache()
      expect(clearAllTtlCaches).toHaveBeenCalledTimes(1)
      expect(revalidatePath).toHaveBeenCalledWith('/', 'layout')
    })
  })
})
