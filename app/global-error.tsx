'use client'

import { useEffect } from 'react'
import Link from 'next/link'

interface GlobalErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    // Log the critical error
    console.error('Global application error:', error)

    // Track critical error with analytics
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'exception', {
        description: error.message,
        fatal: true,
        page_title: 'Global Error',
        error_digest: error.digest,
      })
    }
  }, [error])

  return (
    <html>
      <body>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
          <div className="max-w-md w-full text-center">
            {/* Error Icon */}
            <div className="mx-auto w-16 h-16 mb-6 flex items-center justify-center">
              <svg 
                className="w-16 h-16 text-red-500" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={1.5} 
                  d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" 
                />
              </svg>
            </div>

            {/* Error Message */}
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                Critical Error
              </h1>
              <p className="text-gray-600">
                The application encountered a critical error and cannot continue. 
                Please refresh the page or try again later.
              </p>
            </div>

            {/* Actions */}
            <div className="space-y-3">
              <button
                onClick={reset}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-colors"
              >
                Try Again
              </button>
              
              <button
                onClick={() => window.location.href = '/'}
                className="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-3 px-4 rounded-lg transition-colors"
              >
                Go to Homepage
              </button>
              
              <button
                onClick={() => window.location.reload()}
                className="w-full border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium py-3 px-4 rounded-lg transition-colors"
              >
                Reload Page
              </button>
            </div>

            {/* Support Link */}
            <div className="mt-8">
              <p className="text-sm text-gray-500">
                Need help?{' '}
                <Link 
                  href="/contact" 
                  className="text-blue-600 hover:text-blue-800 underline"
                >
                  Contact Support
                </Link>
              </p>
            </div>

            {/* Development Info */}
            {process.env.NODE_ENV === 'development' && (
              <div className="mt-8 p-4 bg-red-50 border border-red-200 rounded-lg text-left">
                <h3 className="text-sm font-medium text-red-800 mb-2">Development Info:</h3>
                <div className="space-y-2">
                  <div>
                    <span className="text-xs font-medium text-red-700">Error:</span>
                    <p className="text-xs text-red-600 font-mono break-words">{error.message}</p>
                  </div>
                  {error.digest && (
                    <div>
                      <span className="text-xs font-medium text-red-700">Digest:</span>
                      <p className="text-xs text-red-600 font-mono break-words">{error.digest}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </body>
    </html>
  )
}