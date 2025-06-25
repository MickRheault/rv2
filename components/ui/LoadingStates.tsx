import { clsx } from 'clsx'
import Spinner from './Spinner'

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

// Loading overlays
export function LoadingOverlay({ 
  isLoading, 
  children, 
  className 
}: { 
  isLoading: boolean
  children: React.ReactNode
  className?: string 
}) {
  return (
    <div className={clsx('relative', className)}>
      {children}
      {isLoading && (
        <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center rounded-xl">
          <div className="flex flex-col items-center space-y-2">
            <Spinner size="lg" />
            <p className="text-sm text-gray-600">Loading...</p>
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