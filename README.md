# 🏍️ Global Moto Rentals - Worldwide Motorcycle Rental Platform

A comprehensive Next.js application for aggregating motorcycle rental businesses worldwide, built with TypeScript, Tailwind CSS, and Supabase.

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm
- A Supabase account and project
- Git

### Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd rv2
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   
   Create a `.env.local` file in the root directory with your Supabase credentials:
   
   ```env
   # Supabase Configuration
   NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
   
   # Optional: Service Role Key (for server-side operations)
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
   
   # Development Environment
   NODE_ENV=development
   ```
   
   **Where to find your Supabase credentials:**
   - Go to your [Supabase Dashboard](https://app.supabase.com)
   - Select your project
   - Navigate to **Settings** → **API**
   - Copy your **Project URL** and **anon/public key**

4. **Start the development server**
   ```bash
   npm run dev
   ```

   The application will be available at `http://localhost:3000` (or the next available port).

## 🏗️ Project Structure

```
rv2/
├── app/                    # Next.js 14 App Router
│   ├── globals.css        # Global styles with Tailwind CSS
│   ├── layout.tsx         # Root layout component
│   └── page.tsx           # Home page
├── lib/                   # Core library code
│   ├── supabase/          # Supabase configuration
│   │   ├── client.ts      # Supabase client setup
│   │   └── database.types.ts # TypeScript types from DB schema
│   └── utils/             # Utility functions
│       └── index.ts       # Common utilities (formatting, validation, etc.)
├── context/               # Existing data structures
│   ├── _lib/              # Legacy database types
│   ├── supabase/          # Migration files
│   └── data_template.json # Data import template
├── PRD/                   # Product Requirements Documents
├── tasks/                 # Development task lists
├── tailwind.config.js     # Tailwind CSS configuration
├── next.config.js         # Next.js configuration
└── tsconfig.json          # TypeScript configuration
```

### Additional Key Directories (Updated)

- `app/admin/*` – Admin dashboard pages (analytics, data freshness, premium listings, users, etc.)
- `app/search/*` – Client search UI (filters, results, location autocomplete)
- `app/[country]/*` and `app/[country]/[city]/*` – Location-based browsing pages
- `components/search/*` – Search components (`LocationAutocomplete`, `SearchFilters`, etc.)
- `components/shop/*` – Shop-related UI (`ShopCard`, `ShopDetails`, `GoogleMap`)
- `components/motorcycle/*` – Motorcycle UI (`MotorcycleCard`, `MotorcycleDetails`, `MotorcycleGallery`)
- `components/analytics/*` – Cookie consent banner and analytics helpers
- `supabase/migrations/*` – Database migrations (schema changes, analytics snapshots, premium listings, etc.)
- `supabase/functions/*` – Supabase Edge Functions (e.g., auth custom claims)

## 🗄️ Database Schema

The platform uses a comprehensive Supabase database with 19 tables for motorcycle rental data:

### Core Tables
- **`rental_shops`** - Rental business information
- **`motorcycle_rentals`** - Individual motorcycles available for rent
- **`brands`** - Motorcycle manufacturers
- **`categories`** - Motorcycle types (scooter, sport, touring, etc.)

### Location Hierarchy
- **`countries`** → **`provinces`** → **`cities`**

### Rich Metadata
- **`images`** - Motorcycle and shop photos
- **`features`** - Motorcycle features (ABS, GPS, etc.)
- **`insurance_types`** - Insurance options
- **`rental_rate_tiers`** - Pricing tiers by duration

### Relationships
- **`motorcycle_images`** - Image associations
- **`motorcycle_features`** - Feature associations  
- **`rental_shop_inclusions`** - What's included in rentals
- **`rental_shop_tours`** - Available tour packages

### Additional Tables (Updated)
- **`premium_listings` / related utils** – Premium placement and boosting
- **`business_statuses`** – Operational status codes for shops (active/closed)
- **`flagged_content`** – User flags for data accuracy with admin moderation
- **`analytics_*`** – Historical analytics snapshots and related functions

## 🛠️ Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run type-check` - Run TypeScript type checking

### Sitemap & SEO (Updated)
- `next-sitemap` runs on postbuild to generate sitemaps automatically
- Structured data helpers under `lib/seo/*` for enhanced SERP rich results

## 🎨 Styling & UI

- **Tailwind CSS** - Utility-first CSS framework
- **Mobile-first responsive design** - Optimized for all devices
- **Custom color palette** - Primary blue and accent green themes
- **Component utilities** - Pre-built button, card, and layout classes

### Custom Tailwind Classes
- `.btn-primary` / `.btn-secondary` - Button styles
- `.card` - Card component styling
- `.container-custom` - Responsive container
- `.grid-responsive` - Responsive grid layout

### Recent UI Updates
- Simplified homepage hero: location focus (removed style selector and counts)
- Replaced "Why Choose Global Moto Rentals" with concise copy; removed bottom CTA
- Header: “Countries” nav link, user icon links to admin login, removed Compare/Favorites from header
- MotorcycleCard: removed features list, availability pill, and share icon
- ShopCard: removed share icon
- Shop page: removed operational status badge, repositioned “Motorcycles Available” under header, added clearer spacing, removed quick stats
- Cookies page content added; cookie consent banner with preferences

## 📊 Key Features

### Current Implementation
- ✅ Next.js 14 with App Router and TypeScript
- ✅ Tailwind CSS with mobile-first responsive design
- ✅ Supabase integration with TypeScript types
- ✅ Comprehensive utility functions
- ✅ Database schema for motorcycle rental data

### Planned Features (See PRD)
- 🔄 Location-based search and filtering
- 🔄 Motorcycle listing and detail pages
- 🔄 Rental shop profiles
- 🔄 Price comparison and availability
- 🔄 User authentication and favorites
- 🔄 Admin interface for data moderation

### Implemented Features (Updated)
- Location-based search and filtering (countries → provinces → cities)
- Location directory browsing (`/browse`) with country/city links
- Dynamic location pages (`/{country}` and `/{country}/{city}`)
- Premium listings integration and prioritized sorting in search results
- Admin interface with analytics, premium listings, data freshness, flagged content, and users
- Cookie consent and preferences (analytics/marketing functional split)
- Sitemap generation and structured data for SEO

## 🧪 Development Workflow

1. **Check TypeScript** - `npm run type-check`
2. **Run tests** - `npm test` (when tests are added)
3. **Lint code** - `npm run lint`
4. **Build for production** - `npm run build`

## 🌍 Environment Configuration

### Development
The app is configured to work with fallback Supabase credentials for development, but you should set up your own `.env.local` file for the best experience.

### Production
Ensure all environment variables are properly configured in your deployment platform (Vercel, Netlify, etc.).

### Rendering & Caching Notes (Updated)
- The project currently does not use Incremental Static Regeneration (ISR). Admin routes and some pages are dynamic (`revalidate = 0`).
- You can opt-in per page by exporting `export const revalidate = <seconds>` or via `fetch(..., { next: { revalidate } })`.

### Required Environment Variables
```env
NEXT_PUBLIC_SUPABASE_URL=          # Your Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=     # Your Supabase anonymous key
```

### Optional Environment Variables
```env
SUPABASE_SERVICE_ROLE_KEY=         # For server-side operations
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=   # For maps integration
NEXT_PUBLIC_GA_TRACKING_ID=        # For Google Analytics
```

## 📝 Contributing

1. Follow the existing code style and conventions
2. Run type checking before committing
3. Test your changes thoroughly
4. Update documentation as needed

## 🚢 Deployment

The project is optimized for deployment on Vercel:

1. **Connect your repository** to Vercel
2. **Configure environment variables** in the Vercel dashboard
3. **Deploy** - Vercel will automatically build and deploy

### Additional Deployment Notes
- Security headers are configured in `next.config.js` (X-Frame-Options, X-Content-Type-Options, Referrer-Policy)
- Image domains whitelisted under `images.domains` (Unsplash, Supabase, etc.)
- Postbuild sitemap generation via `next-sitemap`

### Deployment Checklist
- [ ] Environment variables configured
- [ ] Supabase project is active
- [ ] Database migrations applied
- [ ] Build passes without errors
- [ ] TypeScript compilation successful

## 🔧 Technology Stack

- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Deployment**: Vercel (recommended)

## 📚 Useful Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [Project PRD](./PRD/prd-motorcycle-rental-aggregator.md)
- [Development Tasks (Updated)](./.PRD/tasks-prd-motorcycle-rental-aggregator.md)
- [Analytics Setup](./docs/ANALYTICS_SETUP.md)
- [SEO Implementation](./docs/SEO_IMPLEMENTATION.md)
- [Sitemap Setup](./docs/SITEMAP_SETUP.md)
- [Enhanced Structured Data](./docs/ENHANCED_STRUCTURED_DATA.md)

## 🤝 Support

If you encounter any issues:

1. Check the [development tasks](./tasks/tasks-prd-motorcycle-rental-aggregator.md) for current progress
2. Verify your environment variables are correct
3. Ensure your Supabase project is active and accessible
4. Run `npm run type-check` to identify TypeScript issues

---

**Built with ❤️ for motorcycle enthusiasts worldwide** 🏍️ 