import { useEffect, useCallback, useRef, useState } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { SearchFilters } from '@/types'
import { 
  filtersToURLParams, 
  urlParamsToFilters, 
  areFiltersEquivalent,
  cleanURLParams 
} from '@/lib/utils/urlParams'
import { useSearchStore } from '@/lib/stores/searchStore'

interface UseURLParamsOptions {
  /**
   * Whether to automatically sync URL changes to the search store
   * @default true
   */
  autoSync?: boolean
  
  /**
   * Whether to replace the current history entry instead of pushing a new one
   * @default false
   */
  replace?: boolean
  
  /**
   * Debounce delay in milliseconds for URL updates
   * @default 300
   */
  debounceMs?: number
  
  /**
   * Callback fired when URL parameters change
   */
  onParamsChange?: (filters: Partial<SearchFilters>) => void
}

/**
 * Custom hook for managing URL parameter synchronization with search state
 */
export function useURLParams(options: UseURLParamsOptions = {}) {
  const {
    autoSync = true,
    replace = false,
    debounceMs = 300,
    onParamsChange
  } = options

  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { filters, setFilters } = useSearchStore()
  
  // Track if we're on the client side to prevent hydration issues
  const [isClient, setIsClient] = useState(false)
  
  // Keep track of the last URL update to prevent infinite loops
  const lastURLUpdateRef = useRef<string>('')
  const debounceTimeoutRef = useRef<NodeJS.Timeout>()

  // Set client-side flag after hydration
  useEffect(() => {
    setIsClient(true)
  }, [])

  /**
   * Parse current URL parameters to filters
   */
  const parseURLParams = useCallback((): Partial<SearchFilters> => {
    return urlParamsToFilters(searchParams)
  }, [searchParams])

  /**
   * Update URL with current filters
   */
  const updateURL = useCallback((newFilters: SearchFilters, immediate = false) => {
    // Clear existing timeout
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current)
    }

    const doUpdate = () => {
      const params = filtersToURLParams(newFilters)
      const cleanedParams = cleanURLParams(params)
      const queryString = cleanedParams.toString()
      const newURL = queryString ? `${pathname}?${queryString}` : pathname
      
      // Avoid updating if URL hasn't changed
      if (lastURLUpdateRef.current !== newURL) {
        lastURLUpdateRef.current = newURL
        
        if (replace) {
          router.replace(newURL as any)
        } else {
          router.push(newURL as any)
        }
      }
    }

    if (immediate || debounceMs <= 0) {
      doUpdate()
    } else {
      debounceTimeoutRef.current = setTimeout(doUpdate, debounceMs)
    }
  }, [pathname, router, replace, debounceMs])

  /**
   * Sync URL parameters to search store
   */
  const syncFromURL = useCallback(() => {
    if (!autoSync) return

    const urlFilters = parseURLParams()
    
    // Only update if there are actual differences
    if (Object.keys(urlFilters).length > 0) {
      // Check if the URL filters are different from current filters
      const currentURLString = filtersToURLParams(filters).toString()
      const newURLString = filtersToURLParams({ ...filters, ...urlFilters }).toString()
      
      if (currentURLString !== newURLString) {
        setFilters(urlFilters)
        onParamsChange?.(urlFilters)
      }
    }
  }, [autoSync, parseURLParams, filters, setFilters, onParamsChange])

  /**
   * Sync search store to URL parameters
   */
  const syncToURL = useCallback((newFilters?: SearchFilters) => {
    const filtersToSync = newFilters || filters
    updateURL(filtersToSync)
  }, [filters, updateURL])

  /**
   * Clear all URL parameters
   */
  const clearURLParams = useCallback(() => {
         lastURLUpdateRef.current = pathname
     if (replace) {
       router.replace(pathname as any)
     } else {
       router.push(pathname as any)
     }
  }, [pathname, router, replace])

  /**
   * Get current URL with updated filters
   */
  const getURLWithFilters = useCallback((newFilters: SearchFilters): string => {
    const params = filtersToURLParams(newFilters)
    const cleanedParams = cleanURLParams(params)
    const queryString = cleanedParams.toString()
    return queryString ? `${pathname}?${queryString}` : pathname
  }, [pathname])

  /**
   * Check if current URL has search parameters
   */
  const hasURLParams = useCallback((): boolean => {
    if (!isClient) return false
    return searchParams.toString().length > 0
  }, [searchParams, isClient])

  // Sync from URL on mount and when search params change (only on client)
  useEffect(() => {
    if (isClient) {
      syncFromURL()
    }
  }, [syncFromURL, isClient])

  // Sync to URL when filters change (but not on mount to avoid double sync)
  const isInitialMount = useRef(true)
  useEffect(() => {
    if (!isClient) return
    
    if (isInitialMount.current) {
      isInitialMount.current = false
      return
    }
    
    // Always sync filters to URL when they change
    syncToURL()
  }, [filters, syncToURL, isClient])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current)
      }
    }
  }, [])

  return {
    // Current state
    urlParams: isClient ? parseURLParams() : {},
    hasParams: hasURLParams(),
    isClient,
    
    // Actions
    syncFromURL,
    syncToURL,
    updateURL,
    clearURLParams,
    getURLWithFilters,
    
    // Utilities
    parseURLParams,
    isLoading: false // Could be enhanced to track async operations
  }
}

/**
 * Simplified hook for just reading URL parameters
 */
export function useURLFilters(): Partial<SearchFilters> {
  const searchParams = useSearchParams()
  const [isClient, setIsClient] = useState(false)

  // Set client-side flag after hydration
  useEffect(() => {
    setIsClient(true)
  }, [])

  if (!isClient) {
    return {}
  }

  return urlParamsToFilters(searchParams)
}

/**
 * Hook for managing pagination in URL
 */
export function useURLPagination() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isClient, setIsClient] = useState(false)

  // Set client-side flag after hydration
  useEffect(() => {
    setIsClient(true)
  }, [])
  
  const currentPage = isClient ? parseInt(searchParams.get('page') || '1', 10) : 1
  const currentLimit = isClient ? parseInt(searchParams.get('limit') || '20', 10) : 20
  
  const setPage = useCallback((page: number) => {
    if (!isClient) return
    const params = new URLSearchParams(searchParams.toString())
    params.set('page', page.toString())
         router.push(`${pathname}?${params.toString()}` as any)
   }, [pathname, router, searchParams, isClient])
   
   const setLimit = useCallback((limit: number) => {
     if (!isClient) return
     const params = new URLSearchParams(searchParams.toString())
     params.set('limit', limit.toString())
     params.set('page', '1') // Reset to first page when changing limit
     router.push(`${pathname}?${params.toString()}` as any)
  }, [pathname, router, searchParams, isClient])
  
  return {
    page: Math.max(1, currentPage),
    limit: Math.min(Math.max(1, currentLimit), 100),
    setPage,
    setLimit,
    isClient
  }
} 