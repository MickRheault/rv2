// SEO configuration and utilities for Global Moto Rentals
import { Metadata } from 'next';

export interface SEOConfig {
  title: string;
  description: string;
  keywords?: string[];
  images?: string[];
  url?: string;
  type?: 'website' | 'article';
  locale?: string;
  siteName?: string;
  twitterHandle?: string;
  noIndex?: boolean;
  canonical?: string;
}

// Default site configuration
export const SITE_CONFIG = {
  name: 'Global Moto Rentals',
  title: 'Global Moto Rentals - Worldwide Motorcycle Rental Platform',
  description: 'Discover and compare motorcycle rentals worldwide. Find the perfect bike for your adventure.',
  url: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
  twitterHandle: '@globalmotorentals', // Update with your actual Twitter handle
  locale: 'en_US',
  defaultImage: '/images/og-default.png',
  keywords: [
    'motorcycle rental',
    'bike rental',
    'motorcycle hire',
    'travel',
    'adventure',
    'touring bikes',
    'sports bikes',
    'motorcycle vacation',
    'bike sharing',
    'rental marketplace'
  ] as string[],
} as const;

// Generate complete metadata for a page
export function generateMetadata(config: SEOConfig): Metadata {
  const {
    title,
    description,
    keywords = SITE_CONFIG.keywords,
    images = [SITE_CONFIG.defaultImage],
    url,
    type = 'website' as 'website' | 'article',
    locale = SITE_CONFIG.locale,
    noIndex = false,
    canonical,
  } = config;

  const fullTitle = title.includes(SITE_CONFIG.name) ? title : `${title} | ${SITE_CONFIG.name}`;
  const fullUrl = url ? `${SITE_CONFIG.url}${url}` : SITE_CONFIG.url;
  const imageUrls = images.map(img => 
    img.startsWith('http') ? img : `${SITE_CONFIG.url}${img}`
  );

  return {
    title: fullTitle,
    description,
    keywords: keywords.join(', '),
    authors: [{ name: SITE_CONFIG.name }],
    creator: SITE_CONFIG.name,
    publisher: SITE_CONFIG.name,
    formatDetection: {
      email: false,
      address: false,
      telephone: false,
    },
    metadataBase: new URL(SITE_CONFIG.url),
    alternates: {
      canonical: canonical || fullUrl,
    },
    openGraph: {
      title: fullTitle,
      description,
      url: fullUrl,
      siteName: SITE_CONFIG.name,
      images: imageUrls.map(url => ({
        url,
        width: 1200,
        height: 630,
        alt: title,
      })),
      locale,
      type,
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description,
      creator: SITE_CONFIG.twitterHandle,
      images: imageUrls,
    },
    robots: {
      index: !noIndex,
      follow: !noIndex,
      googleBot: {
        index: !noIndex,
        follow: !noIndex,
        'max-video-preview': -1,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    },
    verification: {
      // Add your verification codes here when available
      // google: 'your-google-verification-code',
      // yandex: 'your-yandex-verification-code',
      // bing: 'your-bing-verification-code',
    },
  };
}

// Predefined page configurations
export const PAGE_CONFIGS = {
  home: {
    title: 'Motorcycle Rentals Worldwide - Choose the best rental for your adventure',
    description: 'Find motorcycle rental from trusted businesses worldwide. Compare prices and discover the perfect bike for your adventure. From city scooters to touring bikes.',
    keywords: [
      'motorcycle rental',
      'bike rental worldwide',
      'motorcycle hire',
      'rental comparison',
      'travel motorcycles',
      'adventure bikes',
      'touring motorcycles',
      'city bikes',
      'scooter rental'
    ] as string[],
  },
  search: {
    title: 'Find Motorcycle Rentals',
    description: 'Search and compare motorcycle rentals in your desired location. Filter by bike type, price, and features to find the perfect rental for your trip.',
    keywords: [
      'search motorcycles',
      'find bike rental',
      'motorcycle search',
      'rental filter',
      'compare bikes',
      'local rentals'
    ] as string[],
  },
  about: {
    title: 'About Global Moto Rentals - Motorcycle Rental Platform',
    description: 'Learn about Global Moto Rentals, the trusted platform connecting motorcycle enthusiasts with quality rental providers worldwide. Our mission is to make motorcycle travel accessible and safe.',
    keywords: [
      'about global moto rentals',
      'motorcycle platform',
      'rental marketplace',
      'travel platform',
      'motorcycle community'
    ] as string[],
  },
  contact: {
    title: 'Contact Us - Get Help & Support',
    description: 'Get in touch with the Global Moto Rentals team. We\'re here to help with your motorcycle rental questions, booking support, or partnership inquiries.',
    keywords: [
      'contact global moto rentals',
      'customer support',
      'help center',
      'rental support',
      'partnership'
    ] as string[],
  },
  help: {
    title: 'Help Center - Motorcycle Rental Guide',
    description: 'Find answers to common questions about motorcycle rentals, booking process, insurance, and safety tips. Your complete guide to renting motorcycles.',
    keywords: [
      'help center',
      'rental guide',
      'motorcycle tips',
      'booking help',
      'safety guide',
      'insurance info'
    ] as string[],
  },
  safety: {
    title: 'Motorcycle Safety Guide & Tips',
    description: 'Essential motorcycle safety tips, gear recommendations, and best practices for rental riders. Stay safe on your motorcycle adventure.',
    keywords: [
      'motorcycle safety',
      'riding tips',
      'safety gear',
      'helmet guide',
      'safe riding',
      'motorcycle protection'
    ] as string[],
  },
  privacy: {
    title: 'Privacy Policy - Data Protection',
    description: 'Learn how Global Moto Rentals protects your privacy and handles your personal data. Our commitment to transparent data practices and user rights.',
    keywords: [
      'privacy policy',
      'data protection',
      'user privacy',
      'cookie policy',
      'data rights'
    ] as string[],
  },
  terms: {
    title: 'Terms of Service - Usage Agreement',
    description: 'Terms and conditions for using Global Moto Rentals platform, including user responsibilities, booking terms, and service limitations.',
    keywords: [
      'terms of service',
      'usage terms',
      'booking terms',
      'user agreement',
      'service conditions'
    ] as string[],
  },
} as const;

// Generate dynamic SEO for motorcycles
export function generateMotorcycleSEO(motorcycle: {
  id: string;
  model?: string;
  brand?: string;
  location?: string;
  pricePerDay?: number;
  currency?: string;
  year?: number;
  category?: string;
  image?: string;
}): SEOConfig {
  const { model, brand, location, pricePerDay, currency, year, category, image } = motorcycle;
  
  const bikeName = `${year || ''} ${brand || ''} ${model || ''}`.trim() || 'Motorcycle';
  const locationText = location ? ` in ${location}` : '';
  
  // Format price with correct currency
  let priceText = '';
  if (pricePerDay && currency) {
    priceText = ` from ${currency}${pricePerDay}/day`;
  } else if (pricePerDay) {
    priceText = ` from $${pricePerDay}/day`;
  }
  
  const categoryText = category ? ` ${category}` : '';

  return {
    title: `${bikeName} Rental${locationText} - Book Now`,
    description: `Rent a ${bikeName}${locationText}${priceText}. ${categoryText} motorcycle rental with trusted providers. Check availability and book your adventure bike today.`,
    keywords: [
      `${brand?.toLowerCase()} rental`,
      `${model?.toLowerCase()} hire`,
      `${category?.toLowerCase()} rental`,
      `motorcycle rental ${location?.toLowerCase()}`,
      'bike rental',
      'motorcycle hire',
      `${brand?.toLowerCase()} ${model?.toLowerCase()}`
    ].filter(Boolean) as string[],
    images: image ? [image] : undefined,
    type: 'article',
  };
}

// Generate dynamic SEO for shops
export function generateShopSEO(shop: {
  id: string;
  name?: string;
  location?: string;
  city?: string;
  country?: string;
  description?: string;
  image?: string;
  rating?: number;
}): SEOConfig {
  const { name, location, city, country, description, image, rating } = shop;
  
  const locationText = city && country ? `${city}, ${country}` : location || '';
  const ratingText = rating ? ` (${rating}/5 stars)` : '';

  return {
    title: `${name || 'Motorcycle Rental Shop'}${locationText ? ` - ${locationText}` : ''}`,
    description: description || `Professional motorcycle rental services in ${locationText}. Quality bikes, competitive prices, and excellent customer service${ratingText}.`,
    keywords: [
      `motorcycle rental ${city?.toLowerCase()}`,
      `bike hire ${country?.toLowerCase()}`,
      `${name?.toLowerCase()}`,
      'rental shop',
      'motorcycle dealer',
      `bikes ${locationText?.toLowerCase()}`
    ].filter(Boolean) as string[],
    images: image ? [image] : undefined,
    type: 'article',
  };
}

// Generate dynamic SEO for search results
export function generateSearchSEO(params: {
  location?: string;
  category?: string;
  brand?: string;
  priceRange?: string;
  resultsCount?: number;
}): SEOConfig {
  const { location, category, brand, priceRange, resultsCount } = params;
  
  let title = 'Find Motorcycle Rentals';
  let description = 'Search and compare motorcycle rentals';
  
  const filters = [];
  if (category) filters.push(category);
  if (brand) filters.push(brand);
  if (location) filters.push(`in ${location}`);
  
  if (filters.length > 0) {
    title = `${filters.join(' ')} Rentals - Compare & Book`;
    description = `Find ${filters.join(' ').toLowerCase()} motorcycle rentals. Compare prices and book the perfect bike for your adventure.`;
  }
  
  if (resultsCount !== undefined) {
    description += ` ${resultsCount} options available.`;
  }

  return {
    title,
    description,
    keywords: [
      'motorcycle search',
      'find rentals',
      category?.toLowerCase(),
      brand?.toLowerCase(),
      location?.toLowerCase(),
    ].filter(Boolean) as string[],
  };
}