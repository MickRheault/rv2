'use client'

import React, { Component, ErrorInfo, ReactNode } from 'react'
import { ErrorState } from '@/components/ui/LoadingStates'
import Button from '@/components/ui/Button'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
  level?: 'page' | 'section' | 'component'
  name?: string
}

interface State {
  hasError: boolean
  error?: Error
  errorId?: string
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  }

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return { 
      hasError: true, 
      error,
      errorId: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const { onError, name, level = 'component' } = this.props
    const { errorId } = this.state

    // Log error details
    console.error(`[ErrorBoundary:${name || level}] Error caught:`, {
      error,
      errorInfo,
      errorId,
      componentStack: errorInfo.componentStack,
      level,
      timestamp: new Date().toISOString(),
    })

    // Call custom error handler if provided
    if (onError) {
      onError(error, errorInfo)
    }

    // Track error for analytics
    this.trackError(error, errorInfo, errorId || 'unknown', level, name)
  }

  private trackError = (
    error: Error, 
    errorInfo: ErrorInfo, 
    errorId: string, 
    level: string,
    name?: string
  ) => {
    try {
      // Track with Google Analytics if available
      if (typeof window !== 'undefined' && (window as any).gtag) {
        (window as any).gtag('event', 'exception', {
          description: error.message,
          fatal: level === 'page',
          error_boundary: name || level,
          error_id: errorId,
        })
      }

      // Send to error tracking service (future implementation)
      // await errorTrackingService.log({
      //   error: error.message,
      //   stack: error.stack,
      //   componentStack: errorInfo.componentStack,
      //   errorId,
      //   level,
      //   name,
      //   userAgent: navigator.userAgent,
      //   url: window.location.href,
      //   timestamp: new Date().toISOString(),
      // })
    } catch (trackingError) {
      console.error('Error tracking failed:', trackingError)
    }
  }

  public handleRetry = () => {
    this.setState({ hasError: false, error: undefined, errorId: undefined })
  }

  public render() {
    const { hasError, error, errorId } = this.state
    const { fallback, children, level = 'component', name } = this.props

    if (hasError && error) {
      // Use custom fallback if provided
      if (fallback) {
        return fallback
      }

      // Default fallback UI based on level
      return this.renderDefaultFallback(error, errorId, level, name)
    }

    return children
  }

  private renderDefaultFallback = (error: Error, errorId?: string, level?: string, name?: string) => {
    const isPageLevel = level === 'page'
    const isSection = level === 'section'

    if (isPageLevel) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
          <div className="max-w-md w-full">
            <ErrorState
              type="error"
              title="Page Error"
              message="This page encountered an unexpected error. Our team has been notified."
              onRetry={this.handleRetry}
              retryLabel="Reload Page"
            />
            {process.env.NODE_ENV === 'development' && (
              <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                <h4 className="text-sm font-medium text-red-800 mb-2">Development Info:</h4>
                <p className="text-xs text-red-600 font-mono">{error.message}</p>
                {errorId && (
                  <p className="text-xs text-red-500 mt-1">Error ID: {errorId}</p>
                )}
              </div>
            )}
          </div>
        </div>
      )
    }

    if (isSection) {
      return (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 my-4">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3 flex-1">
              <h3 className="text-sm font-medium text-red-800">
                {name ? `${name} Error` : 'Section Error'}
              </h3>
              <p className="text-sm text-red-700 mt-1">
                This section could not be loaded. Please try refreshing the page.
              </p>
            </div>
            <div className="ml-3">
              <Button
                variant="outline"
                size="sm"
                onClick={this.handleRetry}
                className="text-red-700 border-red-300 hover:bg-red-100"
              >
                Retry
              </Button>
            </div>
          </div>
          {process.env.NODE_ENV === 'development' && (
            <div className="mt-3 pt-3 border-t border-red-200">
              <p className="text-xs text-red-600 font-mono">{error.message}</p>
              {errorId && (
                <p className="text-xs text-red-500 mt-1">Error ID: {errorId}</p>
              )}
            </div>
          )}
        </div>
      )
    }

    // Component level - minimal inline error
    return (
      <div className="bg-red-50 border border-red-200 rounded p-3 text-center">
        <p className="text-sm text-red-700">
          {name || 'Component'} failed to load
        </p>
        <Button
          variant="ghost"
          size="sm"
          onClick={this.handleRetry}
          className="text-red-600 text-xs mt-1"
        >
          Retry
        </Button>
      </div>
    )
  }
}

// HOC for easier wrapping
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryConfig?: Omit<Props, 'children'>
) {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryConfig}>
      <Component {...props} />
    </ErrorBoundary>
  )

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`
  
  return WrappedComponent
}

// Hook for manual error handling in functional components
export function useErrorHandler() {
  return (error: Error, errorInfo?: { componentStack?: string }) => {
    // Re-throw error to be caught by nearest ErrorBoundary
    throw error
  }
}