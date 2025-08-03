# Shop Components

This directory contains components related to rental shop display and management.

## ShopCard Component

The `ShopCard` component provides a comprehensive display for rental shop information including location, ratings, services, and contact details.

### Features

- **Visual Star Ratings**: Interactive star display with half-star precision
- **Location Information**: Full address with location hierarchy (city, province, country)
- **Status Badges**: Visual indicators for verification status, tours, and delivery services
- **Contact Information**: Clickable phone and website links
- **Service Display**: Tours, service locations, and rental inclusions
- **Interactive Elements**: Favorite toggle, share button, expandable content
- **Responsive Design**: Compact mode for dense layouts, mobile-first approach
- **Accessibility**: ARIA labels, keyboard navigation, screen reader support

### Props

```typescript
interface ShopCardProps {
  shop: ShopWithDetails                    // Shop data from the database
  showServices?: boolean                   // Show tours and service locations (default: true)
  showInclusions?: boolean                 // Show rental inclusions (default: true)
  compact?: boolean                        // Use compact layout (default: false)
  onFavoriteToggle?: (shopId: string, isFavorited: boolean) => void  // Favorite toggle handler
  isFavorited?: boolean                    // Current favorite status (default: false)
  className?: string                       // Additional CSS classes
}
```

### Usage Examples

#### Basic Usage
```tsx
import ShopCard from '@/components/shop/ShopCard'

<ShopCard shop={shopData} />
```

#### With Favorite Toggle
```tsx
const [favorites, setFavorites] = useState<Set<string>>(new Set())

const handleFavoriteToggle = (shopId: string, isFavorited: boolean) => {
  setFavorites(prev => {
    const newFavorites = new Set(prev)
    if (isFavorited) {
      newFavorites.add(shopId)
    } else {
      newFavorites.delete(shopId)
    }
    return newFavorites
  })
}

<ShopCard
  shop={shopData}
  onFavoriteToggle={handleFavoriteToggle}
  isFavorited={favorites.has(shopData.id)}
/>
```

#### Compact Layout
```tsx
<ShopCard
  shop={shopData}
  compact={true}
  showServices={false}
  showInclusions={false}
/>
```

#### Grid Layout
```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
  {shops.map((shop) => (
    <ShopCard
      key={shop.id}
      shop={shop}
      onFavoriteToggle={handleFavoriteToggle}
      isFavorited={favorites.has(shop.id)}
    />
  ))}
</div>
```

### Data Structure

The component expects shop data in the `ShopWithDetails` format:

```typescript
interface ShopWithDetails extends RentalShop {
  cities: (City & {
    provinces: Province & {
      countries: Country | null
    } | null
  }) | null
  business_statuses: BusinessStatus | null
  rental_shop_inclusions: RentalShopInclusion[]
  rental_shop_tours: RentalShopTour[]
  rental_shop_service_locations: RentalShopServiceLocation[]
  motorcycle_count?: number
}
```

### Visual Elements

#### Status Badges
- **Verified**: Green badge with checkmark for verified businesses
- **Tours**: Blue badge indicating available tour packages
- **Delivery**: Gray badge for multiple service locations
- **Business Status**: Context-aware badge for pending/inactive shops

#### Star Rating
- Visual 5-star rating system with half-star precision
- Displays rating value and review count
- Accessible with proper ARIA labels

#### Contact Information
- Clickable phone numbers (tel: links)
- External website links with security attributes
- Icons from Heroicons for visual clarity

### Styling

The component uses Tailwind CSS classes and follows the design system:

- **Colors**: Gray scale with blue accents for interactive elements
- **Typography**: Consistent font weights and sizes across different layouts
- **Spacing**: Consistent padding and margins using Tailwind spacing scale
- **Hover Effects**: Smooth transitions with shadow and transform effects
- **Mobile First**: Responsive design starting from mobile layouts

### Accessibility

- **ARIA Labels**: Proper labeling for interactive elements
- **Keyboard Navigation**: All interactive elements are keyboard accessible
- **Screen Reader Support**: Semantic HTML structure with proper headings
- **Color Contrast**: Meets WCAG 2.1 AA standards
- **Focus Management**: Clear focus indicators for keyboard users

### Usage

The ShopCard component is used throughout the application to display rental shop listings in:
- Search results pages
- Browse/location pages
- Shop directory listings
- Related shops sections
- Comprehensive feature documentation

### Technical Notes

