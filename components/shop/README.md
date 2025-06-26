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

### Demo

Visit `/shop-demo` to see the ShopCard component in action with:
- Grid and compact view modes
- Interactive favorite toggles
- Various shop examples with different features
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