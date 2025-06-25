'use client'

import { useState } from 'react'
import { clsx } from 'clsx'

interface SwitchProps {
  checked?: boolean
  onChange?: (checked: boolean) => void
  label?: string
  description?: string
  disabled?: boolean
  size?: 'sm' | 'md' | 'lg'
  className?: string
  id?: string
}

export default function Switch({
  checked = false,
  onChange,
  label,
  description,
  disabled = false,
  size = 'md',
  className,
  id
}: SwitchProps) {
  const [internalChecked, setInternalChecked] = useState(checked)
  const switchId = id || `switch-${Math.random().toString(36).substr(2, 9)}`
  
  const isControlled = onChange !== undefined
  const isChecked = isControlled ? checked : internalChecked

  const handleToggle = () => {
    if (disabled) return
    
    if (isControlled) {
      onChange?.(checked)
    } else {
      setInternalChecked(!internalChecked)
    }
  }

  const sizeClasses = {
    sm: {
      track: 'h-5 w-9',
      thumb: 'h-4 w-4',
      translate: 'translate-x-4'
    },
    md: {
      track: 'h-6 w-11',
      thumb: 'h-5 w-5',
      translate: 'translate-x-5'
    },
    lg: {
      track: 'h-7 w-12',
      thumb: 'h-6 w-6',
      translate: 'translate-x-5'
    }
  }

  const labelSizeClasses = {
    sm: 'text-sm',
    md: 'text-sm',
    lg: 'text-base'
  }

  return (
    <div className={clsx('flex items-start', className)}>
      <button
        id={switchId}
        type="button"
        role="switch"
        aria-checked={isChecked}
        onClick={handleToggle}
        disabled={disabled}
        className={clsx(
          'relative inline-flex flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent',
          'transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          isChecked ? 'bg-blue-600' : 'bg-gray-200',
          sizeClasses[size].track
        )}
      >
        <span
          className={clsx(
            'pointer-events-none inline-block rounded-full bg-white shadow transform ring-0 transition duration-200 ease-in-out',
            isChecked ? sizeClasses[size].translate : 'translate-x-0',
            sizeClasses[size].thumb
          )}
        />
      </button>
      
      {(label || description) && (
        <div className="ml-3">
          {label && (
            <label 
              htmlFor={switchId} 
              className={clsx(
                'font-medium cursor-pointer',
                disabled ? 'text-gray-400' : 'text-gray-900',
                labelSizeClasses[size]
              )}
            >
              {label}
            </label>
          )}
          {description && (
            <p className={clsx(
              'text-sm mt-0.5',
              disabled ? 'text-gray-400' : 'text-gray-600'
            )}>
              {description}
            </p>
          )}
        </div>
      )}
    </div>
  )
} 