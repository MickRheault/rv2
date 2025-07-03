import { clsx } from 'clsx'
import { ExclamationTriangleIcon, XCircleIcon, WifiIcon, ArrowPathIcon } from '@heroicons/react/24/outline'
import Spinner from './Spinner'
import Button from './Button'

interface LoadingStateProps {
  className?: string
}

// Skeleton loading components
export function SkeletonText({ className }: LoadingStateProps) {
  return (
    <div className={clsx('animate-pulse bg-gray-200 rounded', className)} />
  )
}

export function SkeletonCard({ className }: LoadingStateProps) {
  return (
    <div className={clsx('animate-pulse bg-white rounded-2xl border border-gray-200 p-6', className)}>
      <div className="space-y-4">
        <div className="h-48 bg-gray-200 rounded-xl" />
        <div className="space-y-2">
          <div className="h-4 bg-gray-200 rounded w-3/4" />
          <div className="h-4 bg-gray-200 rounded w-1/2" />
        </div>
        <div className="flex space-x-2">
          <div className="h-8 bg-gray-200 rounded w-20" />
          <div className="h-8 bg-gray-200 rounded w-20" />
        </div>
      </div>
    </div>
  )
}

export function SkeletonList({ count = 3, className }: LoadingStateProps & { count?: number }) {
  return (
    <div className={clsx('space-y-4', className)}>
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="animate-pulse bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex space-x-4">
            <div className="w-16 h-16 bg-gray-200 rounded-lg flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gray-200 rounded w-3/4" />
              <div className="h-4 bg-gray-200 rounded w-1/2" />
              <div className="h-3 bg-gray-200 rounded w-1/4" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// Enhanced skeleton components for specific use cases
export function SkeletonMotorcycleCard({ className }: LoadingStateProps) {
  return (
    <div className={clsx('animate-pulse bg-white rounded-2xl border border-gray-200 overflow-hidden', className)}>
      <div className="h-48 bg-gray-200" />
      <div className="p-4 space-y-3">
        <div className="flex justify-between items-start">
          <div className="space-y-2 flex-1">
            <div className="h-5 bg-gray-200 rounded w-3/4" />
            <div className="h-4 bg-gray-200 rounded w-1/2" />
          </div>
          <div className="h-6 bg-gray-200 rounded w-16" />
        </div>
        <div className="flex space-x-2">
          <div className="h-6 bg-gray-200 rounded w-12" />
          <div className="h-6 bg-gray-200 rounded w-16" />
          <div className="h-6 bg-gray-200 rounded w-14" />
        </div>
        <div className="h-10 bg-gray-200 rounded" />
      </div>
    </div>
  )
}

export function SkeletonShopCard({ className }: LoadingStateProps) {
  return (
    <div className={clsx('animate-pulse bg-white rounded-2xl border border-gray-200 p-4', className)}>
      <div className="space-y-3">
        <div className="flex justify-between items-start">
          <div className="space-y-2 flex-1">
            <div className="h-5 bg-gray-200 rounded w-2/3" />
            <div className="h-4 bg-gray-200 rounded w-1/2" />
          </div>
          <div className="flex space-x-1">
            <div className="h-8 w-8 bg-gray-200 rounded-full" />
            <div className="h-8 w-8 bg-gray-200 rounded-full" />
          </div>
        </div>
        <div className="flex space-x-2">
          <div className="h-6 bg-gray-200 rounded w-16" />
          <div className="h-6 bg-gray-200 rounded w-12" />
        </div>
        <div className="flex items-center space-x-2">
          <div className="flex space-x-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-4 w-4 bg-gray-200 rounded" />
            ))}
          </div>
          <div className="h-4 bg-gray-200 rounded w-8" />
          <div className="h-4 bg-gray-200 rounded w-16" />
        </div>
        <div className="h-4 bg-gray-200 rounded w-full" />
        <div className="h-4 bg-gray-200 rounded w-3/4" />
      </div>
    </div>
  )
}

// Loading overlays
export function LoadingOverlay({ 
  isLoading, 
  children, 
  className,
  message = 'Loading...'
}: { 
  isLoading: boolean
  children: React.ReactNode
  className?: string 
  message?: string
}) {
  return (
    <div className={clsx('relative', className)}>
      {children}
      {isLoading && (
        <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center rounded-xl z-50">
          <div className="flex flex-col items-center space-y-2">
            <Spinner size="lg" />
            <p className="text-sm text-gray-600">{message}</p>
          </div>
        </div>
      )}
    </div>
  )
}

// Page loading state
export function PageLoading({ message = 'Loading page...' }: { message?: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <Spinner size="xl" className="mb-4" />
        <h2 className="text-lg font-medium text-gray-900 mb-2">Loading</h2>
        <p className="text-gray-600">{message}</p>
      </div>
    </div>
  )
}

