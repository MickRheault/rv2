import { ShopWithDetails, ShopWithMotorcycles } from '@/services/shops'

/**
 * Convert a location name to URL-safe slug format
 */
export function formatLocationForUrl(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

/**
 * Convert a URL slug back to readable format
 */
export function parseLocationFromUrl(slug: string): string {
  return slug
    .replace(/-/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

/**
 * Generate the new location-based shop URL
 */
export function getShopUrl(shop: ShopWithDetails | ShopWithMotorcycles | any): string {
  if (!shop?.cities?.provinces?.countries?.name || !shop?.cities?.name) {
    // Fallback to slug-only format if location data is missing
    return `/shop/${shop.slug}`
  }

  const country = formatLocationForUrl(shop.cities.provinces.countries.name)
  const city = formatLocationForUrl(shop.cities.name)
  const slug = shop.slug

  return `/shop/${country}/${city}/${slug}`
}

/**
 * Parse location parameters from URL
 */
export function parseShopLocation(country: string, city: string) {
  return {
    countryName: parseLocationFromUrl(country),
    cityName: parseLocationFromUrl(city)
  }
}

/**
 * Validate if shop matches URL location parameters
 */
export function validateShopLocation(
  shop: ShopWithDetails | ShopWithMotorcycles,
  urlCountry: string,
  urlCity: string
): boolean {
  if (!shop.cities?.provinces?.countries?.name || !shop.cities?.name) {
    return false
  }

  const expectedCountry = formatLocationForUrl(shop.cities.provinces.countries.name)
  const expectedCity = formatLocationForUrl(shop.cities.name)

  return expectedCountry === urlCountry && expectedCity === urlCity
}
