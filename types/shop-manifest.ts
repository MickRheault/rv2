export interface ShopManifest {
  shop: {
    provider_name: string;
    slug?: string;
    city: string; // Name, e.g. "Bangkok"
    address?: string;
    phone?: string;
    website?: string;
    google_maps_url?: string;
    latitude?: number;
    longitude?: number;
    rating?: number;
    review_count?: number;
    
    // Structured data
    inclusions?: string[]; // e.g. ["Helmet", "Phone Holder"]
    conditions?: Record<string, string>; // e.g. { "deposit": "2000 THB", "passport": "Required" }
  };
  
  inventory: {
    defaults?: {
      currency?: string;
      status?: 'AVAILABLE' | 'UNAVAILABLE';
    };
    items: Array<{
      model: string;
      brand: string; // Name, e.g. "Honda"
      category: string; // Name, e.g. "Scooter"
      cc?: number;
      year?: number;
      daily_rate?: number;
      qty?: number; // default 1
      source_url?: string;
      image_url?: string;
    }>;
  };
}

export interface SyncResult {
  shopId: string;
  shopName: string;
  action: 'created' | 'updated' | 'no-change';
  inventory: {
    created: number;
    updated: number;
    skipped: number;
    errors: string[];
  };
}
