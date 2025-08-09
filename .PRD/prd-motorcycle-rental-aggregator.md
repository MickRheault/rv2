# PRD: RideVault - Global Motorcycle Rental Aggregation Platform

## Introduction/Overview

RideVault is a comprehensive web-based platform that aggregates motorcycle rental businesses from around the world, providing travelers and motorcycle enthusiasts with a centralized place to discover, compare, and connect with rental providers. The platform addresses the current fragmentation in the motorcycle rental market where users must visit individual business websites to find available models, compare prices, and understand rental conditions.

The core value proposition is to provide users with information that is not available on Google Maps - specifically, which motorcycle models are available for rent, their specifications, pricing tiers, and rental conditions - all in one searchable, comparable interface.

**Technology Strategy**: This platform prioritizes rapid deployment using modern SaaS solutions and managed services to minimize development time and operational overhead while maximizing scalability and reliability. All data is sourced from a pre-populated Supabase database that is maintained through a separate data collection process.

## Goals

1. **Primary Goal**: Create the world's most comprehensive database of motorcycle rental businesses and their available inventory
2. **User Experience Goal**: Reduce the time users spend researching motorcycle rental options from hours to minutes
3. **Market Coverage Goal**: Achieve coverage of motorcycle rental businesses across major tourist destinations globally
4. **Engagement Goal**: Enable users to make informed rental decisions through detailed comparisons and comprehensive information
5. **Business Goal**: Establish a sustainable platform with basic monetization through premium listings
6. **Technical Goal**: Launch MVP within 3 months using modern SaaS architecture for rapid iteration and scaling

## User Stories

### Tourist/Traveler Stories
- **As a tourist planning a trip**, I want to search for motorcycle rentals in my destination city so that I can see all available options in one place
- **As a budget-conscious traveler**, I want to compare rental prices across different shops and rental periods so that I can find the best deal
- **As an adventure traveler**, I want to filter motorcycles by category (off-road, touring, sport) so that I can find bikes suitable for my planned activities

### Motorcycle Enthusiast Stories
- **As a motorcycle enthusiast**, I want to browse motorcycle rentals by brand and model in different locations so that I can find my preferred bike during my travels
- **As an experienced rider**, I want to see detailed specifications and features of available motorcycles so that I can choose the right bike for my skill level and preferences
- **As a frequent renter**, I want to save my favorite rental shops and motorcycles so that I can quickly access them for future trips

### Practical User Stories
- **As a user**, I want to understand rental requirements (documents, insurance) upfront so that I can prepare accordingly
- **As a user**, I want to see contact information and location details for rental shops so that I can easily reach out and visit them
- **As a user planning a longer trip**, I want to see tiered pricing for different rental durations so that I can budget accurately
- **As a user**, I want to flag incorrect or outdated information so that the platform maintains data accuracy

## Functional Requirements

### Core Search & Discovery
1. The system must allow users to search for motorcycle rentals by country, province/state, and city using database-stored location data
2. The system must provide filtering by motorcycle category (scooter, dirt bike, off-road, touring, sport, cruiser)
3. The system must allow filtering by motorcycle brand using dropdown selection
4. The system must allow filtering by motorcycle model using dropdown selection
5. The system must provide price range filtering with support for multiple currencies
6. The system must allow filtering by engine capacity (CC ranges)
7. The system must provide filtering by motorcycle features (ABS, GPS, helmets included, etc.)
8. The system must allow sorting results by price, rating, distance, and relevance

### Motorcycle Listings & Details
9. The system must display motorcycle details including brand, model, year, engine capacity, and category
10. The system must show multiple high-quality images for each motorcycle
11. The system must display detailed specifications and features for each motorcycle
12. The system must show tiered pricing structure (daily, weekly, monthly rates) in original currency
13. The system must display rental conditions and requirements
14. The system must show required documents for each rental
15. The system must display insurance options and coverage details

### Rental Shop Information
16. The system must display comprehensive rental shop information (name, address, contact details)
17. The system must show Google Maps integration with shop locations using stored coordinates
18. The system must display shop ratings and review counts from stored Google data
19. The system must show business hours and availability status
20. The system must display additional services offered (tours, delivery, etc.)
21. The system must show rental inclusions (helmets, maps, maintenance, etc.)

