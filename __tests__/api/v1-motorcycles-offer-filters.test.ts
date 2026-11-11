/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server'
import { GET as listMotorcycles } from '@/app/api/v1/motorcycles/route'
import { motorcycleService } from '@/services/motorcycles'

jest.mock('@/lib/api/middleware', () => ({
  requireAuth: jest.fn().mockResolvedValue({ authorized: true }),
}))

jest.mock('@/lib/api/rate-limit', () => ({
  rateLimit: jest.fn().mockReturnValue({ allowed: true, remaining: 99, resetAt: 1234567890 }),
  getRateLimitHeaders: jest.fn().mockReturnValue({}),
}))

jest.mock('@/services/motorcycles', () => ({
  motorcycleService: {
    getMotorcycles: jest.fn(),
  },
}))

describe('GET /api/v1/motorcycles — Offer Currency, Duration & Known-Price Query Validation (#225)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(motorcycleService.getMotorcycles as jest.Mock).mockResolvedValue({
      motorcycles: [],
      total: 0,
    })
  })

  it('normalizes and forwards valid currency, durationDays, and knownPriceOnly parameters while rejecting invalid values with 400', async () => {
    const validReq = new NextRequest(
      'http://localhost:3000/api/v1/motorcycles?currency=%20usd%20&durationDays=7&knownPriceOnly=true&minPrice=5&maxPrice=25'
    )
    const validRes = await listMotorcycles(validReq)
    expect(validRes.status).toBe(200)
    expect(motorcycleService.getMotorcycles).toHaveBeenCalledWith(
      expect.objectContaining({
        currency: 'USD',
        durationDays: 7,
        knownPriceOnly: true,
        minPrice: 5,
        maxPrice: 25,
      })
    )

    // Boolean alias variants ('1', 'false', '0')
    for (const [rawVal, expected] of [
      ['1', true],
      ['false', false],
      ['0', false],
    ] as const) {
      ;(motorcycleService.getMotorcycles as jest.Mock).mockClear()
      const res = await listMotorcycles(
        new NextRequest(`http://localhost:3000/api/v1/motorcycles?knownPriceOnly=${rawVal}`)
      )
      expect(res.status).toBe(200)
      expect(motorcycleService.getMotorcycles).toHaveBeenCalledWith(
        expect.objectContaining({ knownPriceOnly: expected })
      )
    }

    // Invalid currency codes -> 400
    for (const badCurrency of ['US', 'USDT', '123', '$']) {
      ;(motorcycleService.getMotorcycles as jest.Mock).mockClear()
      const res = await listMotorcycles(
        new NextRequest(
          `http://localhost:3000/api/v1/motorcycles?currency=${encodeURIComponent(badCurrency)}`
        )
      )
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error.message).toBe('Invalid currency code; expected 3-letter ISO code')
      expect(motorcycleService.getMotorcycles).not.toHaveBeenCalled()
    }

    // Invalid durationDays -> 400
    for (const badDuration of ['0', '-5', 'abc', '1.5', '3651']) {
      ;(motorcycleService.getMotorcycles as jest.Mock).mockClear()
      const res = await listMotorcycles(
        new NextRequest(
          `http://localhost:3000/api/v1/motorcycles?durationDays=${encodeURIComponent(badDuration)}`
        )
      )
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error.message).toBe('durationDays must be a positive integer')
      expect(motorcycleService.getMotorcycles).not.toHaveBeenCalled()
    }

    // Invalid knownPriceOnly -> 400
    for (const badBool of ['yes', '2', 'maybe']) {
      ;(motorcycleService.getMotorcycles as jest.Mock).mockClear()
      const res = await listMotorcycles(
        new NextRequest(
          `http://localhost:3000/api/v1/motorcycles?knownPriceOnly=${encodeURIComponent(badBool)}`
        )
      )
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error.message).toBe('knownPriceOnly must be true or false')
      expect(motorcycleService.getMotorcycles).not.toHaveBeenCalled()
    }

    // Invalid minPrice / maxPrice -> 400
    for (const badPriceQuery of ['minPrice=abc', 'maxPrice=-10', 'minPrice=500&maxPrice=100']) {
      ;(motorcycleService.getMotorcycles as jest.Mock).mockClear()
      const res = await listMotorcycles(
        new NextRequest(`http://localhost:3000/api/v1/motorcycles?${badPriceQuery}`)
      )
      expect(res.status).toBe(400)
      expect(motorcycleService.getMotorcycles).not.toHaveBeenCalled()
    }
  })
})
