# Motorcycle Components

This directory contains components for displaying motorcycle rental information.

## MotorcycleCard

Enhanced motorcycle listing card component with comprehensive features for displaying motorcycle rentals.

### Features

#### Visual Enhancements
- **Image Gallery**: Multiple images with navigation controls and indicators
- **Hover Effects**: Smooth transitions and scale animations
- **Category Badges**: Color-coded category indicators
- **Availability Status**: Visual status indicators with color coding
- **Professional Design**: Gradient overlays and modern card styling
- **Responsive Images**: Optimized Next.js Image component with fallbacks

#### Interactive Features
- **Favorite Toggle**: Heart icon with animation for saving favorites
- **Share Functionality**: Share button (ready for implementation)
- **Image Carousel**: Navigate through multiple motorcycle images
- **Clickable Navigation**: Entire card links to motorcycle details
- **Compact Mode**: Dense layout option for grid views

#### Information Display
- **Smart Pricing**: Currency formatting with daily rates
- **Feature Badges**: Visual feature indicators with descriptive icons
- **Shop Information**: Ratings, reviews, and location details
- **Specifications**: Engine capacity, year, and availability
- **Feature Icons**: Context-aware icons for different features

#### Technical Features
- **TypeScript**: Full type safety with proper interfaces
- **Responsive Design**: Mobile-first approach with Tailwind CSS
- **Accessibility**: ARIA labels and keyboard navigation
- **Error Handling**: Graceful fallbacks for missing images
- **Performance**: Optimized with Next.js Image and lazy loading

### Usage

```tsx
import MotorcycleCard from '@/components/motorcycle/MotorcycleCard'

// Basic usage
<MotorcycleCard motorcycle={motorcycleData} />

// Full configuration
<MotorcycleCard
  motorcycle={motorcycleData}
  showShopInfo={true}
  showFeatures={true}
  compact={false}
  onFavoriteToggle={handleFavoriteToggle}
  isFavorited={favorites.has(motorcycle.id)}
  className="custom-styling"
/>
```

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `motorcycle` | `MotorcycleWithDetails` | required | Motorcycle data with shop, brand, and feature details |
| `showShopInfo` | `boolean` | `true` | Display shop information and ratings |
| `showFeatures` | `boolean` | `true` | Show feature badges |
| `compact` | `boolean` | `false` | Use compact layout for dense grids |
| `onFavoriteToggle` | `function` | `undefined` | Callback for favorite button clicks |
| `isFavorited` | `boolean` | `false` | Current favorite state |
| `className` | `string` | `undefined` | Additional CSS classes |

### Data Structure

The component expects motorcycle data in the following format:

```typescript
interface MotorcycleWithDetails {
  // Basic motorcycle info
  id: string
  model: string
  year?: number
  engine_capacity_cc?: number
  rental_rate_per_day?: number
  rental_rate_currency?: string
  availability_status?: string
  
  // Related data
  brands: { name: string } | null
  categories: { name: string } | null
  rental_shops: ShopWithLocation | null
  
  // Images (sorted by sort_order)
  motorcycle_images?: Array<{
    images: {
      url: string
      alt_text?: string
    }
  }>
  
  // Features
  motorcycle_features?: Array<{
    features: {
      name: string
      description?: string
    }
  }>
}
```

### Feature Icons

The component automatically selects appropriate icons based on feature names:

- **ABS/Brake features**: Shield icon
- **GPS/Navigation**: Map pin icon  
- **WiFi/Internet**: WiFi icon
- **Helmet**: Shield icon
- **Default**: Cog icon

### Styling

The component uses Tailwind CSS with the following design system:

- **Colors**: Blue primary, gray neutrals, status colors
- **Spacing**: Consistent 4px grid system
- **Typography**: Font weight hierarchy for information
- **Shadows**: Elevation on hover for depth
- **Borders**: Subtle borders and rounded corners

### Demo

Visit `/motorcycle-demo` to see the component in action with:
- Multiple motorcycle examples
- Grid and compact view modes
- Interactive features demonstration
- Feature documentation

### Dependencies

- **Next.js**: Image optimization and routing
- **React**: Hooks for state management
- **Tailwind CSS**: Styling and responsive design
- **Heroicons**: Icon library
- **clsx**: Conditional class names
- **TypeScript**: Type safety

### Performance Considerations

- Images are lazy-loaded with Next.js Image
- Responsive image sizes for different viewports
- Efficient re-renders with React hooks
- Optimized bundle size with tree-shaking
- Minimal DOM updates with conditional rendering

### Accessibility

- Proper ARIA labels for interactive elements
- Keyboard navigation support
- Screen reader friendly structure
- High contrast color ratios
- Focus indicators for all interactive elements

### Future Enhancements

- Virtual scrolling for large lists
- Advanced filtering integration
- Comparison mode selection
- Booking integration
- Social sharing implementation
- Advanced image zoom functionality 