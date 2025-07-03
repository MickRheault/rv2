'use client'

import { ReactNode } from 'react'
import { clsx } from 'clsx'
import { useResponsive, useTouchDevice, useSafeArea } from '@/hooks/useResponsive'

interface ResponsiveLayoutProps {
  children: ReactNode
  className?: string
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '7xl' | 'full'
  padding?: boolean
  safeArea?: boolean
}

// Main responsive container
export function ResponsiveContainer({
  children,
  className,
  maxWidth = '7xl',
  padding = true,
  safeArea = false
}: ResponsiveLayoutProps) {
  const { getContainerPadding, isMounted } = useResponsive()
  const safeAreaInsets = useSafeArea()

  const maxWidthClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '7xl': 'max-w-7xl',
    full: 'max-w-full'
  }

  const paddingStyle = safeArea && isMounted ? {
    paddingTop: `calc(1rem + ${safeAreaInsets.top}px)`,
    paddingBottom: `calc(1rem + ${safeAreaInsets.bottom}px)`,
    paddingLeft: `calc(1rem + ${safeAreaInsets.left}px)`,
    paddingRight: `calc(1rem + ${safeAreaInsets.right}px)`,
  } : {}

  return (
    <div
      className={clsx(
        'w-full mx-auto',
        maxWidthClasses[maxWidth],
        padding && !safeArea && getContainerPadding(),
        className
      )}
      style={safeArea ? paddingStyle : {}}
    >
      {children}
    </div>
  )
}

// Responsive grid component
interface ResponsiveGridProps {
  children: ReactNode
  className?: string
  cols?: {
    mobile?: number
    tablet?: number
    desktop?: number
    largeDesktop?: number
  }
  gap?: 'sm' | 'md' | 'lg' | 'xl'
  minItemWidth?: string
}

export function ResponsiveGrid({
  children,
  className,
  cols = { mobile: 1, tablet: 2, desktop: 3, largeDesktop: 4 },
  gap = 'md',
  minItemWidth
}: ResponsiveGridProps) {
  const { getGridCols, isMobile, isTablet, isDesktop } = useResponsive()

  const gapClasses = {
    sm: 'gap-2',
    md: 'gap-4',
    lg: 'gap-6',
    xl: 'gap-8'
  }

  // If minItemWidth is provided, use auto-fit grid instead of fixed columns
  if (minItemWidth) {
    return (
      <div
        className={clsx(
          'grid',
          gapClasses[gap],
          className
        )}
        style={{
          gridTemplateColumns: `repeat(auto-fill, minmax(${minItemWidth}, 1fr))`
        }}
      >
        {children}
      </div>
    )
  }

  // Use responsive column counts
  const gridCols = getGridCols(
    cols.mobile,
    cols.tablet,
    cols.desktop,
    cols.largeDesktop
  )

  const gridColsClass = {
    1: 'grid-cols-1',
    2: 'grid-cols-2',
    3: 'grid-cols-3',
    4: 'grid-cols-4',
    5: 'grid-cols-5',
    6: 'grid-cols-6'
  }[gridCols] || 'grid-cols-1'

  return (
    <div
      className={clsx(
        'grid',
        gridColsClass,
        gapClasses[gap],
        className
      )}
    >
      {children}
    </div>
  )
}

// Responsive flex component
interface ResponsiveFlexProps {
  children: ReactNode
  className?: string
  direction?: 'row' | 'col' | 'responsive'
  align?: 'start' | 'center' | 'end' | 'stretch'
  justify?: 'start' | 'center' | 'end' | 'between' | 'around' | 'evenly'
  wrap?: boolean
  gap?: 'sm' | 'md' | 'lg' | 'xl'
}

export function ResponsiveFlex({
  children,
  className,
  direction = 'row',
  align = 'start',
  justify = 'start',
  wrap = false,
  gap = 'md'
}: ResponsiveFlexProps) {
  const { isMobile } = useResponsive()

  const gapClasses = {
    sm: 'gap-2',
    md: 'gap-4',
    lg: 'gap-6',
    xl: 'gap-8'
  }

  const alignClasses = {
    start: 'items-start',
    center: 'items-center',
    end: 'items-end',
    stretch: 'items-stretch'
  }

  const justifyClasses = {
    start: 'justify-start',
    center: 'justify-center',
    end: 'justify-end',
    between: 'justify-between',
    around: 'justify-around',
    evenly: 'justify-evenly'
  }

  // Responsive direction: column on mobile, row on desktop
  const directionClass = direction === 'responsive' 
    ? (isMobile ? 'flex-col' : 'flex-row')
    : direction === 'col' 
      ? 'flex-col' 
      : 'flex-row'

  return (
    <div
      className={clsx(
        'flex',
        directionClass,
        alignClasses[align],
        justifyClasses[justify],
        wrap && 'flex-wrap',
        gapClasses[gap],
        className
      )}
    >
      {children}
    </div>
  )
}

// Responsive text component
interface ResponsiveTextProps {
  children: ReactNode
  className?: string
  size?: {
    mobile?: string
    tablet?: string
    desktop?: string
  }
  weight?: 'normal' | 'medium' | 'semibold' | 'bold'
  color?: string
}

export function ResponsiveText({
  children,
  className,
  size = { mobile: 'text-sm', tablet: 'text-base', desktop: 'text-lg' },
  weight = 'normal',
  color = 'text-gray-900'
}: ResponsiveTextProps) {
  const { getResponsiveTextSize } = useResponsive()

  const weightClasses = {
    normal: 'font-normal',
    medium: 'font-medium',
    semibold: 'font-semibold',
    bold: 'font-bold'
  }

  const textSize = getResponsiveTextSize(size.mobile, size.tablet, size.desktop)

  return (
    <span
      className={clsx(
        textSize,
        weightClasses[weight],
        color,
        className
      )}
    >
      {children}
    </span>
  )
}

// Mobile-specific touch target component
interface TouchTargetProps {
  children: ReactNode
  className?: string
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
  onClick?: () => void
}

export function TouchTarget({
  children,
  className,
  size = 'md',
  disabled = false,
  onClick
}: TouchTargetProps) {
  const isTouchDevice = useTouchDevice()

  const sizeClasses = {
    sm: 'min-h-[36px] min-w-[36px]',
    md: 'min-h-[44px] min-w-[44px]',
    lg: 'min-h-[56px] min-w-[56px]'
  }

  // Only apply touch target sizing on touch devices
  const touchClass = isTouchDevice ? sizeClasses[size] : ''

  return (
    <button
      className={clsx(
        'flex items-center justify-center',
        touchClass,
        'transition-colors duration-200',
        disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-100 active:bg-gray-200',
        className
      )}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  )
}

// Responsive spacing component
interface ResponsiveSpacingProps {
  children: ReactNode
  className?: string
  space?: {
    mobile?: string
    tablet?: string
    desktop?: string
  }
}

export function ResponsiveSpacing({
  children,
  className,
  space = { mobile: 'space-y-4', tablet: 'space-y-6', desktop: 'space-y-8' }
}: ResponsiveSpacingProps) {
  const { isMobile, isTablet } = useResponsive()

  const spacingClass = isMobile 
    ? space.mobile 
    : isTablet 
      ? space.tablet 
      : space.desktop

  return (
    <div className={clsx(spacingClass, className)}>
      {children}
    </div>
  )
}

// Export all components
export default ResponsiveContainer 