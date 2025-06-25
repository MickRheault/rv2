import { InputHTMLAttributes, forwardRef } from 'react'
import { clsx } from 'clsx'
import { CheckIcon } from '@heroicons/react/24/outline'

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string
  description?: string
  error?: string
  size?: 'sm' | 'md' | 'lg'
  indeterminate?: boolean
}

const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ 
    label, 
    description,
    error,
    size = 'md',
    indeterminate = false,
    className, 
    id,
    ...props 
  }, ref) => {
    const checkboxId = id || `checkbox-${Math.random().toString(36).substr(2, 9)}`

    const sizeClasses = {
      sm: 'h-4 w-4',
      md: 'h-5 w-5',
      lg: 'h-6 w-6'
    }

    const labelSizeClasses = {
      sm: 'text-sm',
      md: 'text-sm',
      lg: 'text-base'
    }

    return (
      <div className="flex items-start">
        <div className="flex items-center h-5">
          <div className="relative">
            <input
              ref={ref}
              id={checkboxId}
              type="checkbox"
              className={clsx(
                'rounded border-gray-300 text-blue-600 transition-colors',
                'focus:ring-blue-500 focus:ring-2 focus:ring-offset-2',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                error && 'border-red-300 text-red-600 focus:ring-red-500',
                sizeClasses[size],
                className
              )}
              {...props}
            />
            
            {/* Custom checkmark for better styling */}
            {(props.checked || indeterminate) && (
              <div className={clsx(
                'absolute inset-0 flex items-center justify-center pointer-events-none',
                sizeClasses[size]
              )}>
                {indeterminate ? (
                  <div className="w-2.5 h-0.5 bg-white rounded-full" />
                ) : (
                  <CheckIcon className="w-3 h-3 text-white" strokeWidth={3} />
                )}
              </div>
            )}
          </div>
        </div>
        
        {(label || description) && (
          <div className="ml-3">
            {label && (
              <label 
                htmlFor={checkboxId} 
                className={clsx(
                  'font-medium text-gray-900 cursor-pointer',
                  labelSizeClasses[size]
                )}
              >
                {label}
              </label>
            )}
            {description && (
              <p className="text-sm text-gray-600 mt-0.5">
                {description}
              </p>
            )}
            {error && (
              <p className="text-sm text-red-600 mt-1">
                {error}
              </p>
            )}
          </div>
        )}
      </div>
    )
  }
)

Checkbox.displayName = 'Checkbox'

export default Checkbox 