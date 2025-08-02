// Google Analytics 4 configuration and utilities
export const GA_TRACKING_ID = process.env.NEXT_PUBLIC_GA4_TRACKING_ID;

// Check if GA4 is enabled (has tracking ID and not placeholder)
export const isGAEnabled = GA_TRACKING_ID && GA_TRACKING_ID !== 'G-PLACEHOLDER123';

// Initialize Google Analytics
export const gtag = (...args: any[]) => {
  if (typeof window !== 'undefined' && (window as any).gtag) {
    (window as any).gtag(...args);
  }
};

// Page view tracking
export const pageview = (url: string) => {
  if (!isGAEnabled) return;
  
  gtag('config', GA_TRACKING_ID, {
    page_location: url,
  });
};

// Custom event tracking
export const event = ({
  action,
  category,
  label,
  value,
  custom_parameters = {},
}: {
  action: string;
  category: string;
  label?: string;
  value?: number;
  custom_parameters?: Record<string, any>;
}) => {
  if (!isGAEnabled) return;

  gtag('event', action, {
    event_category: category,
    event_label: label,
    value: value,
    ...custom_parameters,
  });
};

// Predefined events for the motorcycle rental platform
export const trackEvents = {
  // Search events
  search: (query: string, filters?: Record<string, any>) => {
    event({
      action: 'search',
      category: 'engagement',
      label: query,
      custom_parameters: {
        search_term: query,
        filters_applied: filters ? Object.keys(filters).length : 0,
        ...filters,
      },
    });
  },

  // Motorcycle detail view
  viewMotorcycle: (motorcycleId: string, brand?: string, model?: string) => {
    event({
      action: 'view_item',
      category: 'engagement',
      custom_parameters: {
        item_id: motorcycleId,
        item_name: `${brand} ${model}`.trim(),
        item_category: 'motorcycle',
        content_type: 'motorcycle_detail',
      },
    });
  },

  // Shop detail view
  viewShop: (shopId: string, shopName?: string, location?: string) => {
    event({
      action: 'view_item',
      category: 'engagement',
      custom_parameters: {
        item_id: shopId,
        item_name: shopName,
        item_category: 'rental_shop',
        content_type: 'shop_detail',
        location: location,
      },
    });
  },

  // Contact shop (conversion event)
  contactShop: (shopId: string, method: 'phone' | 'email' | 'website') => {
    event({
      action: 'contact_shop',
      category: 'conversion',
      label: method,
      custom_parameters: {
        shop_id: shopId,
        contact_method: method,
        event_category: 'lead_generation',
      },
    });
  },

  // Filter usage
  useFilter: (filterType: string, filterValue: string) => {
    event({
      action: 'filter_applied',
      category: 'engagement',
      label: `${filterType}:${filterValue}`,
      custom_parameters: {
        filter_type: filterType,
        filter_value: filterValue,
      },
    });
  },

  // Location search
  searchLocation: (location: string) => {
    event({
      action: 'location_search',
      category: 'engagement',
      label: location,
      custom_parameters: {
        search_location: location,
      },
    });
  },

  // Add to favorites
  addFavorite: (itemType: 'motorcycle' | 'shop', itemId: string) => {
    event({
      action: 'add_to_favorites',
      category: 'engagement',
      custom_parameters: {
        content_type: itemType,
        item_id: itemId,
      },
    });
  },

  // Compare motorcycles
  compareMotorcycles: (motorcycleIds: string[]) => {
    event({
      action: 'compare_items',
      category: 'engagement',
      custom_parameters: {
        item_count: motorcycleIds.length,
        item_ids: motorcycleIds.join(','),
        content_type: 'motorcycle_comparison',
      },
    });
  },

  // Share content
  shareContent: (contentType: 'motorcycle' | 'shop', itemId: string, method: string) => {
    event({
      action: 'share',
      category: 'engagement',
      custom_parameters: {
        content_type: contentType,
        item_id: itemId,
        method: method,
      },
    });
  },
};