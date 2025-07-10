## Relevant Files

- `package.json` - Project dependencies and scripts configuration (Created - Next.js scripts and dependencies)
- `next.config.js` - Next.js configuration for deployment and optimization (Created - Basic config with image optimization)
- `tailwind.config.js` - Tailwind CSS configuration for styling
- `tsconfig.json` - TypeScript configuration (Created - Next.js 14 TypeScript config with App Router)
- `.env.local` - Environment variables for Supabase and external services
- `app/layout.tsx` - Root layout component with global styles and providers (Created - Basic App Router layout)
- `app/page.tsx` - Home page component with search and featured listings (Created - Welcome page)
- `app/globals.css` - Global CSS styles for the application (Created - Basic global styles)
- `lib/supabase/client.ts` - Supabase client configuration (Created - Full client with auth helpers)
- `lib/supabase/database.types.ts` - Generated TypeScript types from Supabase (Created - Generated from live DB schema)
- `lib/utils/index.ts` - Utility functions for data processing and formatting (Created - Comprehensive utilities)
- `lib/utils/index.test.ts` - Unit tests for utility functions
- `app/layout.tsx` - Root layout component with global styles and providers
- `app/page.tsx` - Home page component with search and featured listings
- `app/search/page.tsx` - Search results page with filtering
- `app/motorcycle/[id]/page.tsx` - Individual motorcycle detail page
- `app/shop/[id]/page.tsx` - Rental shop detail page
- `app/compare/page.tsx` - Motorcycle comparison page
- `app/favorites/page.tsx` - User favorites page
- `app/admin/page.tsx` - Admin dashboard for content moderation (Updated - Real motorcycle and shop statistics, data management navigation)
- `app/admin/motorcycles/page.tsx` - Admin page for managing motorcycles with CRUD operations, conditions management, and rate tiers management (Created - Full CRUD interface with conditions modal and rate tiers modal)
- `app/admin/shops/page.tsx` - Admin page for managing rental shops with CRUD operations and conditions management (Created - Full CRUD interface with conditions modal)
- `app/admin/brands/page.tsx` - Admin page for managing motorcycle brands with CRUD operations (Created - Full CRUD interface)
- `app/admin/categories/page.tsx` - Admin page for managing motorcycle categories with CRUD operations (Created - Full CRUD interface)
- `app/admin/features/page.tsx` - Admin page for managing motorcycle features with CRUD operations (Created - Full CRUD interface)
- `app/admin/business-statuses/page.tsx` - Admin page for managing business statuses with CRUD operations (Created - Full CRUD interface)
- `components/ui/Button.tsx` - Reusable button component
- `components/ui/Button.test.tsx` - Unit tests for Button component
- `components/ui/Input.tsx` - Reusable input component
- `components/ui/Input.test.tsx` - Unit tests for Input component
- `components/ui/Modal.tsx` - Modal component for comparisons and flagging
- `components/search/SearchFilters.tsx` - Search filtering component
- `components/search/SearchFilters.test.tsx` - Unit tests for SearchFilters
- `components/search/LocationAutocomplete.tsx` - Location search autocomplete
- `components/search/LocationAutocomplete.test.tsx` - Unit tests for LocationAutocomplete
- `components/motorcycle/MotorcycleCard.tsx` - Motorcycle listing card component
- `components/motorcycle/MotorcycleCard.test.tsx` - Unit tests for MotorcycleCard
- `components/motorcycle/MotorcycleGallery.tsx` - Image gallery component
- `components/motorcycle/MotorcycleDetails.tsx` - Detailed motorcycle information with conditions display and rental rate tiers (Updated - Added database conditions and multiple rate tiers display)
- `components/shop/ShopCard.tsx` - Rental shop listing card
- `components/shop/ShopDetails.tsx` - Detailed shop information with Google Maps and conditions display (Updated - Added database conditions display)
- `components/shop/GoogleMap.tsx` - Google Maps integration component
- `components/common/Header.tsx` - Main navigation header
- `components/common/Footer.tsx` - Site footer
- `components/common/FlagButton.tsx` - Data flagging functionality
- `components/admin/FlaggedContentTable.tsx` - Admin table for managing flagged content
- `components/admin/MotorcycleConditionsModal.tsx` - Modal for managing motorcycle conditions with full CRUD operations (Created)
- `components/admin/RentalShopConditionsModal.tsx` - Modal for managing rental shop conditions with full CRUD operations (Created)
- `components/admin/RentalRateTiersModal.tsx` - Modal for managing rental rate tiers with full CRUD operations (Created)
- `components/admin/RentalShopToursModal.tsx` - Modal for managing rental shop tours with full CRUD operations (Created)
- `hooks/useAuth.ts` - Custom hook for authentication
- `hooks/useAuth.test.ts` - Unit tests for useAuth hook
- `hooks/useFavorites.ts` - Custom hook for favorites management
- `hooks/useSearch.ts` - Custom hook for search functionality
- `hooks/useSearch.test.ts` - Unit tests for useSearch hook
- `services/motorcycles.ts` - API service for motorcycle data (Updated - Added CRUD operations for admin, conditions support, and rental rate tiers support)
- `services/motorcycles.test.ts` - Unit tests for motorcycle service
- `services/shops.ts` - API service for rental shop data (Updated - Added CRUD operations for admin and conditions support)
- `services/brands.ts` - API service for motorcycle brands data with CRUD operations (Created - Full CRUD interface)
- `services/categories.ts` - API service for motorcycle categories data with CRUD operations (Created - Full CRUD interface)
- `services/features.ts` - API service for motorcycle features data with CRUD operations (Created - Full CRUD interface)
- `services/business-statuses.ts` - API service for business statuses data with CRUD operations (Created - Full CRUD interface)
- `services/motorcycle-conditions.ts` - API service for motorcycle conditions management with CRUD operations (Created - Full conditions management system)
- `services/rental-shop-conditions.ts` - API service for rental shop conditions management with CRUD operations (Created - Full conditions management system)
- `services/rental-rate-tiers.ts` - API service for rental rate tiers management with CRUD operations (Created - Full rate tiers management system)
- `services/rental-shop-tours.ts` - API service for rental shop tours management with CRUD operations (Created - Full tours management system)
- `services/locations.ts` - API service for location data
- `types/index.ts` - Custom TypeScript type definitions
- `app/api/motorcycles/route.ts` - API route for motorcycle data
- `app/api/shops/route.ts` - API route for shop data
- `app/api/search/route.ts` - API route for search functionality
- `app/api/flag/route.ts` - API route for content flagging

