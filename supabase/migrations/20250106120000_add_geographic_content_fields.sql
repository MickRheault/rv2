-- Add geographic content fields for country and city landing pages
-- This migration adds fields to countries and cities tables to support content for geographic landing pages

-- Add content fields to countries table
ALTER TABLE public.countries ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE public.countries ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.countries ADD COLUMN IF NOT EXISTS keywords TEXT[];
ALTER TABLE public.countries ADD COLUMN IF NOT EXISTS general_information JSONB;
ALTER TABLE public.countries ADD COLUMN IF NOT EXISTS seasonal_info JSONB;
ALTER TABLE public.countries ADD COLUMN IF NOT EXISTS legal_requirements JSONB;
ALTER TABLE public.countries ADD COLUMN IF NOT EXISTS featured_image_url TEXT;
ALTER TABLE public.countries ADD COLUMN IF NOT EXISTS slug TEXT;

-- Add content fields to cities table  
ALTER TABLE public.cities ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE public.cities ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.cities ADD COLUMN IF NOT EXISTS keywords TEXT[];
ALTER TABLE public.cities ADD COLUMN IF NOT EXISTS general_information JSONB;
ALTER TABLE public.cities ADD COLUMN IF NOT EXISTS local_attractions JSONB;
ALTER TABLE public.cities ADD COLUMN IF NOT EXISTS popular_routes JSONB;
ALTER TABLE public.cities ADD COLUMN IF NOT EXISTS local_regulations JSONB;
ALTER TABLE public.cities ADD COLUMN IF NOT EXISTS weather_info JSONB;
ALTER TABLE public.cities ADD COLUMN IF NOT EXISTS featured_image_url TEXT;
ALTER TABLE public.cities ADD COLUMN IF NOT EXISTS slug TEXT;

-- Create unique indexes on slugs for SEO-friendly URLs
CREATE UNIQUE INDEX IF NOT EXISTS idx_countries_slug ON public.countries(slug);
CREATE UNIQUE INDEX IF NOT EXISTS idx_cities_slug ON public.cities(slug);

-- Generate initial slugs from names (lowercase, replace spaces with hyphens)
UPDATE public.countries 
SET slug = LOWER(REGEXP_REPLACE(name, '[^a-zA-Z0-9\s]', '', 'g'))
WHERE slug IS NULL;

UPDATE public.countries 
SET slug = REPLACE(slug, ' ', '-')
WHERE slug IS NOT NULL;

UPDATE public.cities 
SET slug = LOWER(REGEXP_REPLACE(name, '[^a-zA-Z0-9\s]', '', 'g'))
WHERE slug IS NULL;

UPDATE public.cities 
SET slug = REPLACE(slug, ' ', '-')
WHERE slug IS NOT NULL;

-- Handle potential duplicate slugs by appending city ID substring
UPDATE public.cities 
SET slug = slug || '-' || SUBSTRING(id::text, 1, 8)
WHERE slug IN (
    SELECT slug 
    FROM public.cities 
    GROUP BY slug 
    HAVING COUNT(*) > 1
);

-- Add comments for documentation
COMMENT ON COLUMN public.countries.title IS 'Display title for country landing pages';
COMMENT ON COLUMN public.countries.description IS 'Description content for country landing pages';
COMMENT ON COLUMN public.countries.keywords IS 'Array of keywords for country pages';
COMMENT ON COLUMN public.countries.general_information IS 'JSON object containing general information: {overview, highlights, important_info}';
COMMENT ON COLUMN public.countries.seasonal_info IS 'JSON object containing seasonal data: {best_months, weather_patterns, seasonal_tips}';
COMMENT ON COLUMN public.countries.legal_requirements IS 'JSON object containing legal info: {documents, insurance, age_restrictions}';
COMMENT ON COLUMN public.countries.featured_image_url IS 'Featured image URL for country hero sections';
COMMENT ON COLUMN public.countries.slug IS 'URL-friendly slug for country pages';

COMMENT ON COLUMN public.cities.title IS 'Display title for city landing pages';
COMMENT ON COLUMN public.cities.description IS 'Description content for city landing pages';
COMMENT ON COLUMN public.cities.keywords IS 'Array of keywords for city pages';
COMMENT ON COLUMN public.cities.general_information IS 'JSON object containing general information: {overview, highlights, important_info}';
COMMENT ON COLUMN public.cities.local_attractions IS 'JSON object containing attractions: {popular_spots, riding_destinations, landmarks}';
COMMENT ON COLUMN public.cities.popular_routes IS 'JSON object containing route info: {scenic_routes, day_trips, difficulty_levels}';
COMMENT ON COLUMN public.cities.local_regulations IS 'JSON object containing city-specific regulations: {parking, traffic_rules, restrictions}';
COMMENT ON COLUMN public.cities.weather_info IS 'JSON object containing weather data: {best_months, avg_temperatures, rainfall}';
COMMENT ON COLUMN public.cities.featured_image_url IS 'Featured image URL for city hero sections';
COMMENT ON COLUMN public.cities.slug IS 'URL-friendly slug for city pages';