-- Geographic URL Structure Optimization Indexes
-- Task 7.1.2: Create indexes on location relationships for fast geographic queries
-- 
-- This migration adds specialized indexes for the new geo-first URL structure:
-- - /[country]/
-- - /[country]/[city]/
-- - /[country]/[city]/motorcycle-rental/
-- - /[country]/[city]/motorcycle/

-- ===============================================
-- SLUG-BASED LOOKUP INDEXES
-- ===============================================

-- Index for country slug lookups (new geographic pages)
CREATE INDEX IF NOT EXISTS idx_countries_slug 
ON countries (slug) 
WHERE slug IS NOT NULL;

-- Index for city slug lookups (new geographic pages)
CREATE INDEX IF NOT EXISTS idx_cities_slug 
ON cities (slug) 
WHERE slug IS NOT NULL;

-- Composite index for city slug + country lookup
CREATE INDEX IF NOT EXISTS idx_cities_slug_country 
ON cities (slug, province_id) 
WHERE slug IS NOT NULL;

-- ===============================================
-- GEOGRAPHIC HIERARCHY OPTIMIZATION
-- ===============================================

-- Optimize country → provinces → cities traversal
CREATE INDEX IF NOT EXISTS idx_provinces_country_slug 
ON provinces (country_code, name);

-- Optimize city → province → country traversal for geographic pages
CREATE INDEX IF NOT EXISTS idx_cities_province_lookup 
ON cities (province_id, name, slug) 
WHERE slug IS NOT NULL;

-- ===============================================
-- SHOP LOCATION FILTERING FOR GEOGRAPHIC PAGES
-- ===============================================

-- Optimize shop lookups by city for /[country]/[city]/motorcycle-rental/ pages
CREATE INDEX IF NOT EXISTS idx_shops_city_active 
ON rental_shops (city_id, business_status_id, slug) 
WHERE business_status_id IS NOT NULL;

-- Optimize shop slug lookups within geographic context
CREATE INDEX IF NOT EXISTS idx_shops_slug_city 
ON rental_shops (slug, city_id) 
WHERE slug IS NOT NULL AND city_id IS NOT NULL;

-- ===============================================
-- MOTORCYCLE LOCATION FILTERING OPTIMIZATION
-- ===============================================

-- Optimize motorcycle lookups by shop location for /[country]/[city]/motorcycle/ pages
CREATE INDEX IF NOT EXISTS idx_motorcycles_shop_location 
ON motorcycle_rentals (shop_id, availability_status, brand_id, category_id) 
WHERE availability_status IS NULL OR availability_status != 'unavailable';

-- Price-based filtering for geographic motorcycle pages
CREATE INDEX IF NOT EXISTS idx_motorcycles_shop_price 
ON motorcycle_rentals (shop_id, rental_rate_per_day, category_id) 
WHERE rental_rate_per_day IS NOT NULL;

-- ===============================================
-- CONTENT FIELD INDEXES FOR GEOGRAPHIC PAGES
-- ===============================================

-- Index for content retrieval on country pages
CREATE INDEX IF NOT EXISTS idx_countries_content_active 
ON countries (slug, title) 
WHERE slug IS NOT NULL AND title IS NOT NULL;

-- Index for content retrieval on city pages
CREATE INDEX IF NOT EXISTS idx_cities_content_active 
ON cities (slug, title, province_id) 
WHERE slug IS NOT NULL AND title IS NOT NULL;

-- ===============================================
-- GEOGRAPHIC AGGREGATION OPTIMIZATION
-- ===============================================

-- Optimize shop counting by city (for geographic statistics)
CREATE INDEX IF NOT EXISTS idx_shops_city_count 
ON rental_shops (city_id) 
WHERE business_status_id IS NOT NULL;

-- Optimize motorcycle counting by city via shops (for geographic statistics)
CREATE INDEX IF NOT EXISTS idx_motorcycles_city_via_shop 
ON motorcycle_rentals (shop_id) 
WHERE availability_status IS NULL OR availability_status != 'unavailable';

-- ===============================================
-- BREADCRUMB NAVIGATION OPTIMIZATION
-- ===============================================

