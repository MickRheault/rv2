interface ErrorLogEntry {
  id: string
  message: string
  stack?: string
  componentStack?: string
  errorBoundary?: string
  level: 'error' | 'warning' | 'info'
  context?: Record<string, any>
  userAgent?: string
  url?: string
  userId?: string
  sessionId?: string
  timestamp: string
}

interface ErrorTrackingConfig {
  enabled: boolean
  maxEntries: number
  apiEndpoint?: string
  apiKey?: string
}

class ErrorTrackingService {
  private config: ErrorTrackingConfig
  private localQueue: ErrorLogEntry[] = []
  private sessionId: string

  constructor(config: Partial<ErrorTrackingConfig> = {}) {
    this.config = {
      enabled: process.env.NODE_ENV === 'production',
      maxEntries: 100,
      ...config,
    }
    
    this.sessionId = this.generateSessionId()
    
    // Initialize browser-specific features
    if (typeof window !== 'undefined') {
      this.setupGlobalErrorHandlers()
    }
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private setupGlobalErrorHandlers() {
    // Catch unhandled JavaScript errors
    window.addEventListener('error', (event) => {
      this.logError({
        message: event.message,
        stack: event.error?.stack,
        level: 'error',
        context: {
          type: 'javascript_error',
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
        },
      })
    })

    // Catch unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.logError({
        message: `Unhandled Promise Rejection: ${event.reason}`,
        stack: event.reason?.stack,
        level: 'error',
        context: {
          type: 'promise_rejection',
          reason: event.reason,
        },
      })
    })

    // Catch resource loading errors
    window.addEventListener('error', (event) => {
      if (event.target !== window) {
        this.logError({
          message: `Resource failed to load: ${(event.target as any)?.src || (event.target as any)?.href}`,
          level: 'warning',
          context: {
            type: 'resource_error',
            element: (event.target as any)?.tagName,
            src: (event.target as any)?.src,
            href: (event.target as any)?.href,
          },
        })
      }
    }, true)
  }

  public logError(error: {
    message: string
    stack?: string
    componentStack?: string
    errorBoundary?: string
    level?: 'error' | 'warning' | 'info'
    context?: Record<string, any>
    userId?: string
  }): void {
    if (!this.config.enabled) {
      console.log('[ErrorTracking] Disabled, skipping:', error.message)
      return
    }

    const entry: ErrorLogEntry = {
      id: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      message: error.message,
      stack: error.stack,
      componentStack: error.componentStack,
      errorBoundary: error.errorBoundary,
      level: error.level || 'error',
      context: error.context,
      userAgent: typeof window !== 'undefined' ? navigator.userAgent : undefined,
      url: typeof window !== 'undefined' ? window.location.href : undefined,
      userId: error.userId,
      sessionId: this.sessionId,
      timestamp: new Date().toISOString(),
    }

    // Add to local queue
    this.localQueue.push(entry)
    
    // Maintain queue size
    if (this.localQueue.length > this.config.maxEntries) {
      this.localQueue.shift()
    }

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('[ErrorTracking]', entry)
    }

    // Send to external service (async, non-blocking)
    this.sendToExternalService(entry).catch(console.error)

    // Track with Google Analytics if available
    this.trackWithAnalytics(entry)

    // Store in localStorage for debugging
    this.storeLocally(entry)
  }

  private async sendToExternalService(entry: ErrorLogEntry): Promise<void> {
    if (!this.config.apiEndpoint || !this.config.apiKey) {
      return
    }

    try {
      const response = await fetch(this.config.apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify(entry),
      })

      if (!response.ok) {
        throw new Error(`Failed to send error: ${response.status}`)
      }
    } catch (error) {
      console.error('Failed to send error to tracking service:', error)
    }
  }

  private trackWithAnalytics(entry: ErrorLogEntry): void {
    try {
      if (typeof window !== 'undefined' && (window as any).gtag) {
        (window as any).gtag('event', 'exception', {
          description: entry.message,
          fatal: entry.level === 'error',
          error_id: entry.id,
          error_boundary: entry.errorBoundary,
          session_id: entry.sessionId,
        })
      }
    } catch (error) {
      console.error('Failed to track error with analytics:', error)
    }
  }

  private storeLocally(entry: ErrorLogEntry): void {
    try {
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('rv_error_logs')
        const logs = stored ? JSON.parse(stored) : []
        
        logs.push(entry)
        
        // Keep only last 50 entries
        if (logs.length > 50) {
          logs.splice(0, logs.length - 50)
        }
        
        localStorage.setItem('rv_error_logs', JSON.stringify(logs))
      }
    } catch (error) {
      // localStorage might be full or unavailable
      console.warn('Failed to store error locally:', error)
    }
  }

  public getLocalErrors(): ErrorLogEntry[] {
    try {
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('rv_error_logs')
        return stored ? JSON.parse(stored) : []
      }
    } catch (error) {
      console.warn('Failed to retrieve local errors:', error)
    }
    return []
  }

  public clearLocalErrors(): void {
    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('rv_error_logs')
      }
    } catch (error) {
      console.warn('Failed to clear local errors:', error)
    }
  }

  public getQueuedErrors(): ErrorLogEntry[] {
    return [...this.localQueue]
  }

  public configure(newConfig: Partial<ErrorTrackingConfig>): void {
    this.config = { ...this.config, ...newConfig }
  }
}

// Create singleton instance
export const errorTrackingService = new ErrorTrackingService({
  enabled: process.env.NODE_ENV === 'production',
  // Future: Add API endpoint and key from environment variables
  // apiEndpoint: process.env.NEXT_PUBLIC_ERROR_TRACKING_ENDPOINT,
  // apiKey: process.env.NEXT_PUBLIC_ERROR_TRACKING_KEY,
})

// Convenience functions
export const logError = (error: Parameters<typeof errorTrackingService.logError>[0]) => {
  errorTrackingService.logError(error)
}

export const logWarning = (message: string, context?: Record<string, any>) => {
  errorTrackingService.logError({
    message,
    level: 'warning',
    context,
  })
}

export const logInfo = (message: string, context?: Record<string, any>) => {
  errorTrackingService.logError({
    message,
    level: 'info',
    context,
  })
}