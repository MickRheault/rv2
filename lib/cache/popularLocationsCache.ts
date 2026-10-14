import { LocationSearchResult } from '@/services/search'

export const POPULAR_LOCATIONS_STORAGE_KEY = 'rv2:popular-locations:v1'
export const POPULAR_LOCATIONS_TTL_MS = 30 * 60 * 1000 // 30 minutes

interface CachedPopularLocationsPayload {
  timestamp: number
  data: LocationSearchResult[]
}

export function readCachedPopularLocations(): LocationSearchResult[] | undefined {
  if (typeof window === 'undefined') return undefined
  try {
    const raw = window.localStorage.getItem(POPULAR_LOCATIONS_STORAGE_KEY)
    if (!raw) return undefined
    const parsed = JSON.parse(raw) as CachedPopularLocationsPayload
    if (!parsed || typeof parsed.timestamp !== 'number' || !Array.isArray(parsed.data)) {
      return undefined
    }
    if (Date.now() - parsed.timestamp > POPULAR_LOCATIONS_TTL_MS) {
      window.localStorage.removeItem(POPULAR_LOCATIONS_STORAGE_KEY)
      return undefined
    }
    return parsed.data
  } catch {
    return undefined
  }
}

export function writeCachedPopularLocations(data: LocationSearchResult[]): void {
  if (typeof window === 'undefined') return
  try {
    const payload: CachedPopularLocationsPayload = {
      timestamp: Date.now(),
      data
    }
    window.localStorage.setItem(POPULAR_LOCATIONS_STORAGE_KEY, JSON.stringify(payload))
  } catch {
    // Ignore storage quota or private mode errors
  }
}
