'use client'

import { QueryClient, QueryClientProvider, QueryCache, MutationCache } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { useState, ReactNode } from 'react'
import { CACHE_TIMES, STALE_TIMES } from '@/lib/cache/queryKeys'
import { performanceMonitor } from '@/lib/utils/performance'

interface QueryProviderProps {
  children: ReactNode
}

export default function QueryProvider({ children }: QueryProviderProps) {
  const [queryClient] = useState(
    () => {
      // Create custom query cache with performance tracking
      const queryCache = new QueryCache({
        onError: (error, query) => {
          console.error('Query error:', error, 'for query:', query.queryKey)
          
          // Track error in performance monitor
          performanceMonitor.trackQuery(
            JSON.stringify(query.queryKey),
            0,
            false,
            error instanceof Error ? error.message : 'Unknown error'
          )
        },
        onSuccess: (data, query) => {
          // Track successful query
          performanceMonitor.trackQuery(
            JSON.stringify(query.queryKey),
            query.state.dataUpdateCount > 0 ? 50 : 200, // Estimate cache hit vs miss
            query.state.dataUpdateCount > 0 // Cache hit if data was updated
          )
        },
      })

      // Create custom mutation cache
      const mutationCache = new MutationCache({
        onError: (error, variables, context, mutation) => {
          console.error('Mutation error:', error, 'for mutation:', mutation.options.mutationKey)
        },
      })

      return new QueryClient({
        queryCache,
        mutationCache,
        defaultOptions: {
          queries: {
            // Dynamic stale time based on query type
            staleTime: STALE_TIMES.DYNAMIC,
            // Dynamic cache time based on query type
            gcTime: CACHE_TIMES.DYNAMIC,
            // Retry failed requests with exponential backoff
            retry: (failureCount, error: any) => {
              // Don't retry on 4xx errors
              if (error?.status >= 400 && error?.status < 500) {
                return false
              }
              // Retry up to 3 times for other errors
              return failureCount < 3
            },
            retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
            // Smart refetch behavior
            refetchOnWindowFocus: process.env.NODE_ENV === 'production',
            refetchOnReconnect: true,
            refetchOnMount: true,
            // Network mode for offline support
            networkMode: 'online',
          },
          mutations: {
            // Retry failed mutations once with delay
            retry: 1,
            retryDelay: 1000,
            // Network mode for mutations
            networkMode: 'online',
          },
        },
      })
    }
  )

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {process.env.NODE_ENV === 'development' && (
        <ReactQueryDevtools initialIsOpen={false} />
      )}
    </QueryClientProvider>
  )
}

 