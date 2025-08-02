// Export all analytics utilities for easy importing
export * from './gtag';
export * from './consent';

// Re-export the main tracking events for convenience
export { trackEvents } from './gtag';
export { 
  acceptAllCookies, 
  declineAllCookies, 
  isAnalyticsAllowed,
  hasUserConsented 
} from './consent';