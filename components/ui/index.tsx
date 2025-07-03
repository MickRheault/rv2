// Core UI Components
export { default as Button } from './Button'
export { default as Input } from './Input'
export { default as Textarea } from './Textarea'
export { default as Select } from './Select'
export { default as Checkbox } from './Checkbox'
export { default as Switch } from './Switch'
export { default as RadioGroup, RadioOption } from './RadioGroup'

// Layout Components
export { 
  default as Card, 
  CardHeader, 
  CardTitle, 
  CardDescription, 
  CardContent, 
  CardFooter 
} from './Card'

// Feedback Components
export { default as Alert } from './Alert'
export { default as Badge } from './Badge'
export { default as Spinner } from './Spinner'
export { default as Pagination } from './Pagination'

// Overlay Components
export { 
  default as Modal, 
  ModalHeader, 
  ModalBody, 
  ModalFooter 
} from './Modal'

// Loading States and Error Handling
export {
  SkeletonText,
  SkeletonCard,
  SkeletonList,
  SkeletonMotorcycleCard,
  SkeletonShopCard,
  LoadingOverlay,
  PageLoading,
  InlineLoading,
  EmptyState,
  ErrorState,
  InlineError,
  NetworkStatus,
  type ErrorStateProps
} from './LoadingStates'

// Component Types
export type { default as ButtonProps } from './Button' 

// Add PremiumBadge component
export function PremiumBadge({ 
  type = 'gold', 
  className,
  children 
}: { 
  type?: 'gold' | 'platinum' | 'featured'
  className?: string
  children?: React.ReactNode
}) {
  // Import Badge for use in this component
  const BadgeComponent = require('./Badge').default;
  const icons = {
    gold: (
      <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
      </svg>
    ),
    platinum: (
      <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
      </svg>
    ),
    featured: (
      <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
        <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    )
  }

  const labels = {
    gold: 'Premium',
    platinum: 'Premium+',
    featured: 'Featured'
  }

  return (
    <BadgeComponent variant={type} size="sm" className={className}>
      {icons[type]}
      {children || labels[type]}
    </BadgeComponent>
  )
} 