'use client'

import { SelectHTMLAttributes, forwardRef, useState } from 'react'
import { clsx } from 'clsx'
import { ChevronDownIcon } from '@heroicons/react/24/outline'

interface SelectOption {
  value: string
  label: string
  disabled?: boolean
}

interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  label?: string
  error?: string
  hint?: string
  options: SelectOption[]
  placeholder?: string
  size?: 'sm' | 'md' | 'lg'
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ 
    label, 
    error, 
    hint, 
    options,
    placeholder,
    size = 'md',
    className, 
    id,
    ...props 
  }, ref) => {
    const [isFocused, setIsFocused] = useState(false)
    const selectId = id || `select-${Math.random().toString(36).substr(2, 9)}`

    const sizeClasses = {
      sm: 'px-3 py-2 text-sm',
      md: 'px-4 py-3 text-sm',
      lg: 'px-4 py-4 text-base'
    }

    return (
      <div className="w-full">
        {label && (
          <label 
            htmlFor={selectId} 
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            {label}
          </label>
        )}
        
        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            className={clsx(
              'w-full rounded-xl border appearance-none bg-white transition-all duration-200',
              'focus:outline-none focus:ring-1 pr-10',
              'disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed',
              error 
                ? 'border-red-300 focus:border-red-500 focus:ring-red-500' 
                : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500',
              sizeClasses[size],
              className
            )}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            {...props}
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {options.map((option) => (
              <option 
                key={option.value} 
                value={option.value}
                disabled={option.disabled}
              >
                {option.label}
              </option>
            ))}
          </select>
          
          {/* Custom dropdown arrow */}
          <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
            <ChevronDownIcon 
              className={clsx(
                'w-5 h-5 transition-transform duration-200',
                isFocused ? 'rotate-180' : '',
                error ? 'text-red-400' : 'text-gray-400'
              )} 
            />
          </div>
        </div>
        
        {error && (
          <p className="mt-2 text-sm text-red-600">
            {error}
          </p>
        )}
        
        {hint && !error && (
          <p className="mt-2 text-sm text-gray-500">
            {hint}
          </p>
        )}
      </div>
    )
  }
)

Select.displayName = 'Select'

export default Select 