-- Optimize breadcrumb generation: city → province → country
CREATE INDEX IF NOT EXISTS idx_breadcrumb_lookup 
ON cities (id, province_id);

-- Optimize reverse lookups for geographic context
CREATE INDEX IF NOT EXISTS idx_shops_geographic_context 
ON rental_shops (id, city_id) 
WHERE city_id IS NOT NULL;

-- ===============================================
-- SPATIAL OPTIMIZATION (for future geo features)
-- ===============================================

-- Optimize geographic proximity searches (for future map features)
CREATE INDEX IF NOT EXISTS idx_shops_location_spatial 
ON rental_shops (latitude, longitude, city_id) 
WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- ===============================================
-- PERFORMANCE COMMENTS
-- ===============================================

COMMENT ON INDEX idx_countries_slug IS 
'Fast slug-based country lookup for /[country]/ pages';

COMMENT ON INDEX idx_cities_slug IS 
'Fast slug-based city lookup for /[country]/[city]/ pages';

COMMENT ON INDEX idx_cities_slug_country IS 
'Combined city slug + country validation for geographic URL routing';

COMMENT ON INDEX idx_shops_city_active IS 
'Optimize shop listings for city-specific motorcycle-rental pages';

COMMENT ON INDEX idx_shops_slug_city IS 
'Fast shop slug lookup within city context for new URL structure';

COMMENT ON INDEX idx_motorcycles_shop_location IS 
'Optimize motorcycle filtering by location with availability and category filters';

COMMENT ON INDEX idx_motorcycles_shop_price IS 
'Price-range filtering for location-specific motorcycle pages';

COMMENT ON INDEX idx_countries_content_active IS 
'Content retrieval optimization for country landing pages';

COMMENT ON INDEX idx_cities_content_active IS 
'Content retrieval optimization for city landing pages';

COMMENT ON INDEX idx_breadcrumb_lookup IS 
'Fast breadcrumb navigation generation for geographic pages';

-- ===============================================
-- MATERIALIZED VIEW FOR GEOGRAPHIC STATISTICS
-- ===============================================

-- Enhanced materialized view for geographic pages statistics
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_geographic_stats AS
SELECT 
    -- Country level
    co.code as country_code,
    co.name as country_name,
    co.slug as country_slug,
    
    -- Province level  
    p.id as province_id,
    p.name as province_name,
    
    -- City level
    c.id as city_id,
    c.name as city_name,
    c.slug as city_slug,
    
    -- Statistics
    COUNT(DISTINCT rs.id) as shop_count,
    COUNT(DISTINCT mr.id) as motorcycle_count,
    COUNT(DISTINCT b.id) as brand_count,
    COUNT(DISTINCT cat.id) as category_count,
    
    -- Price statistics
    MIN(mr.rental_rate_per_day) as min_daily_rate,
    MAX(mr.rental_rate_per_day) as max_daily_rate,
    AVG(mr.rental_rate_per_day) as avg_daily_rate,
    
    -- Rating statistics
    AVG(rs.rating) as avg_shop_rating,
    COUNT(rs.rating) as rated_shop_count,
    
    -- Most common info
    MODE() WITHIN GROUP (ORDER BY b.name) as most_common_brand,
    MODE() WITHIN GROUP (ORDER BY cat.name) as most_common_category

FROM countries co
LEFT JOIN provinces p ON p.country_code = co.code
LEFT JOIN cities c ON c.province_id = p.id
LEFT JOIN rental_shops rs ON rs.city_id = c.id
LEFT JOIN motorcycle_rentals mr ON mr.shop_id = rs.id
LEFT JOIN brands b ON mr.brand_id = b.id
LEFT JOIN categories cat ON mr.category_id = cat.id

GROUP BY 
    co.code, co.name, co.slug,
    p.id, p.name,
    c.id, c.name, c.slug;

-- Indexes for the new materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_geo_stats_city 
ON mv_geographic_stats (city_id);

