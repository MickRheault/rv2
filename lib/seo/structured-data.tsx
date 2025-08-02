// Structured data (JSON-LD) generators for rich snippets
import React from 'react';
import { SITE_CONFIG } from './config';

// Organization schema for the company
export function generateOrganizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE_CONFIG.name,
    url: SITE_CONFIG.url,
    description: SITE_CONFIG.description,
    logo: `${SITE_CONFIG.url}/images/logo.png`,
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer service',
      url: `${SITE_CONFIG.url}/contact`,
    },
    sameAs: [
      // Add your social media URLs here
      // 'https://facebook.com/ridevault',
      // 'https://twitter.com/ridevault',
      // 'https://instagram.com/ridevault',
    ],
  };
}

// Website schema
export function generateWebsiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_CONFIG.name,
    url: SITE_CONFIG.url,
    description: SITE_CONFIG.description,
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${SITE_CONFIG.url}/search?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };
}

// Motorcycle product schema
export function generateMotorcycleSchema(motorcycle: {
  id: string;
  model?: string;
  brand?: string;
  year?: number;
  category?: string;
  description?: string;
  pricePerDay?: number;
  currency?: string;
  image?: string;
  location?: string;
  features?: string[];
  fuelType?: string;
  engineSize?: number;
  transmission?: string;
  availability?: boolean;
}) {
  const {
    id,
    model,
    brand,
    year,
    category,
    description,
    pricePerDay,
    currency = 'USD',
    image,
    location,
    features,
    fuelType,
    engineSize,
    transmission,
    availability = true
  } = motorcycle;

  const name = `${year || ''} ${brand || ''} ${model || ''}`.trim();
  
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    '@id': `${SITE_CONFIG.url}/motorcycle/${id}`,
    name,
    description: description || `${name} motorcycle rental ${location ? `in ${location}` : ''}`,
    brand: {
      '@type': 'Brand',
      name: brand,
    },
    category: category || 'Motorcycle',
    image: image ? `${SITE_CONFIG.url}${image}` : undefined,
    url: `${SITE_CONFIG.url}/motorcycle/${id}`,
    sku: id,
    offers: {
      '@type': 'Offer',
      price: pricePerDay?.toString(),
      priceCurrency: currency,
      priceSpecification: {
        '@type': 'PriceSpecification',
        price: pricePerDay?.toString(),
        priceCurrency: currency,
        unitCode: 'DAY',
      },
      availability: availability ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      seller: {
        '@type': 'Organization',
        name: SITE_CONFIG.name,
      },
      areaServed: location,
    },
    additionalProperty: [
      year && {
        '@type': 'PropertyValue',
        name: 'Year',
        value: year.toString(),
      },
      engineSize && {
        '@type': 'PropertyValue',
        name: 'Engine Size',
        value: `${engineSize}cc`,
      },
      fuelType && {
        '@type': 'PropertyValue',
        name: 'Fuel Type',
        value: fuelType,
      },
      transmission && {
        '@type': 'PropertyValue',
        name: 'Transmission',
        value: transmission,
      },
      ...(features || []).map(feature => ({
        '@type': 'PropertyValue',
        name: 'Feature',
        value: feature,
      })),
    ].filter(Boolean),
  };
}

// Rental shop/business schema
export function generateRentalShopSchema(shop: {
  id: string;
  name: string;
  description?: string;
  address?: string;
  city?: string;
  country?: string;
  phone?: string;
  email?: string;
  website?: string;
  image?: string;
  latitude?: number;
  longitude?: number;
  rating?: number;
  reviewCount?: number;
  openingHours?: string[];
}) {
  const {
    id,
    name,
    description,
    address,
    city,
    country,
    phone,
    email,
    website,
    image,
    latitude,
    longitude,
    rating,
    reviewCount,
    openingHours,
  } = shop;

  return {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    '@id': `${SITE_CONFIG.url}/shop/${id}`,
    name,
    description: description || `Motorcycle rental services in ${city}, ${country}`,
    url: `${SITE_CONFIG.url}/shop/${id}`,
    image: image ? `${SITE_CONFIG.url}${image}` : undefined,
    telephone: phone,
    email,
    sameAs: website ? [website] : undefined,
    address: {
      '@type': 'PostalAddress',
      streetAddress: address,
      addressLocality: city,
      addressCountry: country,
    },
    geo: latitude && longitude ? {
      '@type': 'GeoCoordinates',
      latitude,
      longitude,
    } : undefined,
    aggregateRating: rating && reviewCount ? {
      '@type': 'AggregateRating',
      ratingValue: rating,
      reviewCount,
    } : undefined,
    openingHoursSpecification: openingHours?.map(hours => ({
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: hours.split(' ')[0],
      opens: hours.split(' ')[1],
      closes: hours.split(' ')[2],
    })),
    serviceType: 'Motorcycle Rental',
    areaServed: {
      '@type': 'City',
      name: city,
    },
  };
}

// Breadcrumb schema
export function generateBreadcrumbSchema(breadcrumbs: { name: string; url: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: breadcrumbs.map((crumb, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: crumb.name,
      item: `${SITE_CONFIG.url}${crumb.url}`,
    })),
  };
}

// FAQ schema for help/support pages
export function generateFAQSchema(faqs: { question: string; answer: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map(faq => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };
}

// How-to schema for guides
export function generateHowToSchema(guide: {
  name: string;
  description: string;
  steps: { name: string; text: string }[];
  image?: string;
  totalTime?: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: guide.name,
    description: guide.description,
    image: guide.image ? `${SITE_CONFIG.url}${guide.image}` : undefined,
    totalTime: guide.totalTime,
    step: guide.steps.map((step, index) => ({
      '@type': 'HowToStep',
      position: index + 1,
      name: step.name,
      text: step.text,
    })),
  };
}

// Generic schema component for easy embedding
export function StructuredData({ schema }: { schema: object }): JSX.Element {
  return React.createElement('script', {
    type: 'application/ld+json',
    dangerouslySetInnerHTML: {
      __html: JSON.stringify(schema),
    },
  });
}