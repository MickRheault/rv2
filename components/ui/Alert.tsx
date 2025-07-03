import { HTMLAttributes, ReactNode } from 'react'
import { clsx } from 'clsx'
import { 
  CheckCircleIcon, 
  ExclamationTriangleIcon, 
  InformationCircleIcon, 
  XCircleIcon,
  XMarkIcon
} from '@heroicons/react/24/outline'

interface AlertProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'info' | 'success' | 'warning' | 'error'
  title?: string
  description?: string
  dismissible?: boolean
  onDismiss?: () => void
  icon?: ReactNode
  children?: ReactNode
}

export default function Alert({
  variant = 'info',
  title,
  description,
  dismissible = false,
  onDismiss,
  icon,
  children,
  className,
  ...props
}: AlertProps) {
  const variants = {
    info: {
      container: 'bg-blue-50 border-blue-200',
      icon: 'text-blue-400',
      title: 'text-blue-800',
      description: 'text-blue-700',
      defaultIcon: InformationCircleIcon
    },
    success: {
      container: 'bg-green-50 border-green-200',
      icon: 'text-green-400',
      title: 'text-green-800',
      description: 'text-green-700',
      defaultIcon: CheckCircleIcon
    },
    warning: {
      container: 'bg-yellow-50 border-yellow-200',
      icon: 'text-yellow-400',
      title: 'text-yellow-800',
      description: 'text-yellow-700',
      defaultIcon: ExclamationTriangleIcon
    },
    error: {
      container: 'bg-red-50 border-red-200',
      icon: 'text-red-400',
      title: 'text-red-800',
      description: 'text-red-700',
      defaultIcon: XCircleIcon
    }
  }

  const config = variants[variant]
  const IconComponent = config.defaultIcon

  return (
    <div
      className={clsx(
        'rounded-xl border p-4',
        config.container,
        className
      )}
      role="alert"
      {...props}
    >
      <div className="flex">
        {/* Icon */}
        <div className="flex-shrink-0">
          {icon ? (
            <div className={clsx('h-5 w-5', config.icon)}>
              {icon}
            </div>
          ) : (
            <IconComponent className={clsx('h-5 w-5', config.icon)} />
          )}
        </div>

        {/* Content */}
        <div className="ml-3 flex-1">
          {title && (
            <h3 className={clsx('text-sm font-medium', config.title)}>
              {title}
            </h3>
          )}
          
          {description && (
            <div className={clsx('text-sm mt-1', config.description)}>
              {description}
            </div>
          )}
          
          {children && (
            <div className={clsx('text-sm', title ? 'mt-2' : '', config.description)}>
              {children}
            </div>
          )}
        </div>

        {/* Dismiss button */}
        {dismissible && onDismiss && (
          <div className="ml-auto pl-3">
            <div className="-mx-1.5 -my-1.5">
              <button
                onClick={onDismiss}
                className={clsx(
                  'inline-flex rounded-md p-1.5 focus:outline-none focus:ring-2 focus:ring-offset-2',
                  'hover:bg-black/5 transition-colors',
                  config.icon,
                  variant === 'info' && 'focus:ring-blue-600 focus:ring-offset-blue-50',
                  variant === 'success' && 'focus:ring-green-600 focus:ring-offset-green-50',
                  variant === 'warning' && 'focus:ring-yellow-600 focus:ring-offset-yellow-50',
                  variant === 'error' && 'focus:ring-red-600 focus:ring-offset-red-50'
                )}
                aria-label="Dismiss"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
} 