'use client'

import { useEffect } from 'react'
import { ErrorState } from '@/components/ui/LoadingStates'
import Button from '@/components/ui/Button'

interface ErrorPageProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    // Log the error to the console in development
    console.error('Application error:', error)

    // Track error with analytics
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'exception', {
        description: error.message,
        fatal: true,
        page_title: 'Application Error',
        error_digest: error.digest,
      })
    }

    // Future: Send to error tracking service
    // errorTrackingService.log({
    //   error: error.message,
    //   stack: error.stack,
    //   digest: error.digest,
    //   url: window.location.href,
    //   userAgent: navigator.userAgent,
    //   timestamp: new Date().toISOString(),
    // })
  }, [error])

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-lg w-full">
        <ErrorState
          type="error"
          title="Something went wrong"
          message="We're sorry, but something unexpected happened. Our team has been notified and is working to fix this issue."
          onRetry={reset}
          retryLabel="Try Again"
        />
        
        {/* Additional actions */}
        <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
          <Button
            variant="outline"
            onClick={() => window.location.href = '/'}
            className="flex-1 sm:flex-none"
          >
            Go to Homepage
          </Button>
          <Button
            variant="outline"
            onClick={() => window.location.reload()}
            className="flex-1 sm:flex-none"
          >
            Reload Page
          </Button>
        </div>

        {/* Development info */}
        {process.env.NODE_ENV === 'development' && (
          <div className="mt-8 p-4 bg-red-50 border border-red-200 rounded-lg">
            <h3 className="text-sm font-medium text-red-800 mb-2">Development Info:</h3>
            <div className="space-y-2">
              <div>
                <span className="text-xs font-medium text-red-700">Error:</span>
                <p className="text-xs text-red-600 font-mono">{error.message}</p>
              </div>
              {error.digest && (
                <div>
                  <span className="text-xs font-medium text-red-700">Digest:</span>
                  <p className="text-xs text-red-600 font-mono">{error.digest}</p>
                </div>
              )}
              {error.stack && (
                <div>
                  <span className="text-xs font-medium text-red-700">Stack:</span>
                  <pre className="text-xs text-red-600 font-mono whitespace-pre-wrap mt-1 max-h-40 overflow-y-auto">
                    {error.stack}
                  </pre>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Error reporting */}
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600">
            If this problem persists, please{' '}
            <a 
              href="/contact" 
              className="text-blue-600 hover:text-blue-800 underline"
            >
              contact our support team
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  )
}