// Export all SEO utilities for easy importing
export * from './config';
export * from './structured-data';

// Re-export commonly used functions
export { generateMetadata, PAGE_CONFIGS, SITE_CONFIG } from './config';
export { StructuredData } from './structured-data';