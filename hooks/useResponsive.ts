'use client'

import { useState, useEffect } from 'react'

// Tailwind breakpoints
const breakpoints = {
  xs: 475,
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
} as const

type Breakpoint = keyof typeof breakpoints

export function useResponsive() {
  const [screenSize, setScreenSize] = useState<{
    width: number
    height: number
  }>(() => {
    // Default to mobile size during SSR
    return { width: 375, height: 667 }
  })

  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
    
    const updateScreenSize = () => {
      setScreenSize({
        width: window.innerWidth,
        height: window.innerHeight,
      })
    }

    // Set initial size
    updateScreenSize()

    // Add event listener
    window.addEventListener('resize', updateScreenSize)
    window.addEventListener('orientationchange', updateScreenSize)

    return () => {
      window.removeEventListener('resize', updateScreenSize)
      window.removeEventListener('orientationchange', updateScreenSize)
    }
  }, [])

  // Don't return actual screen size until mounted to prevent hydration mismatch
  const safeScreenSize = isMounted ? screenSize : { width: 375, height: 667 }

  const isAbove = (breakpoint: Breakpoint): boolean => {
    return safeScreenSize.width >= breakpoints[breakpoint]
  }

  const isBelow = (breakpoint: Breakpoint): boolean => {
    return safeScreenSize.width < breakpoints[breakpoint]
  }

  const isBetween = (min: Breakpoint, max: Breakpoint): boolean => {
    return safeScreenSize.width >= breakpoints[min] && safeScreenSize.width < breakpoints[max]
  }

  // Convenient boolean checks
  const isMobile = isBelow('md')
  const isTablet = isBetween('md', 'lg')
  const isDesktop = isAbove('lg')
  const isLargeDesktop = isAbove('xl')

  // Orientation detection
  const isLandscape = safeScreenSize.width > safeScreenSize.height
  const isPortrait = safeScreenSize.width <= safeScreenSize.height

  // Grid columns helper
  const getGridCols = (
    mobile: number = 1,
    tablet: number = 2,
    desktop: number = 3,
    largeDesktop: number = 4
  ): number => {
    if (isLargeDesktop) return largeDesktop
    if (isDesktop) return desktop
    if (isTablet) return tablet
    return mobile
  }

  // Container padding helper
  const getContainerPadding = (): string => {
    if (isLargeDesktop) return 'px-8'
    if (isDesktop) return 'px-6'
    return 'px-4'
  }

  // Font size helper
  const getResponsiveTextSize = (
    mobile: string = 'text-sm',
    tablet: string = 'text-base',
    desktop: string = 'text-lg'
  ): string => {
    if (isDesktop) return desktop
    if (isTablet) return tablet
    return mobile
  }

  return {
    screenSize: safeScreenSize,
    isMounted,
    isAbove,
    isBelow,
    isBetween,
    isMobile,
    isTablet,
    isDesktop,
    isLargeDesktop,
    isLandscape,
    isPortrait,
    getGridCols,
    getContainerPadding,
    getResponsiveTextSize,
    breakpoints,
  }
}

// Hook for detecting touch device
export function useTouchDevice() {
  const [isTouchDevice, setIsTouchDevice] = useState(false)

  useEffect(() => {
    const checkTouchDevice = () => {
      setIsTouchDevice(
        'ontouchstart' in window ||
        navigator.maxTouchPoints > 0 ||
        // @ts-ignore
        navigator.msMaxTouchPoints > 0
      )
    }

    checkTouchDevice()
  }, [])

  return isTouchDevice
}

// Hook for safe area insets (iOS notch support)
export function useSafeArea() {
  const [safeArea, setSafeArea] = useState({
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  })

  useEffect(() => {
    const updateSafeArea = () => {
      const computedStyle = getComputedStyle(document.documentElement)
      
      setSafeArea({
        top: parseInt(computedStyle.getPropertyValue('env(safe-area-inset-top)').replace('px', '')) || 0,
        right: parseInt(computedStyle.getPropertyValue('env(safe-area-inset-right)').replace('px', '')) || 0,
        bottom: parseInt(computedStyle.getPropertyValue('env(safe-area-inset-bottom)').replace('px', '')) || 0,
        left: parseInt(computedStyle.getPropertyValue('env(safe-area-inset-left)').replace('px', '')) || 0,
      })
    }

    updateSafeArea()
    window.addEventListener('resize', updateSafeArea)
    window.addEventListener('orientationchange', updateSafeArea)

    return () => {
      window.removeEventListener('resize', updateSafeArea)
      window.removeEventListener('orientationchange', updateSafeArea)
    }
  }, [])

  return safeArea
} 