## Existing Database Schema & Data Structure

**IMPORTANT**: All development must be based on the existing Supabase database schema and data structure detailed below.

### Database Schema Reference
- **Source**: `context/_lib/database.types.ts` - Complete TypeScript types generated from existing Supabase schema
- **Data Template**: `context/data_template.json` - Structure of scraped data being imported into the system

### Key Database Tables & Relationships

#### **Location Hierarchy**
- `countries` (code, name) - Base country data
- `provinces` (id, name, country_code) - States/provinces within countries  
- `cities` (id, name, province_id) - Cities within provinces
- **Usage**: Location-based search and filtering using this 3-level hierarchy

#### **Business Data**
- `rental_shops` (id, provider_name, full_address, city_id, rating, review_count, etc.)
  - Links to cities via `city_id`
  - Contains Google Maps data (place_id, coordinates, google_maps_url)
  - Business status, contact info, and operational details
- `rental_shop_inclusions` - What's included with rentals (helmets, maps, etc.)
- `rental_shop_service_locations` - Pickup/dropoff locations
- `rental_shop_tours` - Tour packages offered by shops
- `rental_shop_conditions` - Rental terms and conditions per shop

#### **Motorcycle Data**
- `motorcycle_rentals` (id, brand_id, model, year, engine_capacity_cc, category_id, shop_id, etc.)
  - Core motorcycle information with pricing and availability
  - Links to rental_shops via `shop_id`
  - Contains JSON fields for specifications and conditions
