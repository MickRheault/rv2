'use client'

import dynamic from 'next/dynamic'

// Dynamically import the performance dashboard to avoid SSR issues
const PerformanceDashboard = dynamic(() => import('./PerformanceDashboard'), {
  ssr: false,
})

export { PerformanceDashboard }

// Export a simple wrapper for easy integration
export function DevTools() {
  if (process.env.NODE_ENV !== 'development') {
    return null
  }

  return <PerformanceDashboard />
} 