### Premium Features
22. The system must display premium listings at the top of search results
23. The system must show premium badges on featured rental shops
24. The system must provide enhanced visibility for premium listings in all relevant searches

### User Experience Features
25. The system must provide a responsive, mobile-first web interface
26. The system must allow users to save favorite motorcycles and rental shops
27. The system must provide side-by-side comparison of up to 3 motorcycles or rental shops
28. The system must offer quick contact options (call, email, website link)
29. The system must provide sharing functionality for listings
30. The system must support internationalization framework with English as primary language
31. The system must provide user flagging functionality for incorrect data

### Data Quality & Moderation
32. The system must include "Flag Incorrect Data" buttons on all listings
33. The system must collect user feedback on data accuracy issues
34. The system must provide admin interface for managing flagged content
35. The system must track and display data freshness indicators

### Search & Performance
36. The system must provide location autocomplete using database location data
37. The system must return search results within 2 seconds
38. The system must support multiple simultaneous filters
39. The system must provide search result pagination or infinite scroll
40. The system must maintain search state when users navigate back from detail pages

## Non-Goals (Out of Scope)

1. **No Online Booking**: The platform will not handle reservations, payments, or booking transactions
2. **No User Reviews**: The platform will not collect or manage user-generated reviews (using stored Google ratings only)
3. **No Inventory Management**: Real-time availability tracking is not included in v1
4. **No Currency Conversion**: Price display will be in original rental shop currency only
5. **No Mobile App**: Native mobile applications are not in scope for v1
6. **No Rental Agreement Management**: Document signing and agreement processing are not included
7. **No Customer Support**: Direct customer service for rental issues is not provided
8. **No Data Scraping**: The data collection and web scraping functionality is out of scope
9. **No Multi-language Content**: Only English interface for v1 (though i18n framework will be ready)
10. **No Custom Infrastructure**: No self-hosted databases, servers, or complex DevOps setup
11. **No External Search APIs**: No Google Places API, Algolia, or external search services
12. **No Full-Text Search**: No text-based search functionality for initial release

## Design Considerations

### Mobile-First Approach
- Responsive design optimized for mobile devices (320px-768px)
- Touch-friendly interface elements with appropriate spacing
- Simplified navigation suitable for small screens
- Fast-loading images with progressive enhancement

### Visual Design
- Clean, modern interface that emphasizes motorcycle imagery
- Clear information hierarchy prioritizing key details (location, bike type, price)
- Consistent color scheme and typography throughout the platform
- Intuitive iconography for features, categories, and actions
- Premium badges and visual indicators for featured listings

### User Interface Components
- Interactive map integration for geographical search using stored coordinates
- Image galleries with zoom and swipe functionality
- Collapsible filter panels for structured filtering options
- Quick action buttons for contact, sharing, and flagging
- Comparison tables for side-by-side analysis
- Data flagging interface with category selection

## Technical Considerations - SaaS-First Architecture

### Core Technology Stack (Recommended)
- **Frontend Framework**: Next.js 14 with App Router for optimal performance and SEO
- **Hosting & Deployment**: Vercel for seamless CI/CD and global edge deployment
- **Database**: Supabase (PostgreSQL) with existing schema - already implemented
- **Authentication**: Supabase Auth for user management (favorites, flagging)
- **File Storage**: Supabase Storage for motorcycle images and assets
- **Styling**: Tailwind CSS for rapid UI development
- **State Management**: Zustand or React Query for client-side state

### Essential SaaS Services for Rapid Deployment

#### **Search & Discovery**
- **Primary Search**: Database-driven filtering using structured queries
- **Location Search**: Database queries using countries, provinces, and cities tables
- **Autocomplete**: Built using database queries on location hierarchy
- **Maps Integration**: Google Maps JavaScript API for displaying shop locations (display only)

#### **Performance & Monitoring**
- **Analytics**: Google Analytics 4 via Google Tag Manager
- **Performance Monitoring**: Vercel Analytics + Web Vitals
- **Uptime Monitoring**: Uptime Robot or Pingdom