- `brands` (id, name) - Motorcycle manufacturers
- `categories` (id, name, description) - Bike types (scooter, dirt bike, etc.)
- `features` (id, name, description) - Available features (ABS, GPS, etc.)

#### **Motorcycle Relationships**
- `motorcycle_features` - Many-to-many relationship between motorcycles and features
- `motorcycle_images` - Image galleries with sort order
- `motorcycle_conditions` - Condition details per motorcycle
- `motorcycle_required_documents` - Required documents per motorcycle
- `motorcycle_insurance_details` - Insurance options and coverage

#### **Pricing & Rates**
- `rental_rate_tiers` - Tiered pricing (daily, weekly, monthly rates)
- Built-in pricing in `motorcycle_rentals.rental_rate_per_day` and `rental_rate_currency`

#### **Support Tables**
- `condition_types` - Types of conditions/requirements
- `required_document_types` - Types of required documents
- `insurance_types` - Types of insurance coverage
- `business_statuses` - Business operational status codes
- `images` - Image storage with URLs and alt text

### Data Import Structure
The system receives data via the template in `context/data_template.json`:
- **Provider metadata**: Business details, location, ratings, conditions, tours
- **Motorcycle offerings**: Individual bike listings with specs, pricing, images, features

### Critical Implementation Notes
1. **No real-time data**: System is read-only, data updated via separate scraping process
2. **Location search**: Must use the countries → provinces → cities hierarchy
3. **Filtering**: Use existing brand, category, and feature relationships
4. **Pricing**: Support multiple currencies as stored in database
5. **Images**: Use Supabase Storage URLs from the images table
6. **Premium listings**: Business logic to be implemented for enhanced visibility

### Notes

- Unit tests should typically be placed alongside the code files they are testing (e.g., `MyComponent.tsx` and `MyComponent.test.tsx` in the same directory).
- Use `npx jest [optional/path/to/test/file]` to run tests. Running without a path executes all tests found by the Jest configuration.

## Tasks

- [ ] 1.0 Project Foundation & Setup
  - [x] 1.1 Initialize Next.js 14 project with TypeScript and App Router
  - [x] 1.2 Configure Tailwind CSS for mobile-first responsive design
  - [x] 1.3 Set up Supabase client configuration and environment variables
  - [x] 1.4 Generate TypeScript types from Supabase database schema
  - [x] 1.5 Configure Vercel deployment with automatic CI/CD from GitHub
  - [x] 1.6 Set up project structure with components, hooks, services, and utils directories
  - [x] 1.7 Install and configure essential dependencies (React Query/Zustand, Zod, etc.)
  - [x] 1.8 Set up Jest testing framework and basic test configuration1

- [ ] 2.0 Database Integration & Search Implementation
  - [x] 2.1 Create database service layer for motorcycle and shop queries
  - [x] 2.2 Implement location-based search using countries, provinces, and cities tables
  - [x] 2.3 Build structured filtering system for categories, brands, and models
  - [x] 2.4 Create price range and engine capacity filtering functionality
  - [x] 2.5 Implement feature-based filtering (ABS, GPS, helmets, etc.)
  - [x] 2.6 Add sorting functionality (price, rating, WITHOUT distance & relevance)
  - [x] 2.7 Create comprehensive search result display with pagination
  - [x] 2.8 Optimize database queries with proper indexing and caching
  - [x] 2.9 Implement pagination or infinite scroll for search results
  - [x] 2.10 Add search state management and URL parameter handling

