import { TextareaHTMLAttributes, forwardRef } from 'react'
import { clsx } from 'clsx'

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
  hint?: string
  resize?: boolean
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ 
    label, 
    error, 
    hint, 
    resize = true,
    className, 
    id,
    ...props 
  }, ref) => {
    const textareaId = id || `textarea-${Math.random().toString(36).substr(2, 9)}`

    return (
      <div className="w-full">
        {label && (
          <label 
            htmlFor={textareaId} 
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            {label}
          </label>
        )}
        
        <textarea
          ref={ref}
          id={textareaId}
          className={clsx(
            'w-full px-4 py-3 rounded-xl border transition-all duration-200',
            'placeholder-gray-400 focus:outline-none focus:ring-1',
            'disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed',
            !resize && 'resize-none',
            error 
              ? 'border-red-300 focus:border-red-500 focus:ring-red-500' 
              : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500',
            className
          )}
          {...props}
        />
        
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

Textarea.displayName = 'Textarea'

export default Textarea 