#### **Image & Media Management**
- **Image Optimization**: Vercel Image Optimization (built-in)
- **CDN**: Vercel Edge Network (automatic)
- **Image Processing**: Supabase Storage with automatic transforms
- **Placeholder Images**: Default placeholder for missing motorcycle images

#### **Communication & Notifications**
- **Email Service**: Resend or SendGrid for transactional emails
- **Admin Notifications**: Supabase Realtime for flagged content alerts
- **Contact Forms**: Formspree or Netlify Forms for user inquiries

#### **SEO & Marketing**
- **SEO Optimization**: Built-in Next.js SEO features
- **Sitemap Generation**: next-sitemap for automated sitemap creation
- **Meta Tags**: next-seo for dynamic meta tag management
- **Social Sharing**: Open Graph and Twitter Card integration

#### **Development & Deployment**
- **Version Control**: GitHub with Vercel integration
- **CI/CD**: Vercel automatic deployments
- **Environment Management**: Vercel Environment Variables
- **Database Migrations**: Supabase Migration system
- **Type Safety**: TypeScript with Supabase generated types

### Database Architecture & Search Implementation

#### **Location-Based Search**
- Utilize existing `countries`, `provinces`, and `cities` tables for location hierarchy
- Implement database views for efficient location-based queries
- Create indexes on location relationships for fast filtering
- Build autocomplete using exact matches on location names

#### **Structured Filtering**
- Use dropdown selections for brands and models (exact matches)
- Implement category filtering using predefined categories
- Build price range filtering using numerical comparisons
- Create engine capacity filtering using CC ranges

#### **Advanced Filtering**
- Leverage existing database relationships for complex filtering
- Implement efficient queries using JOIN operations
- Use database functions for price range calculations
- Create optimized views for popular filter combinations

### Database Optimization (Supabase)
- Leverage existing database schema and relationships
- Implement database indexes for location-based queries
- Create indexes on frequently filtered columns (brand, category, price)
- Use Supabase Row Level Security (RLS) for data protection
- Implement database functions for complex filtering logic
- Set up database triggers for data consistency
- Create optimized views for search results

### Internationalization Framework
- **i18n Library**: next-intl for Next.js internationalization
- **Translation Management**: Consider Crowdin or Phrase for future translations
- **Content Structure**: Prepare JSON files for easy translation
- **URL Structure**: Implement subdomain or path-based locale routing

### Performance Requirements
- **Image Optimization**: Automatic WebP conversion via Vercel
- **Caching Strategy**: Vercel Edge Caching + React Query for client-side caching
- **Database Query Optimization**: Efficient indexing and query patterns
- **Code Splitting**: Next.js automatic code splitting
- **Bundle Analysis**: @next/bundle-analyzer for optimization

### Data Management Strategy
- **Data Source**: Pre-populated Supabase database (maintained separately)
- **Data Validation**: Zod for runtime type validation
- **Backup Strategy**: Supabase automatic backups
- **Read-Only Operations**: Platform primarily reads from existing data

### Security & Compliance
- **Authentication**: Supabase Auth with social providers
- **API Security**: Supabase RLS policies
- **HTTPS**: Automatic via Vercel
- **Environment Variables**: Secure storage via Vercel
- **GDPR Compliance**: Cookie consent via CookieYes or similar

## Implementation Timeline with SaaS Tools

### Week 1-2: Foundation Setup
- Set up Next.js project with TypeScript
- Configure Supabase connection and generate types
- Set up Vercel deployment pipeline
- Implement basic UI components with Tailwind CSS

### Week 3-4: Core Search & Filtering
- Implement database-driven location filtering using existing tables
- Build structured filtering system (dropdowns for brands/models, categories)
- Create motorcycle and rental shop listing components
- Set up Google Maps integration for display (coordinates from database)

### Week 5-6: User Experience Features
- Implement favorites system with Supabase Auth
- Build comparison functionality
- Add data flagging system
- Implement image galleries with optimization

### Week 7-8: Performance & SEO
- Optimize database queries and add necessary indexes
- Implement SEO features and structured data
- Set up analytics and monitoring
- Add error handling and loading states

