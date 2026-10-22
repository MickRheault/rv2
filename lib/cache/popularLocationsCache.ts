import { LocationSearchResult } from '@/services/search'
import { FilterOptions } from '@/services/motorcycles'

export const CLIENT_CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

export const POPULAR_LOCATIONS_STORAGE_KEY = 'rv2:popular-locations:v1'
export const POPULAR_LOCATIONS_TTL_MS = CLIENT_CACHE_TTL_MS

export const FILTER_OPTIONS_STORAGE_KEY = 'rv2:filter-options:v1'
export const FILTER_OPTIONS_TTL_MS = CLIENT_CACHE_TTL_MS

export const LOCATION_SUGGESTIONS_TTL_MS = CLIENT_CACHE_TTL_MS

export interface CachedStorageEntry<T> {
  timestamp: number
  data: T
}

export function shouldBypassClientCache(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const params = new URLSearchParams(window.location?.search || '')
    const nocache = params.get('nocache')
    return nocache === '1' || nocache === 'true'
  } catch {
    return false
  }
}

function readStorageEntry<T>(
  key: string,
  ttlMs: number,
  isValidData: (data: unknown) => data is T
): CachedStorageEntry<T> | undefined {
  if (typeof window === 'undefined') return undefined
  try {
    if (shouldBypassClientCache()) {
      window.localStorage.removeItem(key)
      return undefined
    }
    const raw = window.localStorage.getItem(key)
    if (!raw) return undefined
    const parsed = JSON.parse(raw) as CachedStorageEntry<unknown>
    if (!parsed || typeof parsed.timestamp !== 'number' || !isValidData(parsed.data)) {
      return undefined
    }
    if (Date.now() - parsed.timestamp > ttlMs) {
      window.localStorage.removeItem(key)
      return undefined
    }
    return { timestamp: parsed.timestamp, data: parsed.data }
  } catch {
    return undefined
  }
}

function writeStorageEntry<T>(key: string, data: T): void {
  if (typeof window === 'undefined') return
  try {
    if (shouldBypassClientCache()) {
      window.localStorage.removeItem(key)
      return
    }
    const payload: CachedStorageEntry<T> = {
      timestamp: Date.now(),
      data
    }
    window.localStorage.setItem(key, JSON.stringify(payload))
  } catch {
    // Ignore storage quota or private mode errors
  }
}

export function readCachedPopularLocationsEntry(): CachedStorageEntry<LocationSearchResult[]> | undefined {
  return readStorageEntry(
    POPULAR_LOCATIONS_STORAGE_KEY,
    POPULAR_LOCATIONS_TTL_MS,
    (data): data is LocationSearchResult[] => Array.isArray(data)
  )
}

export function writeCachedPopularLocations(data: LocationSearchResult[]): void {
  writeStorageEntry(POPULAR_LOCATIONS_STORAGE_KEY, data)
}

export function readCachedFilterOptionsEntry(): CachedStorageEntry<FilterOptions> | undefined {
  return readStorageEntry(
    FILTER_OPTIONS_STORAGE_KEY,
    FILTER_OPTIONS_TTL_MS,
    (data): data is FilterOptions =>
      Boolean(data && typeof data === 'object' && Array.isArray((data as FilterOptions).brands))
  )
}

export function writeCachedFilterOptions(data: FilterOptions): void {
  writeStorageEntry(FILTER_OPTIONS_STORAGE_KEY, data)
}
