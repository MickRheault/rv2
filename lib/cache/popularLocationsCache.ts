import { LocationSearchResult } from '@/services/search'
import { FilterOptions } from '@/services/motorcycles'

export const POPULAR_LOCATIONS_STORAGE_KEY = 'rv2:popular-locations:v1'
export const POPULAR_LOCATIONS_TTL_MS = 30 * 60 * 1000 // 30 minutes

export const FILTER_OPTIONS_STORAGE_KEY = 'rv2:filter-options:v1'
export const FILTER_OPTIONS_TTL_MS = 5 * 60 * 1000 // 5 minutes

export interface CachedStorageEntry<T> {
  timestamp: number
  data: T
}

function readStorageEntry<T>(
  key: string,
  ttlMs: number,
  isValidData: (data: unknown) => data is T
): CachedStorageEntry<T> | undefined {
  if (typeof window === 'undefined') return undefined
  try {
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

export function readCachedPopularLocations(): LocationSearchResult[] | undefined {
  return readCachedPopularLocationsEntry()?.data
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