- [x] 3.0 Core User Interface & Components
  - [x] 3.1 Create responsive layout components (Header, Footer, main layout)
  - [x] 3.2 Build reusable UI components (Button, Input, Modal, etc.)
  - [x] 3.3 Implement search filters component with collapsible panels
  - [x] 3.4 Create motorcycle listing card with image, specs, and pricing
  - [x] 3.5 Build rental shop card with location, rating, and contact info
  - [x] 3.6 Implement motorcycle detail page with image gallery and specifications
  - [x] 3.7 Create rental shop detail page with Google Maps integration
  - [x] 3.8 Build search results page with filtering and sorting
  - [x] 3.9 Implement responsive image galleries with zoom and swipe
  - [x] 3.10 Add premium listing badges and enhanced visibility features
  - [x] 3.11 Create loading states and error handling components
  - [x] 3.12 Implement mobile-first responsive design across all components

- [SKIP] 4.0 User Features & Authentication System
  - [SKIP] 4.1 Set up Supabase Auth with social providers (Google, GitHub)
  - [SKIP] 4.2 Create authentication components (login, signup, profile)
  - [SKIP] 4.3 Implement favorites system for motorcycles and rental shops
  - [SKIP] 4.4 Build favorites page with saved items management
  - [SKIP] 4.5 Create motorcycle comparison functionality (up to 3 items)
  - [SKIP] 4.6 Implement comparison page with side-by-side analysis
  - [SKIP] 4.7 Add data flagging system with category selection
  - [SKIP] 4.8 Create sharing functionality for listings (social, email, copy link)
  - [SKIP] 4.9 Implement user session management and protected routes
  - [SKIP] 4.10 Add user preferences and settings management

- [ ] 5.0 Admin Interface & Content Moderation
  - [x] 5.1 Create admin authentication and role-based access control
  - [x] 5.2.1 Add data flagging system with category selection
    [x] 5.2.2 Build admin dashboard with flagged content overview
  - [x] 5.3 Implement flagged content management table with actions
  - [x] 5.4 Add premium listing management system
  - [x] 5.5 Create data freshness tracking and indicators
  - [SKIP] 5.6 Implement admin notifications for new flags via Supabase Realtime
  - [x] 5.6.x Create a data management system to add, edit, delete the content.
  - [SKIP] 5.7 Add bulk actions for content moderation
  - [x] 5.8 Create admin reporting and analytics dashboard
    - [x] 5.8.1 Create analytics service to aggregate platform data
    - [x] 5.8.2 Build analytics dashboard page with key metrics
    - [x] 5.8.3 Add navigation link to the analytics dashboard from the main admin page
    - [x] 5.8.4 Test analytics dashboard and update documentation
    - [ ] 5.8.5 Implement historical analytics data storage
      - [x] 5.8.5.1 Design and create database schema for storing analytics snapshots
      - [x] 5.8.5.2 Create a scheduled job to capture and store daily analytics
      - [x] 5.8.5.3 Update analytics service to fetch and process historical data
      - [x] 5.8.5.4 (Optional) Visualize historical data on the analytics dashboard
  - [SKIP] 5.9 Implement content approval/rejection workflow
  - [ ] 5.10 Add admin user management functionality

- [ ] 6.0 Performance Optimization & SEO Implementation
  - [ ] 6.1 Configure Google Analytics 4 and Google Tag Manager
  - [ ] 6.2 Implement SEO meta tags and Open Graph for all pages
  - [ ] 6.3 Set up automatic sitemap generation with next-sitemap
  - [ ] 6.4 Add structured data markup for search engines
  - [ ] 6.5 Optimize images with Next.js Image component and WebP conversion
  - [ ] 6.6 Implement caching strategy with React Query and Vercel Edge
  - [ ] 6.7 Set up performance monitoring with Vercel Analytics
  - [ ] 6.8 Configure uptime monitoring with external service
  - [ ] 6.9 Implement error boundaries and graceful error handling
  - [ ] 6.10 Add internationalization framework preparation (next-intl)
  - [ ] 6.11 Optimize bundle size and implement code splitting
  - [ ] 6.12 Conduct performance audit and implement improvements 