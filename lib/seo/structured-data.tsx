// Structured data (JSON-LD) generators for rich snippets
import React from 'react';
import { SITE_CONFIG } from './config';
import { getShopUrl } from '@/lib/utils/urls';

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
      // 'https://facebook.com/globalmotorentals',
      // 'https://twitter.com/globalmotorentals',
      // 'https://instagram.com/globalmotorentals',
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
    // Only include offers if price is available
    ...(pricePerDay ? {
      offers: {
        '@type': 'Offer',
        price: pricePerDay.toString(),
        priceCurrency: currency,
        priceSpecification: {
          '@type': 'PriceSpecification',
          price: pricePerDay.toString(),
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
    } : {}),
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

// Location-based shop listings schema
export function generateLocationShopListingSchema(params: {
  location: string;
  locationType: 'country' | 'city';
  shops: Array<{
    id: string;
    provider_name: string;
    slug: string;
    full_address?: string | null;
    phone?: string | null;
    website?: string | null;
    rating?: number | null;
    cities?: {
      name: string;
      provinces?: {
        name: string;
        countries?: {
          name: string;
          code: string;
        } | null;
      } | null;
    } | null;
  }>;
  url: string;
}) {
  const { location, locationType, shops, url } = params;
  
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    '@id': url,
    name: `Motorcycle Rental Shops in ${location}`,
    description: `Find and compare motorcycle rental shops in ${location}. Browse ${shops.length} rental businesses offering bikes, scooters, and motorcycle rentals.`,
    url,
    mainEntity: {
      '@type': 'ItemList',
      name: `Motorcycle Rental Shops in ${location}`,
      description: `Complete list of motorcycle rental businesses in ${location}`,
      numberOfItems: shops.length,
      itemListElement: shops.map((shop, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        item: {
          '@type': 'LocalBusiness',
          '@id': `${SITE_CONFIG.url}${shop.cities?.provinces?.countries?.name && shop.cities?.name ? `/shop/${shop.cities.provinces.countries.name.toLowerCase().replace(/\s+/g, '-')}/${shop.cities.name.toLowerCase().replace(/\s+/g, '-')}/${shop.slug}` : `/shop/${shop.slug}`}`,
          name: shop.provider_name,
          url: `${SITE_CONFIG.url}${shop.cities?.provinces?.countries?.name && shop.cities?.name ? `/shop/${shop.cities.provinces.countries.name.toLowerCase().replace(/\s+/g, '-')}/${shop.cities.name.toLowerCase().replace(/\s+/g, '-')}/${shop.slug}` : `/shop/${shop.slug}`}`,
          telephone: shop.phone || undefined,
          sameAs: shop.website ? [shop.website] : undefined,
          address: {
            '@type': 'PostalAddress',
            streetAddress: shop.full_address || undefined,
            addressLocality: shop.cities?.name,
            addressRegion: shop.cities?.provinces?.name,
            addressCountry: shop.cities?.provinces?.countries?.name,
          },
          aggregateRating: shop.rating ? {
            '@type': 'AggregateRating',
            ratingValue: shop.rating,
          } : undefined,
          serviceType: 'Motorcycle Rental',
          areaServed: {
            '@type': locationType === 'city' ? 'City' : 'Country',
            name: locationType === 'city' ? shop.cities?.name : shop.cities?.provinces?.countries?.name,
          },
        },
      })),
    },
    breadcrumb: {
      '@type': 'BreadcrumbList',
      itemListElement: locationType === 'city' 
        ? [
            {
              '@type': 'ListItem',
              position: 1,
              name: 'Home',
              item: SITE_CONFIG.url,
            },
            {
              '@type': 'ListItem',
              position: 2,
              name: 'Browse Locations',
              item: `${SITE_CONFIG.url}/browse`,
            },
            {
              '@type': 'ListItem',
              position: 3,
              name: shops[0]?.cities?.provinces?.countries?.name || 'Country',
              item: `${SITE_CONFIG.url}/${shops[0]?.cities?.provinces?.countries?.name?.toLowerCase().replace(/\s+/g, '-')}/`,
            },
            {
              '@type': 'ListItem',
              position: 4,
              name: `${location} Motorcycle Rentals`,
              item: url,
            },
          ]
        : [
            {
              '@type': 'ListItem',
              position: 1,
              name: 'Home',
              item: SITE_CONFIG.url,
            },
            {
              '@type': 'ListItem',
              position: 2,
              name: 'Browse Locations',
              item: `${SITE_CONFIG.url}/browse`,
            },
            {
              '@type': 'ListItem',
              position: 3,
              name: `${location} Motorcycle Rentals`,
              item: url,
            },
          ],
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

// Enhanced Vehicle schema for motorcycles
export function generateVehicleSchema(motorcycle: {
  id: string;
  model?: string;
  brand?: string;
  year?: number;
  engineSize?: number;
  fuelType?: string;
  transmission?: string;
  category?: string;
  description?: string;
  image?: string;
  features?: string[];
  specifications?: Record<string, any>;
}) {
  const { id, model, brand, year, engineSize, fuelType, transmission, category, description, image, features, specifications } = motorcycle;
  
  const vehicleName = `${year || ''} ${brand || ''} ${model || ''}`.trim();
  
  return {
    '@context': 'https://schema.org',
    '@type': 'Vehicle',
    '@id': `${SITE_CONFIG.url}/motorcycle/${id}`,
    name: vehicleName,
    description: description || `${vehicleName} motorcycle rental`,
    manufacturer: brand ? {
      '@type': 'Organization',
      name: brand,
    } : undefined,
    model,
    vehicleModelDate: year,
    vehicleConfiguration: category,
    vehicleEngine: engineSize ? {
      '@type': 'EngineSpecification',
      engineDisplacement: `${engineSize}cc`,
      fuelType: fuelType || 'Gasoline',
    } : undefined,
    vehicleTransmission: transmission,
    image: image ? `${SITE_CONFIG.url}${image}` : undefined,
    additionalProperty: [
      ...(features || []).map(feature => ({
        '@type': 'PropertyValue',
        name: 'Feature',
        value: feature,
      })),
      ...(specifications ? Object.entries(specifications).map(([key, value]) => ({
        '@type': 'PropertyValue',
        name: key,
        value: value?.toString(),
      })) : []),
    ].filter(Boolean),
  };
}

// Multi-tier pricing schema
export function generatePricingSchema(rentalRates: Array<{
  rateText?: string;
  minDays: number;
  maxDays?: number;
  ratePerDay?: number;
  currency?: string;
}>) {
  return rentalRates.map((rate, index) => ({
    '@type': 'PriceSpecification',
    name: rate.rateText || `${rate.minDays}-${rate.maxDays || '+'} day rental`,
    price: rate.ratePerDay?.toString(),
    priceCurrency: rate.currency || 'USD',
    eligibleQuantity: {
      '@type': 'QuantitativeValue',
      minValue: rate.minDays,
      maxValue: rate.maxDays || 999,
      unitCode: 'DAY',
      unitText: 'days',
    },
    validFrom: new Date().toISOString(),
  }));
}

// Insurance product schema
export function generateInsuranceSchema(insuranceDetails: Array<{
  typeName: string;
  isIncluded: boolean;
  costPerDay?: number;
  currency?: string;
  deductible?: number;
  deductibleCurrency?: string;
  notes?: string;
}>) {
  return insuranceDetails.map(insurance => ({
    '@context': 'https://schema.org',
    '@type': 'InsurancePolicy',
    name: insurance.typeName,
    description: insurance.notes || `${insurance.typeName} motorcycle insurance`,
    provider: {
      '@type': 'Organization',
      name: SITE_CONFIG.name,
    },
    offers: {
      '@type': 'Offer',
      price: insurance.isIncluded ? '0' : insurance.costPerDay?.toString(),
      priceCurrency: insurance.currency || 'USD',
      description: insurance.isIncluded ? 'Included in rental' : 'Optional coverage',
    },
    deductible: insurance.deductible ? {
      '@type': 'MonetaryAmount',
      value: insurance.deductible,
      currency: insurance.deductibleCurrency || insurance.currency || 'USD',
    } : undefined,
  }));
}

// Tour/Activity schema
export function generateTourSchema(tours: Array<{
  name: string;
  durationText?: string;
  distanceKm?: number;
  priceText?: string;
  currency?: string;
}>) {
  return tours.map(tour => ({
    '@context': 'https://schema.org',
    '@type': 'TouristTrip',
    name: tour.name,
    description: `${tour.name} motorcycle tour`,
    duration: tour.durationText,
    distance: tour.distanceKm ? `${tour.distanceKm} km` : undefined,
    offers: tour.priceText ? {
      '@type': 'Offer',
      name: `${tour.name} Tour`,
      description: tour.priceText,
      priceCurrency: tour.currency || 'USD',
    } : undefined,
    provider: {
      '@type': 'Organization',
      name: SITE_CONFIG.name,
    },
  }));
}

// Service schema with conditions and inclusions
export function generateRentalServiceSchema(serviceData: {
  shopId: string;
  shopName: string;
  rentalConditions?: Record<string, any>;
  rentalInclusions?: string[];
  serviceLocations?: string[];
  requiredDocuments?: string[];
}) {
  const { shopId, shopName, rentalConditions, rentalInclusions, serviceLocations, requiredDocuments } = serviceData;
  
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    '@id': `${SITE_CONFIG.url}/shop/${shopId}#rental-service`,
    name: 'Motorcycle Rental Service',
    description: `Professional motorcycle rental services by ${shopName}`,
    provider: {
      '@type': 'Organization',
      name: shopName,
      '@id': `${SITE_CONFIG.url}/shop/${shopId}`,
    },
    serviceType: 'Vehicle Rental',
    areaServed: serviceLocations?.map(location => ({
      '@type': 'Place',
      name: location,
    })),
    termsOfService: rentalConditions ? Object.entries(rentalConditions).map(([key, value]) => 
      `${key}: ${value}`
    ).join('; ') : undefined,
    additionalProperty: [
      ...(rentalInclusions || []).map(inclusion => ({
        '@type': 'PropertyValue',
        name: 'Included',
        value: inclusion,
      })),
      ...(requiredDocuments || []).map(doc => ({
        '@type': 'PropertyValue',
        name: 'Required Document',
        value: doc,
      })),
    ].filter(Boolean),
  };
}

// Enhanced motorcycle schema combining all elements
export function generateEnhancedMotorcycleSchema(motorcycle: {
  id: string;
  model?: string;
  brand?: string;
  year?: number;
  engineSize?: number;
  category?: string;
  description?: string;
  image?: string;
  features?: string[];
  rentalRates?: Array<{
    rateText?: string;
    minDays: number;
    maxDays?: number;
    ratePerDay?: number;
    currency?: string;
  }>;
  insuranceDetails?: Array<{
    typeName: string;
    isIncluded: boolean;
    costPerDay?: number;
    currency?: string;
    deductible?: number;
    notes?: string;
  }>;
  specifications?: Record<string, any>;
  availability?: boolean;
}) {
  const baseVehicleSchema = generateVehicleSchema(motorcycle);
  const pricingSchemas = motorcycle.rentalRates ? generatePricingSchema(motorcycle.rentalRates) : [];
  
  // Only include offers if there are actual rental rates with prices
  const hasValidPricing = pricingSchemas.length > 0 && pricingSchemas.some(rate => rate.price);
  
  return {
    ...baseVehicleSchema,
    '@type': ['Vehicle', 'Product'],
    // Only include offers object if pricing is available
    ...(hasValidPricing ? {
      offers: {
        '@type': 'Offer',
        name: `${baseVehicleSchema.name} Rental`,
        description: `Rent ${baseVehicleSchema.name} from trusted providers`,
        availability: motorcycle.availability ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
        priceSpecification: pricingSchemas,
        seller: {
          '@type': 'Organization',
          name: SITE_CONFIG.name,
        },
      },
    } : {}),
    // Include insurance as additional services if available
    ...(motorcycle.insuranceDetails && motorcycle.insuranceDetails.length > 0 ? {
      additionalService: generateInsuranceSchema(motorcycle.insuranceDetails),
    } : {}),
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

// Browse page schema for country listings
export function generateBrowsePageSchema(countries: Array<{
  country: {
    code: string;
    name: string;
  };
  provinces: Record<string, {
    cities: Array<{
      id: string;
      name: string;
    }>
  }>
}>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Browse Motorcycle Rentals by Location',
    description: 'Explore motorcycle rental shops by country and city. Find the best rental locations worldwide.',
    url: `${SITE_CONFIG.url}/browse`,
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: countries.map((c, index) => {
        const countryUrlName = c.country.name.toLowerCase().replace(/\s+/g, '-');
        const cities = Object.values(c.provinces).flatMap(p => p.cities);

        return {
          '@type': 'ListItem',
          position: index + 1,
          item: {
            '@type': 'Country',
            name: c.country.name,
            url: `${SITE_CONFIG.url}/${countryUrlName}`,
            containsPlace: cities.map(city => ({
              '@type': 'City',
              name: city.name,
              url: `${SITE_CONFIG.url}/${countryUrlName}/${city.name.toLowerCase().replace(/\s+/g, '-')}`,
            })),
          },
        }
      }),
    },
    breadcrumb: {
        '@type': 'BreadcrumbList',
        itemListElement: [
            {
                '@type': 'ListItem',
                position: 1,
                name: 'Home',
                item: SITE_CONFIG.url,
            },
            {
                '@type': 'ListItem',
                position: 2,
                name: 'Browse Locations',
                item: `${SITE_CONFIG.url}/browse`,
            }
        ]
    }
  };
}