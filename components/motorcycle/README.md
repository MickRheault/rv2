# Motorcycle Components

This directory contains reusable components related to motorcycle rental listings and details.

## Components

### MotorcycleCard.tsx
A card component for displaying motorcycle rental listings in grids and search results.

**Features:**
- Motorcycle image with placeholder fallback
- Brand, model, year, and engine capacity display
- Pricing information with currency formatting
- Rental shop details and rating
- Location information (city, province, country)
- Favorite toggle functionality
- Feature badges (ABS, GPS, Helmet, etc.)
- Responsive design for mobile and desktop

**Props:**
- `motorcycle`: MotorcycleWithDetails object
- `onFavoriteToggle?`: Optional callback for favorite actions

### MotorcycleGallery.tsx
An image gallery component for displaying motorcycle photos with navigation and zoom functionality.

**Features:**
- Main image display with navigation arrows
- Thumbnail strip for multiple images
- Click-to-navigate thumbnails
- Zoom modal with full-screen view
- Navigation within zoom modal
- Image counter display
- Responsive design with mobile touch support
- Graceful fallback for missing images

**Props:**
- `images`: Array of motorcycle images with id, url, and alt_text
- `motorcycleName`: String for accessibility labels

### MotorcycleDetails.tsx
A comprehensive details component for individual motorcycle rental pages.

**Features:**
- Motorcycle header with title, availability badge, and pricing
- Detailed specifications grid
- Features and inclusions with badges
- Rental conditions and requirements
- Rental shop information with contact details
- Quick action buttons (favorites, compare, share)
- Location display with hierarchy
- Rating display with review count
- Links to shop detail page

**Props:**
- `motorcycle`: MotorcycleWithDetails object

## Usage Examples

### Basic Motorcycle Card
```tsx
import MotorcycleCard from '@/components/motorcycle/MotorcycleCard'

<MotorcycleCard 
  motorcycle={motorcycleData}
  onFavoriteToggle={(id, isFavorited) => {
    // Handle favorite toggle
  }}
/>
```

### Image Gallery
```tsx
import MotorcycleGallery from '@/components/motorcycle/MotorcycleGallery'

<MotorcycleGallery 
  images={motorcycle.motorcycle_images}
  motorcycleName={`${motorcycle.brands?.name} ${motorcycle.model}`}
/>
```

### Motorcycle Detail Page
```tsx
import MotorcycleDetails from '@/components/motorcycle/MotorcycleDetails'

<MotorcycleDetails motorcycle={motorcycleData} />
```

## Data Structure

All components expect the `MotorcycleWithDetails` interface from `@/services/motorcycles`:

```typescript
interface MotorcycleWithDetails {
  // Basic motorcycle info
  id: string
  model: string
  year: number
  engine_capacity_cc: number
  rental_rate_per_day: number
  rental_rate_currency: string
  availability_status: string
  
  // Related data
  brands: Brand | null
  categories: Category | null
  rental_shops: RentalShop | null
  
  // Images and features
  motorcycle_images?: Array<{
    images: { id: string; url: string; alt_text: string | null }
    sort_order: number | null
  }>
  motorcycle_features?: Array<{
    features: { id: string; name: string; description: string | null }
  }>
  
  // Additional details
  specifications_details?: Json
  conditions_details?: Json
}
```

## Styling

Components use Tailwind CSS classes and follow the design system established in `@/components/ui`. Key styling features:

- Responsive grid layouts
- Hover and focus states
- Loading and error states
- Mobile-first approach
- Consistent spacing and typography
- Accessible color contrasts

## Dependencies

- Next.js Image component for optimized images
- Heroicons for consistent iconography
- UI components from `@/components/ui`
- Motorcycle service from `@/services/motorcycles`

### MotorcycleCard

Enhanced motorcycle listing card component with comprehensive features for displaying motorcycle rentals.

#### Features

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

#### Usage

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

#### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `motorcycle` | `MotorcycleWithDetails` | required | Motorcycle data with shop, brand, and feature details |
| `showShopInfo` | `boolean` | `true` | Display shop information and ratings |
| `showFeatures` | `boolean` | `true` | Show feature badges |
| `compact` | `boolean` | `false` | Use compact layout for dense grids |
| `onFavoriteToggle` | `function` | `undefined` | Callback for favorite button clicks |
| `isFavorited` | `boolean` | `false` | Current favorite state |
| `className` | `string` | `undefined` | Additional CSS classes |

#### Data Structure

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

#### Feature Icons

The component automatically selects appropriate icons based on feature names:

- **ABS/Brake features**: Shield icon
- **GPS/Navigation**: Map pin icon  
- **WiFi/Internet**: WiFi icon
- **Helmet**: Shield icon
- **Default**: Cog icon

#### Styling

The component uses Tailwind CSS with the following design system:

- **Colors**: Blue primary, gray neutrals, status colors
- **Spacing**: Consistent 4px grid system
- **Typography**: Font weight hierarchy for information
- **Shadows**: Elevation on hover for depth
- **Borders**: Subtle borders and rounded corners

#### Demo

Visit `/motorcycle-demo` to see the component in action with:
- Multiple motorcycle examples
- Grid and compact view modes
- Interactive features demonstration
- Feature documentation

#### Dependencies

- **Next.js**: Image optimization and routing
- **React**: Hooks for state management
- **Tailwind CSS**: Styling and responsive design
- **Heroicons**: Icon library
- **clsx**: Conditional class names
- **TypeScript**: Type safety

#### Performance Considerations

- Images are lazy-loaded with Next.js Image
- Responsive image sizes for different viewports
- Efficient re-renders with React hooks
- Optimized bundle size with tree-shaking
- Minimal DOM updates with conditional rendering

#### Accessibility

- Proper ARIA labels for interactive elements
- Keyboard navigation support
- Screen reader friendly structure
- High contrast color ratios
- Focus indicators for all interactive elements

#### Future Enhancements

- Virtual scrolling for large lists
- Advanced filtering integration
- Comparison mode selection
- Booking integration
- Social sharing implementation
- Advanced image zoom functionality 