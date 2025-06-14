import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import { SearchFilters, SearchLocation } from '@/types'

interface SearchState {
  // Search filters
  filters: SearchFilters
  
  // Search results state
  isLoading: boolean
  error: string | null
  
  // UI state
  showFilters: boolean
  
  // Recent searches
  recentSearches: SearchLocation[]
  
  // Actions
  setFilters: (filters: Partial<SearchFilters>) => void
  resetFilters: () => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  toggleFilters: () => void
  addRecentSearch: (location: SearchLocation) => void
  clearRecentSearches: () => void
}

const initialFilters: SearchFilters = {
  sortBy: 'newest'
}

export const useSearchStore = create<SearchState>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state
        filters: initialFilters,
        isLoading: false,
        error: null,
        showFilters: false,
        recentSearches: [],

        // Actions
        setFilters: (newFilters) =>
          set(
            (state) => ({
              filters: { ...state.filters, ...newFilters },
              error: null, // Clear error when filters change
            }),
            false,
            'setFilters'
          ),

        resetFilters: () =>
          set(
            { filters: initialFilters, error: null },
            false,
            'resetFilters'
          ),

        setLoading: (loading) =>
          set({ isLoading: loading }, false, 'setLoading'),

        setError: (error) =>
          set({ error, isLoading: false }, false, 'setError'),

        toggleFilters: () =>
          set(
            (state) => ({ showFilters: !state.showFilters }),
            false,
            'toggleFilters'
          ),

        addRecentSearch: (location) =>
          set(
            (state) => {
              const existing = state.recentSearches.find(
                (item) => item.id === location.id
              )
              
              if (existing) {
                // Move to front if already exists
                return {
                  recentSearches: [
                    location,
                    ...state.recentSearches.filter((item) => item.id !== location.id)
                  ].slice(0, 10) // Keep only 10 recent searches
                }
              }
              
              // Add new search to front
              return {
                recentSearches: [location, ...state.recentSearches].slice(0, 10)
              }
            },
            false,
            'addRecentSearch'
          ),

        clearRecentSearches: () =>
          set({ recentSearches: [] }, false, 'clearRecentSearches'),
      }),
      {
        name: 'ridevault-search-store',
        // Only persist certain parts of the state
        partialize: (state) => ({
          recentSearches: state.recentSearches,
          filters: {
            // Don't persist location to avoid stale data
            brand: state.filters.brand,
            category: state.filters.category,
            sortBy: state.filters.sortBy,
          },
        }),
      }
    ),
    {
      name: 'search-store',
    }
  )
) 