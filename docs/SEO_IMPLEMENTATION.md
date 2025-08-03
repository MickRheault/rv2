# SEO Implementation Guide

This document outlines the comprehensive SEO system implemented for the RideVault platform.

## 🎯 **Overview**

Our SEO implementation provides:
- ✅ **Enhanced meta tags** for all pages
- ✅ **Open Graph** and **Twitter Card** support
- ✅ **Structured data (JSON-LD)** for rich snippets
- ✅ **Dynamic SEO** for motorcycles and shops
- ✅ **Centralized configuration** system

## 📁 **File Structure**

```
lib/seo/
├── config.ts           # SEO configuration and metadata generation
├── structured-data.tsx  # JSON-LD schema generators
└── index.ts            # Export utilities
```

## 🔧 **Core Components**

### 1. SEO Configuration (`lib/seo/config.ts`)

**Key Functions:**
- `generateMetadata(config: SEOConfig)` - Creates Next.js metadata
- `generateMotorcycleSEO()` - Dynamic SEO for motorcycle pages
- `generateShopSEO()` - Dynamic SEO for shop pages
- `generateSearchSEO()` - Dynamic SEO for search results

**Predefined Configurations:**
- `PAGE_CONFIGS` - Static page SEO settings
- `SITE_CONFIG` - Global site configuration

### 2. Structured Data (`lib/seo/structured-data.tsx`)

**Schema Types Available:**
- `generateOrganizationSchema()` - Company information
- `generateWebsiteSchema()` - Site-wide search functionality
- `generateMotorcycleSchema()` - Product schema for motorcycles
- `generateRentalShopSchema()` - Local business schema
- `generateBreadcrumbSchema()` - Navigation breadcrumbs
- `generateFAQSchema()` - FAQ pages
- `generateHowToSchema()` - Step-by-step guides

## 🚀 **Usage Examples**

### Static Page SEO
```typescript
// app/about/page.tsx
import { generateMetadata, PAGE_CONFIGS } from '@/lib/seo/config'

export const metadata = generateMetadata(PAGE_CONFIGS.about)
```

### Dynamic Page SEO
```typescript
// app/motorcycle/[id]/page.tsx
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const motorcycle = await getMotorcycleById(params.id)
  
  const seoConfig = generateMotorcycleSEO({
    id: motorcycle.id,
    model: motorcycle.model,
    brand: motorcycle.brands?.name,
    location: motorcycle.location,
    pricePerDay: motorcycle.price,
    // ... more fields
  })
  
  return generateMetadata({
    ...seoConfig,
    url: `/motorcycle/${params.id}`,
  })
}
```

### Adding Structured Data
```typescript
// In your component
import { StructuredData, generateMotorcycleSchema } from '@/lib/seo'

export default function MotorcyclePage({ motorcycle }) {
  const schema = generateMotorcycleSchema(motorcycle)
  
  return (
    <>
      <StructuredData schema={schema} />
      {/* Your page content */}
    </>
  )
}
```

## 📊 **SEO Features by Page Type**

### Homepage
- **Title:** "Motorcycle Rentals Worldwide - Compare & Book"
- **Keywords:** motorcycle rental, bike rental worldwide, rental comparison
- **Schema:** Organization + Website search

### Motorcycle Details
- **Dynamic Title:** "{Brand} {Model} Rental in {Location}"
- **Dynamic Description:** Includes specs, price, and location
- **Schema:** Product schema with pricing and availability
- **Images:** Motorcycle gallery for rich previews

### Shop Details
- **Dynamic Title:** "{Shop Name} - {Location}"
- **Schema:** Local business with contact info and location
- **Location-based:** City and country for geographic SEO

### Search Results
- **Dynamic Title:** Based on filters applied
- **Keywords:** Dynamically generated from search criteria
- **Results Count:** Included in meta description

## 🎨 **Meta Tag Structure**

Each page includes:

```html
<!-- Basic Meta -->
<title>Page Title | RideVault</title>
<meta name="description" content="Page description under 160 chars" />
<meta name="keywords" content="relevant, keywords, here" />

<!-- Open Graph -->
<meta property="og:title" content="Page Title" />
<meta property="og:description" content="Page description" />
<meta property="og:image" content="https://ridevault.com/image.jpg" />
<meta property="og:url" content="https://ridevault.com/page" />
<meta property="og:type" content="website" />

<!-- Twitter Cards -->
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="Page Title" />
<meta name="twitter:description" content="Page description" />
<meta name="twitter:image" content="https://ridevault.com/image.jpg" />

<!-- Technical -->
<link rel="canonical" href="https://ridevault.com/page" />
<meta name="robots" content="index, follow" />
```

## 🔍 **Structured Data Examples**

### Motorcycle Schema
```json
{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "2024 Honda CBR600RR",
  "description": "Sports motorcycle rental in Tokyo",
  "brand": { "@type": "Brand", "name": "Honda" },
  "offers": {
    "@type": "Offer",
    "price": "8000",
    "priceCurrency": "JPY",
    "availability": "https://schema.org/InStock"
  }
}
```

### Local Business Schema
```json
{
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  "name": "Tokyo Bike Rentals",
  "address": {
    "@type": "PostalAddress",
    "addressLocality": "Tokyo",
    "addressCountry": "Japan"
  },
  "serviceType": "Motorcycle Rental"
}
```

## 📈 **SEO Best Practices Implemented**

1. **Title Optimization**
   - Unique titles for every page
   - Include primary keywords
   - Keep under 60 characters
   - Brand name consistently placed

2. **Meta Descriptions**
   - Compelling and informative
   - 150-160 character limit
   - Include call-to-action
   - Unique for each page

3. **Keyword Strategy**
   - Primary keywords in titles
   - Long-tail keywords for specificity
   - Location-based keywords
   - Intent-based keywords

4. **Image SEO**
   - Alt text for all images
   - Open Graph images optimized
   - Twitter Card images included
   - Schema.org image properties

5. **Technical SEO**
   - Canonical URLs prevent duplicates
   - Proper viewport meta tags
   - robots.txt directives
   - Structured data validation

## 🛠 **Customization**

### Adding New Page Configurations
```typescript
// In lib/seo/config.ts
export const PAGE_CONFIGS = {
  // ... existing configs
  newPage: {
    title: 'New Page Title',
    description: 'New page description',
    keywords: ['keyword1', 'keyword2'] as string[],
  },
}
```

### Creating Custom Schema
```typescript
// In lib/seo/structured-data.tsx
export function generateCustomSchema(data: CustomData) {
  return {
    '@context': 'https://schema.org',
    '@type': 'CustomType',
    // ... your schema properties
  }
}
```

## 🧪 **Testing Your SEO**

1. **Rich Results Test:** [Google Rich Results Test](https://search.google.com/test/rich-results)
2. **Open Graph Debugger:** [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/)
3. **Twitter Card Validator:** [Twitter Card Validator](https://cards-dev.twitter.com/validator)
4. **Schema Markup Validator:** [Schema.org Validator](https://validator.schema.org/)

## 📝 **Next Steps**

- [ ] Add hreflang for international SEO
- [ ] Implement breadcrumb schema on relevant pages
- [ ] Add FAQ schema to help pages
- [ ] Consider implementing AMP pages for mobile
- [ ] Set up Google Search Console property verification

---

**Need help?** Check the implementation files in `lib/seo/` or refer to the [Next.js Metadata API documentation](https://nextjs.org/docs/app/api-reference/functions/generate-metadata).