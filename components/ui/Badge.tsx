import { HTMLAttributes, forwardRef } from 'react'
import { clsx } from 'clsx'

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'info'
  size?: 'sm' | 'md' | 'lg'
  removable?: boolean
  onRemove?: () => void
  children: React.ReactNode
}

const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ 
    variant = 'default', 
    size = 'md',
    removable = false,
    onRemove,
    className, 
    children, 
    ...props 
  }, ref) => {
    const baseClasses = 'inline-flex items-center font-medium rounded-full transition-colors'
    
    const variants = {
      default: 'bg-gray-100 text-gray-800 hover:bg-gray-200',
      primary: 'bg-blue-100 text-blue-800 hover:bg-blue-200',
      secondary: 'bg-purple-100 text-purple-800 hover:bg-purple-200',
      success: 'bg-green-100 text-green-800 hover:bg-green-200',
      warning: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200',
      danger: 'bg-red-100 text-red-800 hover:bg-red-200',
      info: 'bg-cyan-100 text-cyan-800 hover:bg-cyan-200'
    }
    
    const sizes = {
      sm: 'px-2 py-0.5 text-xs',
      md: 'px-2.5 py-0.5 text-sm',
      lg: 'px-3 py-1 text-sm'
    }

    return (
      <span
        ref={ref}
        className={clsx(
          baseClasses,
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      >
        {children}
        {removable && onRemove && (
          <button
            onClick={onRemove}
            className="ml-1 -mr-0.5 flex-shrink-0 h-4 w-4 rounded-full hover:bg-black/10 flex items-center justify-center"
            aria-label="Remove"
          >
            <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        )}
      </span>
    )
  }
)

Badge.displayName = 'Badge'

export default Badge 