### Week 9-10: Admin Features & Polish
- Build admin interface for flagged content
- Implement premium listing system
- Add final UI polish and mobile optimization
- Conduct testing and bug fixes

### Week 11-12: Launch Preparation
- Performance optimization and monitoring setup
- SEO audit and implementation
- Security review and testing
- Soft launch and feedback collection

## Success Metrics

### User Engagement Metrics
- **Time on Site**: Target average session duration of 5+ minutes
- **Pages per Session**: Target 4+ pages viewed per session
- **Bounce Rate**: Maintain bounce rate below 60%
- **Filter Usage Rate**: 70%+ of users utilize at least one filter

### Business Metrics
- **Monthly Active Users**: Track growth in unique monthly visitors
- **Conversion to Contact**: Measure clicks to rental shop contact information
- **Geographic Coverage**: Track number of cities and countries with active listings
- **Inventory Growth**: Monitor growth in number of motorcycles and rental shops
- **Premium Listing Performance**: Track engagement and conversion rates for premium vs standard listings

### Data Quality Metrics
- **Flag Response Rate**: Time to resolve flagged content issues
- **Data Accuracy Score**: User satisfaction with information accuracy
- **Content Freshness**: Percentage of listings updated within refresh cycles

### Technical Performance Metrics
- **Page Load Time**: Maintain average load time under 3 seconds (monitored via Vercel Analytics)
- **Search Response Time**: Keep filtered results under 2 seconds
- **Mobile Performance**: Achieve Google PageSpeed score of 90+ on mobile
- **Uptime**: Maintain 99.9% platform availability (monitored via Uptime Robot)

## Cost Structure (Monthly Estimates)

### Essential SaaS Costs
- **Vercel Pro**: $20/month (includes analytics and enhanced features)
- **Supabase Pro**: $25/month (includes additional database capacity)
- **Google Maps API**: $50-200/month (display only, much lower usage than search)
- **Domain & SSL**: $15/month
- **Email Service**: $10-20/month

**Total Monthly SaaS Costs**: ~$120-280/month for initial scale

### Scaling Considerations
- Most services offer usage-based pricing that scales with growth
- Vercel and Supabase provide generous free tiers for development
- Google Maps costs significantly reduced since only used for display
- Consider Enterprise plans when reaching significant scale

## Phase 1 Extension: Location-Based Shop Listings

### Introduction/Overview

This extension adds dedicated listing pages for rental shops organized by geographic location. Users will be able to browse all rental shops within a specific country or city through simple, clean URLs like `/canada/` and `/canada/montreal/`. This feature enhances discoverability by providing direct access to location-based shop listings without requiring search filters.

The implementation prioritizes simplicity and reuses existing components and services to minimize development time while providing valuable location-based navigation for users.

### Goals

1. **Location Discovery Goal**: Enable users to easily browse all rental shops in a specific country or city
2. **SEO Enhancement Goal**: Create location-specific landing pages to improve search engine visibility
3. **User Navigation Goal**: Provide an alternative browsing method complementary to the existing search functionality
4. **Implementation Goal**: Deliver a simple, maintainable solution that reuses existing components and services

### User Stories

#### Location Browsing Stories
- **As a traveler planning a trip to Canada**, I want to visit `/canada/` to see all rental shops available in the country so that I can get an overview of options
- **As a user interested in Montreal**, I want to visit `/canada/montreal/` to see all rental shops in that specific city so that I can focus on local options
- **As a user browsing shop listings**, I want to click through to individual shop detail pages so that I can get more information about specific rental providers

#### Navigation Stories
- **As a user on a country page**, I want to access the main search functionality so that I can search for specific motorcycles in that location
- **As a user viewing shops in a city**, I want to see the same shop information I would see in search results so that the experience is consistent

### Functional Requirements

#### URL Structure & Routing
1. The system must provide country listing pages accessible via `/{country}/` URLs (e.g., `/canada/`, `/thailand/`)
2. The system must provide city listing pages accessible via `/{country}/{city}/` URLs (e.g., `/canada/montreal/`, `/thailand/bangkok/`)
3. The system must use lowercase country and city names in URLs for consistency
4. The system must handle URL routing using Next.js dynamic routes with the existing App Router structure

