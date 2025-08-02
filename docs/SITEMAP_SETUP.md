# Sitemap Generation Guide

This document explains the automatic sitemap generation setup for the RideVault platform using `next-sitemap`.

## 🎯 **Overview**

Our sitemap implementation provides:
- ✅ **Automatic generation** of XML sitemaps
- ✅ **Dynamic content inclusion** from database
- ✅ **SEO-optimized priorities** and change frequencies  
- ✅ **Robots.txt generation** with proper directives
- ✅ **Build integration** for automatic updates

## 📁 **Generated Files**

After running `npm run build` or `npm run sitemap`, the following files are created in `/public`:

```
public/
├── sitemap.xml        # Main sitemap index
├── sitemap-0.xml      # URLs sitemap 
└── robots.txt         # Search engine directives
```

## ⚙️ **Configuration**

The sitemap is configured in `next-sitemap.config.js`:

### **Static Configuration**
```javascript
module.exports = {
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
  generateRobotsTxt: true,
  sitemapSize: 7000,
  changefreq: 'daily',
  priority: 0.7,
  exclude: ['/admin', '/admin/*', '/api/*', '/auth/*'],
}
```

### **Dynamic Routes**
The configuration automatically fetches and includes:

- **Motorcycle Pages** (`/motorcycle/[id]`)
  - Priority: 0.9 (high)
  - Change frequency: weekly
  - Last modified: From database `updated_at`

- **Shop Pages** (`/shop/[slug]`)
  - Priority: 0.9 (high) 
  - Change frequency: weekly
  - Last modified: From database `updated_at`

- **Search Pages** (`/search`, `/browse`)
  - Priority: 0.8 (high)
  - Change frequency: daily

## 📊 **Priority Mapping**

| Page Type | Priority | Change Freq | Description |
|-----------|----------|-------------|-------------|
| Homepage (/) | 1.0 | daily | Highest priority |
| Motorcycles | 0.9 | weekly | High-value content |
| Shops | 0.9 | weekly | High-value content |
| Search/Browse | 0.8 | daily | Discovery pages |
| Info Pages | 0.6 | monthly | About, Contact, Help |
| Legal Pages | 0.3 | yearly | Privacy, Terms |

## 🚫 **Excluded Routes**

The following routes are excluded from sitemaps:

- `/admin` and `/admin/*` - Administrative interface
- `/api/*` - API endpoints
- `/auth/*` - Authentication pages
- `/test-*` - Development/testing pages
- `/_next/*` - Next.js internal files

## 🤖 **Robots.txt**

Auto-generated `robots.txt` includes:

```txt
User-agent: *
Allow: /
Disallow: /admin
Disallow: /admin/*
Disallow: /api/*
Disallow: /auth/*
Disallow: /test-*
Disallow: /_next/*

Host: https://yourdomain.com
Sitemap: https://yourdomain.com/sitemap.xml
```

## 🔄 **Build Integration**

Sitemap generation is integrated into the build process:

```json
{
  "scripts": {
    "build": "next build",
    "sitemap": "next-sitemap",
    "postbuild": "next-sitemap"
  }
}
```

- **Development**: Run `npm run sitemap` to generate manually
- **Production**: Automatically runs after `npm run build`
- **Deployment**: Vercel/Netlify will include generated files

## 📈 **Benefits for SEO**

1. **Discoverability**: Search engines can easily find all pages
2. **Crawl Efficiency**: Prioritized crawling based on importance
3. **Fresh Content**: Last-modified dates help with indexing
4. **Geographic SEO**: Dynamic routes include location-based pages
5. **Category Coverage**: All motorcycle/shop categories indexed

## 🛠 **Customization**

### Adding New Static Routes
```javascript
// In next-sitemap.config.js transform function
if (path === '/new-page') {
  return {
    loc: path,
    changefreq: 'monthly',
    priority: 0.6,
    lastmod: new Date().toISOString(),
  }
}
```

### Modifying Dynamic Route Logic
```javascript
// In additionalPaths function
const { data: newContent } = await supabase
  .from('new_table')
  .select('slug, updated_at')

newContent.forEach(item => {
  additionalPaths.push({
    loc: `/new-content/${item.slug}`,
    changefreq: 'weekly',
    priority: 0.8,
    lastmod: item.updated_at,
  })
})
```

### Environment Variables
Ensure these are set for proper sitemap generation:

```bash
# Required
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SITE_URL=https://yourdomain.com

# Optional (improves performance)
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

## 🧪 **Testing**

### Local Testing
```bash
# Generate sitemap locally
npm run sitemap

# Check generated files
ls -la public/sitemap*
cat public/robots.txt
```

### Validation
1. **XML Validation**: Check sitemap syntax at [XML Sitemap Validator](https://www.xml-sitemaps.com/validate-xml-sitemap.html)
2. **Google Search Console**: Submit sitemap at `https://yourdomain.com/sitemap.xml`
3. **Robots.txt Tester**: Use Google Search Console robots.txt tester

### Production Verification
```bash
# Check sitemap accessibility
curl https://yourdomain.com/sitemap.xml
curl https://yourdomain.com/robots.txt

# Verify dynamic content inclusion
grep "motorcycle" public/sitemap-0.xml
grep "shop" public/sitemap-0.xml
```

## 📝 **Maintenance**

- **Automatic**: Sitemap regenerates on every build
- **Manual**: Run `npm run sitemap` to update manually  
- **Monitoring**: Check Google Search Console for crawl errors
- **Updates**: Add new route patterns when adding new content types

## 🚀 **Production Deployment**

The sitemap will automatically work in production when:

1. `NEXT_PUBLIC_SITE_URL` is set to your domain
2. Database contains motorcycle and shop data
3. Build process runs successfully
4. Files are deployed to `/public` directory

---

**Need help?** Check the configuration in `next-sitemap.config.js` or refer to the [next-sitemap documentation](https://github.com/iamvishnusankar/next-sitemap).