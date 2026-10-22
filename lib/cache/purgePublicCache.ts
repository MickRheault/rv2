import { revalidatePath } from 'next/cache'
import { clearAllTtlCaches } from '@/services/shops'

export const PUBLIC_EDGE_CACHE_CONTROL =
  'public, s-maxage=86400, stale-while-revalidate=604800'

/**
 * Purges server in-memory reference caches and invalidates Next.js ISR page cache.
 * Safe to call inside API Route Handlers as well as in unit tests / scripts outside
 * Next.js request context.
 */
export function purgePublicCache(): void {
  clearAllTtlCaches()

  try {
    revalidatePath('/', 'layout')
  } catch {
    // Ignore when called outside Next.js static generation / request store context (e.g. unit tests)
  }
}