#### Page Content & Display
5. Country pages must display a page title indicating the country name (e.g., "Motorcycle Rental Shops in Canada")
6. City pages must display a page title indicating both city and country (e.g., "Motorcycle Rental Shops in Montreal, Canada")
7. Both page types must display all rental shops using the existing shop card component from search results
8. Shop cards must include the same information as search results: shop name, address, rating, contact details, and premium badges if applicable

#### Data & Performance
9. The system must reuse existing shop data services and components without creating new database queries or services
10. The system must display all shops for the location on a single page without pagination or infinite scroll
11. The system must load and display shop data within 3 seconds for reasonable numbers of shops per location

#### Integration & Navigation
12. Both country and city pages must include a link or button to access the main search functionality for that location
13. Shop cards must link to existing individual shop detail pages using the current URL structure
14. The system must maintain the existing shop card layout and styling for consistency

### Non-Goals (Out of Scope)

1. **No Filtering Options**: Location pages will not include filtering by price, rating, or other criteria
2. **No Sorting Controls**: Pages will display shops in default database order without user-controlled sorting
3. **No Pagination**: All shops will be displayed on a single page regardless of quantity
4. **No Breadcrumb Navigation**: Simple page titles without breadcrumb components
5. **No Maps Integration**: Location pages will not include map displays
6. **No Advanced SEO**: Basic meta tags only, no complex structured data for these pages
7. **No Custom Database Queries**: No new database functions, materialized views, or complex SQL optimizations
8. **No URL Variations**: No support for alternate URL formats or case variations

### Technical Considerations

#### Implementation Approach
- **Route Structure**: Use Next.js App Router with dynamic routes `[country]/page.tsx` and `[country]/[city]/page.tsx`
- **Data Fetching**: Leverage existing shop services and database queries filtered by location
- **Component Reuse**: Utilize existing `ShopCard` components and layout patterns from search results
- **Database Queries**: Simple location-based filtering using existing country/city relationships

#### Database Integration
- **Location Lookup**: Use existing `countries`, `provinces`, and `cities` tables to validate and resolve location parameters
- **Shop Filtering**: Filter `rental_shops` by `city_id` for city pages, aggregate by country for country pages
- **Performance**: Rely on existing database indexes without additional optimization

#### SEO & Metadata
- **Page Titles**: Dynamic titles based on location (e.g., "Motorcycle Rental Shops in [Location]")
- **Meta Descriptions**: Basic descriptions indicating the location and shop count
- **URL Structure**: Clean, SEO-friendly URLs following the specified pattern

#### Error Handling
- **Invalid Locations**: Return 404 for non-existent countries or cities
- **Empty Results**: Display appropriate message when no shops exist in a location
- **Graceful Degradation**: Maintain functionality even if some shop data is missing

### Success Metrics

#### User Engagement Metrics
- **Page Views**: Track visits to country and city listing pages
- **Click-Through Rate**: Measure clicks from location pages to individual shop detail pages
- **Time on Location Pages**: Monitor user engagement time on country/city listing pages
- **Search Conversion**: Track users who navigate from location pages to main search functionality

#### SEO Metrics
- **Search Engine Indexing**: Monitor indexing of new location-based URLs
- **Organic Traffic**: Track organic search traffic to location pages
- **Location-Based Keywords**: Monitor ranking for location + "motorcycle rental" keyword combinations

#### Technical Metrics
- **Page Load Performance**: Maintain sub-3-second load times for location pages
- **Database Performance**: Ensure location-based queries don't impact overall system performance
- **Error Rates**: Monitor 404 rates and other errors on location pages

---

## Phase 1 Extension: Admin-Configurable ShopCard Display (Keep It Simple)

### Introduction/Overview

Provide an admin UX to configure which information blocks are shown on the `ShopCard` component across the site. This enables non-developers to tailor what data appears on listing cards without code changes. Defaults match the current `ShopCard` presentation. Emphasis: smallest possible surface area, minimal schema, zero new dependencies, and straightforward UI.

### Goals