- **Performance**: Optimized for large lists with minimal re-renders
- **Memory**: Efficient state management for favorites and UI state
- **Bundle Size**: Uses tree-shakable imports from Heroicons
- **Dependencies**: Requires clsx for conditional styling, Heroicons for icons
- **Compatibility**: Works with existing database schema and service layer

### Future Enhancements

- **Image Gallery**: Shop photos and interior images
- **Real-time Availability**: Live motorcycle availability status
- **Price Ranges**: Display pricing information for different motorcycle categories
- **Reviews Preview**: Show recent customer reviews
- **Map Integration**: Embedded map view for shop location
- **Booking Integration**: Direct booking functionality
- **Social Sharing**: Enhanced share functionality with social media integration

## ShopDetails Component

The `ShopDetails` component provides a comprehensive view for individual shop detail pages with full information display and Google Maps integration.

### Features

- **Complete Shop Information**: Business name, description, status, and ratings
- **Contact Actions**: Direct phone calls and website links
- **Location Display**: Hierarchical location information with Google Maps
- **Service Information**: Inclusions, tours, and service locations
- **Available Motorcycles**: Grid display of shop's motorcycle inventory
- **Responsive Layout**: Two-column layout with sidebar on desktop
- **Quick Stats**: Summary panel with key metrics

### Props

```typescript
interface ShopDetailsProps {
  shop: ShopWithMotorcycles  // Shop data with motorcycle rentals included
}
```

### Usage

```tsx
import ShopDetails from '@/components/shop/ShopDetails'

<ShopDetails shop={shopWithMotorcycles} />
```

### Layout Structure

- **Header Section**: Shop name, status, location, rating, description
- **Main Content**: Inclusions, tours, service locations, motorcycles
- **Sidebar**: Google Maps, contact info, quick stats

## GoogleMap Component

The `GoogleMap` component provides Google Maps integration for displaying shop locations with fallback support.

### Features

- **Interactive Maps**: Google Maps JavaScript API integration when available
- **Fallback Display**: Attractive fallback when coordinates unavailable or API not loaded
- **External Links**: Direct links to Google Maps web interface
- **Directions**: Get directions functionality
- **Responsive Design**: Adapts to container size
- **Development Info**: Coordinate display in development mode

### Props

```typescript
interface GoogleMapProps {
  latitude?: number | null      // Shop latitude coordinate
  longitude?: number | null     // Shop longitude coordinate
  shopName: string             // Name for display and search
  address: string              // Full address text
  googleMapsUrl?: string | null // Direct Google Maps URL
  placeId?: string | null      // Google Places ID
  className?: string           // Additional CSS classes
}
```

### Usage

```tsx
import GoogleMap from '@/components/shop/GoogleMap'

<GoogleMap
  latitude={shop.latitude}
  longitude={shop.longitude}
  shopName={shop.provider_name}
  address={shop.full_address}
  googleMapsUrl={shop.google_maps_url}
  placeId={shop.place_id}
/>
```

### Map Integration

The component handles three scenarios:
1. **Full Integration**: Interactive map with custom markers when Google Maps API is available
2. **Fallback Mode**: Styled placeholder with shop information when no coordinates
3. **External Links**: Always provides links to Google Maps regardless of API status

### Google Maps Setup

For production use:
1. Add Google Maps API key to environment variables
2. Load Google Maps JavaScript API in your app
3. Configure allowed domains in Google Cloud Console

## Data Requirements

### ShopWithMotorcycles
Extended shop interface including:
- All ShopWithDetails fields
- `motorcycle_rentals`: Array of motorcycle rental data with brands and categories

## Styling Guidelines

All components follow the project's design system:
- **Consistent Spacing**: Tailwind spacing scale (4, 6, 8, etc.)
- **Typography**: Proper heading hierarchy and readable text sizes
- **Colors**: Gray scale base with blue accents for actions
- **Interactive States**: Hover, focus, and active states for all interactive elements
- **Mobile First**: Responsive design starting from mobile breakpoints

## Dependencies

- **React**: Hooks (useState, useEffect, useRef) for state management
- **Next.js**: Link component for internal navigation
- **Heroicons**: Consistent icon library
- **Tailwind CSS**: Utility-first styling
- **UI Components**: Card, Badge, Button from project UI library

## Accessibility Features

- **Semantic HTML**: Proper heading hierarchy and landmark elements
- **ARIA Labels**: Descriptive labels for screen readers
- **Keyboard Navigation**: All interactive elements keyboard accessible
- **Focus Management**: Clear focus indicators
- **Color Contrast**: WCAG 2.1 AA compliant color combinations 