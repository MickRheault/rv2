'use client'

import { useState, createContext, useContext } from 'react'
import { clsx } from 'clsx'

interface RadioOption {
  value: string
  label: string
  description?: string
  disabled?: boolean
}

interface RadioGroupContextType {
  value?: string
  onChange: (value: string) => void
  name: string
  error?: string
  size: 'sm' | 'md' | 'lg'
}

const RadioGroupContext = createContext<RadioGroupContextType | null>(null)

interface RadioGroupProps {
  value?: string
  onChange: (value: string) => void
  name: string
  label?: string
  error?: string
  hint?: string
  size?: 'sm' | 'md' | 'lg'
  orientation?: 'vertical' | 'horizontal'
  children: React.ReactNode
  className?: string
}

export default function RadioGroup({
  value,
  onChange,
  name,
  label,
  error,
  hint,
  size = 'md',
  orientation = 'vertical',
  children,
  className
}: RadioGroupProps) {
  return (
    <RadioGroupContext.Provider value={{ value, onChange, name, error, size }}>
      <div className={clsx('w-full', className)}>
        {label && (
          <label className="block text-sm font-medium text-gray-700 mb-3">
            {label}
          </label>
        )}
        
        <div className={clsx(
          'space-y-3',
          orientation === 'horizontal' && 'flex space-x-6 space-y-0'
        )}>
          {children}
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
    </RadioGroupContext.Provider>
  )
}

interface RadioOptionProps {
  value: string
  label: string
  description?: string
  disabled?: boolean
  className?: string
}

export function RadioOption({ 
  value, 
  label, 
  description, 
  disabled = false,
  className 
}: RadioOptionProps) {
  const context = useContext(RadioGroupContext)
  
  if (!context) {
    throw new Error('RadioOption must be used within a RadioGroup')
  }

  const { value: selectedValue, onChange, name, error, size } = context
  const isSelected = selectedValue === value
  const radioId = `${name}-${value}`

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
    <div className={clsx('flex items-start', className)}>
      <div className="flex items-center h-5">
        <input
          id={radioId}
          name={name}
          type="radio"
          value={value}
          checked={isSelected}
          onChange={() => onChange(value)}
          disabled={disabled}
          className={clsx(
            'border-gray-300 text-blue-600 transition-colors',
            'focus:ring-blue-500 focus:ring-2 focus:ring-offset-2',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            error && 'border-red-300 text-red-600 focus:ring-red-500',
            sizeClasses[size]
          )}
        />
      </div>
      
      <div className="ml-3">
        <label 
          htmlFor={radioId} 
          className={clsx(
            'font-medium cursor-pointer',
            disabled ? 'text-gray-400' : 'text-gray-900',
            labelSizeClasses[size]
          )}
        >
          {label}
        </label>
        {description && (
          <p className={clsx(
            'text-sm mt-0.5',
            disabled ? 'text-gray-400' : 'text-gray-600'
          )}>
            {description}
          </p>
        )}
      </div>
    </div>
  )
} 