1. **Operational Goal**: Allow admins to toggle `ShopCard` sections on/off globally.
2. **UX Consistency Goal**: Default configuration mirrors the current `ShopCard` layout and content.
3. **Simplicity Goal**: Ship a single, global configuration with a clean UI and minimal backend changes (no per-shop/per-page overrides, no advanced layout controls).

### Simplicity Principles

- Single toggle set applied platform-wide (no environment-specific or scope-specific variants)
- One small settings table, one admin page, one fetch path; prefer defaults when in doubt
- No reordering, renaming, or custom copy—toggles only (on/off)
- No new libraries or infrastructure; reuse current auth, UI, and data layer
- Fail-safe: if settings unavailable, render with current defaults

### Baseline (Current ShopCard Sections)

The following sections are the baseline toggles (current defaults = ON unless naturally absent in data):
- Premium badge (gold/platinum/featured)
- Verification/status badges (e.g., verified/active)
- Rating and review count
- Location (city, province)
- Business description (short)
- Contact info: phone, website
- Services summary: tours, delivery
- Inclusions (first 3 with “+N more”)
- Bike types (categories) pills
- CTAs: “View Details”, “Browse Bikes”

### Functional Requirements

1. Admin page: `Admin → Display Settings` at `/admin/display-settings` with simple toggle switches for each section above.
2. Each toggle updates a single global configuration used by all `ShopCard` instances (country/city pages and elsewhere).
3. Provide “Reset to Defaults” action that restores the baseline configuration.
4. Restrict access to users with `admin` role (reuse existing admin auth/RBAC).
5. Changes take effect without redeploy; config is read at render time.
6. Optional inline preview that shows a basic `ShopCard` sample reflecting current toggles (use mock data; no live coupling). If preview fails, do not block saving.
7. If a section is toggled ON but the data is missing for a specific shop, the section remains hidden for that shop (no empty placeholders).

### Non-Goals (Out of Scope)

1. Per-shop overrides and per-page overrides (global only in v1)
2. Scheduling or time-based configurations
3. A/B testing or multi-variant experiments
4. Complex role-based variations beyond admin-only management

### Technical Considerations (Minimalist)

- Data Model: Minimal settings table (single row) e.g., `shop_card_display_settings` with boolean columns:
  - `show_premium_badge`, `show_verification_badge`, `show_rating`, `show_location`,
    `show_description`, `show_contact_phone`, `show_contact_website`, `show_services`,
    `show_inclusions`, `show_bike_types`, `show_cta_view_details`, `show_cta_browse_bikes`.
- Access Control: RLS policies allow read for `anon`/`authenticated`, write for `admin` only.
- Fetching: Add `settingsService` with `getShopCardSettings` and `updateShopCardSettings`.
  - Server-side pages (e.g., country/city listings) fetch settings once and pass to child components.
  - Add short TTL caching (e.g., 5 minutes) with graceful fallback to defaults on error.
- UI Integration: `ShopCard` accepts a `display` prop (set of booleans). Listing pages pass the resolved config to each card; `ShopCard` conditionally renders sections based on these flags.
- Performance: Single settings read per request (not per card). No N+1 calls.
- No New Dependencies: Reuse existing stack and admin shell.
\- Migration impact: one table, one RLS policy block; keep SQL concise

### Error Handling

- If settings cannot be fetched, use the baseline defaults and log a warning in the admin console.
- Validation ensures only known keys/booleans are persisted.

### Success Metrics

- Admins can modify `ShopCard` presentation without code changes.
- Changes are reflected immediately across listing pages.
- No noticeable performance regressions (settings fetch < 10ms cached, negligible render overhead).

---

## Future Enhancements (Post-Initial Release)

### Phase 2 Features
- **Full-Text Search**: Implement PostgreSQL full-text search for motorcycle models and descriptions
- **Advanced Search**: Add text-based search across all motorcycle and rental shop data
- **Search Analytics**: Track popular search terms and improve filtering
- **Elasticsearch Integration**: Consider for advanced search capabilities if needed

---

*This PRD emphasizes a simplified, structured approach for the initial release, focusing on dropdown-based filtering and location search without full-text search complexity. This enables faster development while maintaining core functionality for users to discover and filter motorcycle rentals effectively.*