// Inline loading state
export function InlineLoading({ 
  message = 'Loading...', 
  size = 'sm',
  className 
}: { 
  message?: string
  size?: 'sm' | 'md' | 'lg'
  className?: string 
}) {
  return (
    <div className={clsx('flex items-center space-x-2', className)}>
      <Spinner size={size} />
      <span className={clsx(
        'text-gray-600',
        size === 'sm' && 'text-sm',
        size === 'md' && 'text-base',
        size === 'lg' && 'text-lg'
      )}>
        {message}
      </span>
    </div>
  )
}

// Empty states
export function EmptyState({ 
  icon, 
  title, 
  description, 
  action,
  className 
}: {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div className={clsx('text-center py-12', className)}>
      {icon && (
        <div className="mx-auto h-12 w-12 text-gray-400 mb-4">
          {icon}
        </div>
      )}
      <h3 className="text-lg font-medium text-gray-900 mb-2">{title}</h3>
      {description && (
        <p className="text-gray-600 mb-6 max-w-sm mx-auto">{description}</p>
      )}
      {action && <div>{action}</div>}
    </div>
  )
}

// Error States
export interface ErrorStateProps {
  title?: string
  message?: string
  onRetry?: () => void
  retryLabel?: string
  className?: string
  type?: 'error' | 'warning' | 'network' | 'notFound'
}

export function ErrorState({
  title,
  message,
  onRetry,
  retryLabel = 'Try Again',
  className,
  type = 'error'
}: ErrorStateProps) {
  const configs = {
    error: {
      icon: <XCircleIcon className="w-12 h-12 text-red-500" />,
      defaultTitle: 'Something went wrong',
      defaultMessage: 'An unexpected error occurred. Please try again.',
      bgColor: 'bg-red-50',
      textColor: 'text-red-800'
    },
    warning: {
      icon: <ExclamationTriangleIcon className="w-12 h-12 text-yellow-500" />,
      defaultTitle: 'Warning',
      defaultMessage: 'Please check your input and try again.',
      bgColor: 'bg-yellow-50',
      textColor: 'text-yellow-800'
    },
    network: {
      icon: <WifiIcon className="w-12 h-12 text-gray-500" />,
      defaultTitle: 'Connection Problem',
      defaultMessage: 'Please check your internet connection and try again.',
      bgColor: 'bg-gray-50',
      textColor: 'text-gray-800'
    },
    notFound: {
      icon: (
        <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-6-4h6m2 5.291A7.962 7.962 0 0112 15c-2.34 0-4.44-.968-5.982-2.529M15 19.128A7.962 7.962 0 0112 21a7.962 7.962 0 01-3-19.128" />
        </svg>
      ),
      defaultTitle: 'Not Found',
      defaultMessage: 'The content you\'re looking for doesn\'t exist.',
      bgColor: 'bg-gray-50',
      textColor: 'text-gray-800'
    }
  }

  const config = configs[type]

  return (
    <div className={clsx('text-center py-12', className)}>
      <div className={clsx('rounded-2xl p-8 max-w-md mx-auto', config.bgColor)}>
        <div className="mx-auto w-12 h-12 mb-4 flex items-center justify-center">
          {config.icon}
        </div>
        <h3 className={clsx('text-lg font-medium mb-2', config.textColor)}>
          {title || config.defaultTitle}
        </h3>
        <p className={clsx('text-sm mb-6', config.textColor)}>
          {message || config.defaultMessage}
        </p>
        {onRetry && (
          <Button
            onClick={onRetry}
            variant="primary"
            className="inline-flex items-center space-x-2"
          >
            <ArrowPathIcon className="w-4 h-4" />
            <span>{retryLabel}</span>
          </Button>
        )}
      </div>
    </div>
  )
}

// Compact error states for inline use
export function InlineError({
  message,
  onRetry,
  className
}: {
  message: string
  onRetry?: () => void
  className?: string
}) {
  return (
    <div className={clsx('flex items-center justify-between p-3 bg-red-50 border border-red-200 rounded-lg', className)}>
      <div className="flex items-center space-x-2">
        <XCircleIcon className="w-5 h-5 text-red-500 flex-shrink-0" />
        <span className="text-sm text-red-800">{message}</span>
      </div>
      {onRetry && (
        <Button
          size="sm"
          variant="outline"
          onClick={onRetry}
          className="border-red-300 text-red-700 hover:bg-red-100 ml-3"
        >
          Retry
        </Button>
      )}
    </div>
  )
}

// Network status indicator
export function NetworkStatus({ 
  isOnline = true,
  className
}: {
  isOnline?: boolean
  className?: string
}) {
  if (isOnline) return null

  return (
    <div className={clsx('fixed top-0 left-0 right-0 bg-red-600 text-white text-center py-2 text-sm z-50', className)}>
      <div className="flex items-center justify-center space-x-2">
        <WifiIcon className="w-4 h-4" />
        <span>You're offline. Check your connection.</span>
      </div>
    </div>
  )
} 