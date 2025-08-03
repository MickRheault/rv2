# Enhanced Structured Data Implementation

## Overview

This document describes the enhanced structured data (JSON-LD) schemas implemented for RideVault to improve search engine optimization and rich snippet visibility.

## Implemented Schemas

### 1. Enhanced Vehicle Schema (`generateVehicleSchema`)

**Purpose**: Provides detailed motorcycle specifications for rich vehicle snippets.

**Features**:
- Vehicle type and model information
- Engine specifications (displacement, fuel type)
- Transmission details
- Manufacturer information
- Additional properties (features, specifications)

**Usage**:
```typescript
const vehicleSchema = generateVehicleSchema({
  id: 'motorcycle-123',
  model: 'Ninja 300',
  brand: 'Kawasaki',
  year: 2023,
  engineSize: 296,
  fuelType: 'Gasoline',
  transmission: 'Manual',
  category: 'Sport',
  features: ['ABS', 'LED Lights'],
  specifications: { 'Top Speed': '180 km/h' }
})
```

### 2. Multi-Tier Pricing Schema (`generatePricingSchema`)

**Purpose**: Displays different rental rates for various duration periods.

**Features**:
- Tiered pricing based on rental duration
- Price specifications with eligibility quantities
- Currency support
- Valid date ranges

**Usage**:
```typescript
const pricingSchemas = generatePricingSchema([
  { rateText: '1-3 day rate', minDays: 1, maxDays: 3, ratePerDay: 50, currency: 'USD' },
  { rateText: '4-7 day rate', minDays: 4, maxDays: 7, ratePerDay: 45, currency: 'USD' }
])
```

### 3. Insurance Product Schema (`generateInsuranceSchema`)

**Purpose**: Structured data for insurance coverage options.

**Features**:
- Insurance policy details
- Included vs. optional coverage
- Deductible information
- Cost per day for optional coverage

**Usage**:
```typescript
const insuranceSchemas = generateInsuranceSchema([
  { typeName: 'Third Party', isIncluded: true, notes: 'Basic coverage included' },
  { typeName: 'Comprehensive', isIncluded: false, costPerDay: 15, deductible: 500 }
])
```

### 4. Tour/Activity Schema (`generateTourSchema`)

**Purpose**: Promotes guided tour offerings with structured data.

**Features**:
- Tour name and description
- Duration and distance information
- Pricing details
- Provider information

**Usage**:
```typescript
const tourSchemas = generateTourSchema([
  { name: 'City Explorer Tour', durationText: '4 hours', distanceKm: 60, priceText: '$80' },
  { name: 'Mountain Adventure', durationText: '8 hours', distanceKm: 150, priceText: '$150' }
])
```

### 5. Rental Service Schema (`generateRentalServiceSchema`)

**Purpose**: Details about rental services, conditions, and inclusions.

**Features**:
- Service type and provider
- Rental inclusions and conditions
- Service areas
- Required documents

**Usage**:
```typescript
const serviceSchema = generateRentalServiceSchema({
  shopId: 'shop-123',
  shopName: 'Premium Bike Rentals',
  rentalInclusions: ['Helmet', 'Rain gear', 'Lock'],
  serviceLocations: ['Downtown', 'Airport', 'Beach Area'],
  requiredDocuments: ['Valid Driver License', 'Passport/ID']
})
```

### 6. Enhanced Motorcycle Schema (`generateEnhancedMotorcycleSchema`)

**Purpose**: Complete product schema combining vehicle, pricing, and insurance data.

**Features**:
- Combines Vehicle schema with Product schema
- Multi-tier pricing integration
- Insurance as additional services
- Availability status
- Complete offer details

**Usage**:
```typescript
const enhancedSchema = generateEnhancedMotorcycleSchema({
  id: 'motorcycle-123',
  model: 'Ninja 300',
  brand: 'Kawasaki',
  rentalRates: [...],
  insuranceDetails: [...],
  specifications: {...}
})
```

## Implementation Details

### Database Integration

The enhanced schemas are integrated with the existing database structure:

- **Motorcycle Pages**: Use `generateEnhancedMotorcycleSchema` with rental rate tiers and specifications
- **Shop Pages**: Use `generateRentalServiceSchema`, `generateTourSchema`, and `generateEnhancedMotorcycleSchema` for each motorcycle offered
- **Dynamic Data**: All schemas pull real data from the Supabase database

#### Shop Page Motorcycle Integration

Shop pages now include structured data for every motorcycle they offer:
- Each motorcycle rental gets its own enhanced schema
- Includes basic rental rates from the shop's `motorcycle_rentals` table
- Shows brand, model, year, engine capacity, and availability status
- Provides complete product information for search engines

### Schema Validation

All schemas follow Google's structured data guidelines:
- Use Schema.org vocabulary
- Include required properties
- Provide meaningful descriptions
- Use proper data types

### Field Mappings

Database fields are correctly mapped to schema properties:
- `rental_rate_tiers.min_days` → `PriceSpecification.eligibleQuantity.minValue`
- `rental_shop_inclusions.inclusion_text` → `Service.additionalProperty`
- `rental_shop_tours.name` → `TouristTrip.name`

## SEO Benefits

### Rich Snippets

These schemas enable the following rich snippets in search results:

1. **Vehicle Snippets**: Engine specs, year, brand, features
2. **Pricing Snippets**: Multiple pricing tiers for different durations
3. **Service Snippets**: Inclusions, service areas, requirements
4. **Product Snippets**: Complete motorcycle rental offers
5. **Tour Snippets**: Available guided tours and activities

### Search Visibility

Enhanced structured data improves:
- Search result click-through rates
- Local SEO for shop locations
- Product search visibility
- Service discovery
- Tour and activity promotion

## Testing

### Validation Tools

Test structured data using:
- [Google Rich Results Test](https://search.google.com/test/rich-results)
- [Schema.org Validator](https://validator.schema.org/)
- Google Search Console

### Verification Steps

1. Visit motorcycle detail pages: `/motorcycle/[id]`
2. Visit shop detail pages: `/shop/[slug]`
3. View page source and check for JSON-LD scripts
   - Shop pages should include: LocalBusiness + Service + Tours + Multiple Motorcycle Product schemas
   - Motorcycle pages should include: Enhanced Vehicle/Product schema with pricing tiers
4. Test URLs in Google Rich Results Test
5. Monitor Search Console for structured data errors

## File Structure

```
lib/seo/
├── structured-data.tsx   # All schema generators
├── config.ts            # SEO configuration
└── index.ts             # Exports

app/motorcycle/[id]/page.tsx  # Enhanced motorcycle schemas
app/shop/[slug]/page.tsx      # Service and tour schemas
```

## Future Enhancements

Potential additions based on data availability:
- Review/Rating schemas for shops
- Event schemas for motorcycle tours
- FAQ schemas for common questions
- How-to schemas for rental process

## Maintenance

- Monitor Google Search Console for structured data errors
- Update schemas when database structure changes
- Add new schema types as business features expand
- Regularly test rich snippet appearance in search results