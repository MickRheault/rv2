# Google Analytics 4 Setup Guide

This guide explains how to set up Google Analytics 4 tracking for the RideVault platform.

## 🚀 Quick Setup

1. **Create Google Analytics 4 Property**
   - Go to [Google Analytics](https://analytics.google.com)
   - Create a new GA4 property for your website
   - Note down your Measurement ID (format: `G-XXXXXXXXXX`)

2. **Update Environment Variables**
   ```bash
   # In your .env.local file
   NEXT_PUBLIC_GA4_TRACKING_ID=G-YOUR-ACTUAL-ID
   NEXT_PUBLIC_SITE_URL=https://your-domain.com
   ```

3. **Deploy and Test**
   - Deploy your application
   - Visit your website and accept cookies
   - Check Google Analytics Real-time reports to verify tracking

## 📊 What's Already Implemented

### Automatic Tracking
- ✅ **Page views** - Tracked automatically for all pages
- ✅ **Cookie consent** - GDPR-compliant consent banner
- ✅ **Privacy controls** - Users can opt-out of analytics

### Custom Events
The following events are automatically tracked when users interact with your site:

| Event | Description | Custom Parameters |
|-------|-------------|-------------------|
| `search` | User searches for motorcycles | `search_term`, `filters_applied` |
| `view_item` | User views motorcycle/shop details | `item_id`, `item_name`, `item_category` |
| `contact_shop` | User contacts a rental shop | `shop_id`, `contact_method` |
| `filter_applied` | User applies search filters | `filter_type`, `filter_value` |
| `location_search` | User searches by location | `search_location` |
| `add_to_favorites` | User adds item to favorites | `content_type`, `item_id` |
| `compare_items` | User compares motorcycles | `item_count`, `item_ids` |
| `share` | User shares content | `content_type`, `item_id`, `method` |

### Privacy Features
- **Cookie consent banner** with granular controls
- **Opt-out functionality** for analytics tracking
- **Privacy policy** with cookie information
- **LocalStorage-based** consent management

## 🔧 Adding Custom Tracking

To add custom event tracking in your components:

```tsx
import { trackEvents } from '@/lib/analytics';

// Track a search
trackEvents.search('honda motorcycle', { location: 'tokyo' });

// Track motorcycle view
trackEvents.viewMotorcycle('123', 'Honda', 'CBR600RR');

// Track shop contact
trackEvents.contactShop('shop-456', 'phone');
```

### Using the Analytics Hook

```tsx
import { useAnalytics } from '@/components/analytics/GoogleAnalytics';

function MyComponent() {
  const { canTrack } = useAnalytics();
  
  const handleAction = () => {
    if (canTrack) {
      // Only track if user has consented
      trackEvents.search('custom search');
    }
  };
}
```

## 🛡️ Privacy Compliance

The implementation includes:

- **Consent banner** shown to all new users
- **Granular controls** for different cookie types
- **Opt-out functionality** that stops all tracking
- **No tracking before consent** - GA4 only loads after user accepts
- **LocalStorage consent** - remembers user preferences

### Cookie Categories

1. **Functional** (Always enabled)
   - Essential site functionality
   - User authentication
   - Basic preferences

2. **Analytics** (Optional)
   - Google Analytics tracking
   - Usage statistics
   - Performance monitoring

3. **Marketing** (Optional)
   - Advertising cookies
   - Cross-site tracking
   - Personalized ads

## 🧪 Testing

### Local Testing
```bash
# Use placeholder ID for development
NEXT_PUBLIC_GA4_TRACKING_ID=G-PLACEHOLDER123
```

### Production Testing
1. Set real GA4 tracking ID
2. Visit website and accept cookies
3. Check Google Analytics Real-time reports
4. Verify custom events in GA4 Events report

## 📈 Recommended GA4 Setup

### Enhanced Ecommerce (Future)
When you're ready to track conversions:
- Set up conversion events in GA4
- Configure enhanced ecommerce for rental bookings
- Track revenue and booking funnel

### Audiences
Create audiences for:
- Motorcycle enthusiasts (frequent motorcycle viewers)
- Location-specific users
- Returning visitors
- High-engagement users

### Custom Dimensions
Consider adding custom dimensions for:
- User type (guest/registered)
- Preferred motorcycle categories
- Geographic regions
- Device preferences

## 🔗 Useful Links

- [Google Analytics 4 Documentation](https://developers.google.com/analytics/devguides/collection/ga4)
- [Next.js Third Parties Documentation](https://nextjs.org/docs/app/building-your-application/optimizing/third-party-libraries)
- [GA4 Events Reference](https://developers.google.com/analytics/devguides/collection/ga4/reference/events)