CREATE INDEX IF NOT EXISTS idx_mv_geo_stats_country_slug 
ON mv_geographic_stats (country_slug) 
WHERE country_slug IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_mv_geo_stats_city_slug 
ON mv_geographic_stats (city_slug) 
WHERE city_slug IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_mv_geo_stats_province 
ON mv_geographic_stats (province_id);

CREATE INDEX IF NOT EXISTS idx_mv_geo_stats_country 
ON mv_geographic_stats (country_code);

-- ===============================================
-- REFRESH FUNCTION FOR GEOGRAPHIC STATS
-- ===============================================

-- Function to refresh geographic statistics
CREATE OR REPLACE FUNCTION refresh_geographic_stats()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW mv_geographic_stats;
END;
$$ LANGUAGE plpgsql;

-- Update existing refresh function to include geographic stats
CREATE OR REPLACE FUNCTION refresh_all_location_stats()
RETURNS void AS $$
BEGIN
    -- Refresh existing view
    REFRESH MATERIALIZED VIEW mv_location_motorcycle_counts;
    
    -- Refresh new geographic view
    REFRESH MATERIALIZED VIEW mv_geographic_stats;
END;
$$ LANGUAGE plpgsql;

-- ===============================================
-- TRIGGER UPDATES FOR GEOGRAPHIC STATS
-- ===============================================

-- Update existing trigger to refresh both views
DROP TRIGGER IF EXISTS refresh_location_counts_on_motorcycle_change ON motorcycle_rentals;
DROP TRIGGER IF EXISTS refresh_location_counts_on_shop_change ON rental_shops;

-- Function to trigger all location stats refresh
CREATE OR REPLACE FUNCTION trigger_all_location_stats_refresh()
RETURNS trigger AS $$
BEGIN
    -- Schedule async refresh for both views
    PERFORM pg_notify('refresh_location_stats', '');
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- New triggers for both views
CREATE TRIGGER refresh_all_location_stats_on_motorcycle_change
    AFTER INSERT OR UPDATE OR DELETE ON motorcycle_rentals
    FOR EACH STATEMENT
    EXECUTE FUNCTION trigger_all_location_stats_refresh();

CREATE TRIGGER refresh_all_location_stats_on_shop_change
    AFTER INSERT OR UPDATE OR DELETE ON rental_shops
    FOR EACH STATEMENT
    EXECUTE FUNCTION trigger_all_location_stats_refresh();

-- ===============================================
-- VALIDATION AND MAINTENANCE
-- ===============================================

-- Function to validate geographic data integrity
CREATE OR REPLACE FUNCTION validate_geographic_data()
RETURNS TABLE (
    issue_type text,
    issue_count bigint,
    description text
) AS $$
BEGIN
    RETURN QUERY
    
    -- Check for cities without slugs
    SELECT 
        'missing_city_slugs'::text,
        COUNT(*)::bigint,
        'Cities without slugs (will break geographic URLs)'::text
    FROM cities 
    WHERE slug IS NULL
    
    UNION ALL
    
    -- Check for countries without slugs
    SELECT 
        'missing_country_slugs'::text,
        COUNT(*)::bigint,
        'Countries without slugs (will break geographic URLs)'::text
    FROM countries 
    WHERE slug IS NULL
    
    UNION ALL
    
    -- Check for shops without city association
    SELECT 
        'shops_without_city'::text,
        COUNT(*)::bigint,
        'Shops not associated with a city (will not appear in geographic pages)'::text
    FROM rental_shops 
    WHERE city_id IS NULL
    
    UNION ALL
    
    -- Check for duplicate slugs
    SELECT 
        'duplicate_city_slugs'::text,
        COUNT(*) - COUNT(DISTINCT slug)::bigint,
        'Duplicate city slugs (will cause routing conflicts)'::text
    FROM cities 
    WHERE slug IS NOT NULL;
    
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION validate_geographic_data IS 
'Validates data integrity for geographic URL structure';

COMMENT ON MATERIALIZED VIEW mv_geographic_stats IS 
'Comprehensive statistics for geographic landing pages with shop and motorcycle counts';

COMMENT ON FUNCTION refresh_geographic_stats IS 
'Refreshes geographic statistics materialized view for updated landing page data';