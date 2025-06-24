-- Performance Optimization Migration for RideVault
-- Task 2.8: Optimize database queries with proper indexing and caching

-- ===============================================
-- COMPOSITE INDEXES FOR SEARCH PERFORMANCE
-- ===============================================

-- Location-based search optimization
CREATE INDEX IF NOT EXISTS idx_cities_province_country 
ON cities (province_id, name);

CREATE INDEX IF NOT EXISTS idx_provinces_country_name 
ON provinces (country_code, name);

-- Motorcycle search optimization - composite indexes for common filter combinations
CREATE INDEX IF NOT EXISTS idx_motorcycles_location_brand_category 
ON motorcycle_rentals (shop_id, brand_id, category_id) 
WHERE availability_status IS NULL OR availability_status != 'unavailable';

CREATE INDEX IF NOT EXISTS idx_motorcycles_price_engine 
ON motorcycle_rentals (rental_rate_per_day, engine_capacity_cc) 
WHERE rental_rate_per_day IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_motorcycles_category_price 
ON motorcycle_rentals (category_id, rental_rate_per_day) 
WHERE rental_rate_per_day IS NOT NULL;

-- Shop location filtering optimization
CREATE INDEX IF NOT EXISTS idx_shops_city_rating 
ON rental_shops (city_id, rating) 
WHERE rating IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_shops_location_status 
ON rental_shops (city_id, business_status_id);

-- ===============================================
-- SEARCH PERFORMANCE INDEXES
-- ===============================================

-- Text search optimization for models and shop names
CREATE INDEX IF NOT EXISTS idx_motorcycles_model_text 
ON motorcycle_rentals USING gin (to_tsvector('english', model));

CREATE INDEX IF NOT EXISTS idx_shops_name_text 
ON rental_shops USING gin (to_tsvector('english', provider_name));

-- Case-insensitive search for location names
CREATE INDEX IF NOT EXISTS idx_cities_name_lower 
ON cities (lower(name));

CREATE INDEX IF NOT EXISTS idx_provinces_name_lower 
ON provinces (lower(name));

CREATE INDEX IF NOT EXISTS idx_countries_name_lower 
ON countries (lower(name));

-- ===============================================
-- SORTING PERFORMANCE INDEXES
-- ===============================================

-- Rating and review sorting optimization
CREATE INDEX IF NOT EXISTS idx_shops_rating_reviews 
ON rental_shops (rating DESC NULLS LAST, review_count DESC NULLS LAST);

-- Created date sorting (for "newest" sort)
CREATE INDEX IF NOT EXISTS idx_motorcycles_created_desc 
ON motorcycle_rentals (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_shops_created_desc 
ON rental_shops (created_at DESC);

-- ===============================================
-- FEATURE FILTERING OPTIMIZATION
-- ===============================================

-- Optimize feature-based filtering with covering index
CREATE INDEX IF NOT EXISTS idx_motorcycle_features_covering 
ON motorcycle_features (feature_id, motorcycle_id);

-- ===============================================
-- MATERIALIZED VIEWS FOR COMPLEX QUERIES
-- ===============================================

-- Materialized view for motorcycle counts by location
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_location_motorcycle_counts AS
SELECT 
    c.id as city_id,
    c.name as city_name,
    p.id as province_id,
    p.name as province_name,
    co.code as country_code,
    co.name as country_name,
    COUNT(mr.id) as motorcycle_count,
    COUNT(DISTINCT rs.id) as shop_count,
    MIN(mr.rental_rate_per_day) as min_price,
    MAX(mr.rental_rate_per_day) as max_price,
    AVG(rs.rating) as avg_rating
FROM cities c
JOIN provinces p ON c.province_id = p.id
JOIN countries co ON p.country_code = co.code
LEFT JOIN rental_shops rs ON c.id = rs.city_id
LEFT JOIN motorcycle_rentals mr ON rs.id = mr.shop_id
GROUP BY c.id, c.name, p.id, p.name, co.code, co.name;

-- Index for the materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_location_counts_city 
ON mv_location_motorcycle_counts (city_id);

CREATE INDEX IF NOT EXISTS idx_mv_location_counts_province 
ON mv_location_motorcycle_counts (province_id);

CREATE INDEX IF NOT EXISTS idx_mv_location_counts_country 
ON mv_location_motorcycle_counts (country_code);

-- ===============================================
-- FUNCTIONS FOR EFFICIENT QUERIES
-- ===============================================

-- Function to refresh location counts materialized view
CREATE OR REPLACE FUNCTION refresh_location_counts()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW mv_location_motorcycle_counts;
END;
$$ LANGUAGE plpgsql;

-- Function for efficient location search with counts
CREATE OR REPLACE FUNCTION search_locations_with_counts(search_query text, result_limit int DEFAULT 10)
RETURNS TABLE (
    type text,
    id text,
    name text,
    parent_name text,
    full_name text,
    motorcycle_count bigint,
    shop_count bigint
) AS $$
BEGIN
    RETURN QUERY
    -- Search cities
    SELECT 
        'city'::text as type,
        c.id::text as id,
        c.name,
        (p.name || ', ' || co.name) as parent_name,
        (c.name || ', ' || p.name || ', ' || co.name) as full_name,
        COALESCE(mv.motorcycle_count, 0) as motorcycle_count,
        COALESCE(mv.shop_count, 0) as shop_count
    FROM cities c
    JOIN provinces p ON c.province_id = p.id
    JOIN countries co ON p.country_code = co.code
    LEFT JOIN mv_location_motorcycle_counts mv ON c.id = mv.city_id
    WHERE lower(c.name) LIKE lower('%' || search_query || '%')
    
    UNION ALL
    
    -- Search provinces
    SELECT 
        'province'::text as type,
        p.id::text as id,
        p.name,
        co.name as parent_name,
        (p.name || ', ' || co.name) as full_name,
        COALESCE(SUM(mv.motorcycle_count), 0) as motorcycle_count,
        COALESCE(SUM(mv.shop_count), 0) as shop_count
    FROM provinces p
    JOIN countries co ON p.country_code = co.code
    LEFT JOIN mv_location_motorcycle_counts mv ON p.id = mv.province_id
    WHERE lower(p.name) LIKE lower('%' || search_query || '%')
    GROUP BY p.id, p.name, co.name
    
    UNION ALL
    
    -- Search countries
    SELECT 
        'country'::text as type,
        co.code::text as id,
        co.name,
        ''::text as parent_name,
        co.name as full_name,
        COALESCE(SUM(mv.motorcycle_count), 0) as motorcycle_count,
        COALESCE(SUM(mv.shop_count), 0) as shop_count
    FROM countries co
    LEFT JOIN mv_location_motorcycle_counts mv ON co.code = mv.country_code
    WHERE lower(co.name) LIKE lower('%' || search_query || '%')
       OR lower(co.code) LIKE lower('%' || search_query || '%')
    GROUP BY co.code, co.name
    
    ORDER BY motorcycle_count DESC, name
    LIMIT result_limit;
END;
$$ LANGUAGE plpgsql;

-- ===============================================
-- PERFORMANCE STATISTICS FUNCTIONS
-- ===============================================

-- Function to get query performance stats
CREATE OR REPLACE FUNCTION get_query_performance_stats()
RETURNS TABLE (
    query_type text,
    avg_duration_ms numeric,
    total_calls bigint,
    cache_hit_ratio numeric
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        'motorcycle_search'::text as query_type,
        0.0::numeric as avg_duration_ms,
        0::bigint as total_calls,
        0.0::numeric as cache_hit_ratio
    WHERE false; -- Placeholder for future implementation
END;
$$ LANGUAGE plpgsql;

-- ===============================================
-- TRIGGERS FOR MATERIALIZED VIEW REFRESH
-- ===============================================

-- Function to trigger materialized view refresh
CREATE OR REPLACE FUNCTION trigger_location_counts_refresh()
RETURNS trigger AS $$
BEGIN
    -- Schedule async refresh (in production, use a job queue)
    PERFORM pg_notify('refresh_location_counts', '');
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Triggers to refresh counts when data changes
CREATE TRIGGER refresh_location_counts_on_motorcycle_change
    AFTER INSERT OR UPDATE OR DELETE ON motorcycle_rentals
    FOR EACH STATEMENT
    EXECUTE FUNCTION trigger_location_counts_refresh();

CREATE TRIGGER refresh_location_counts_on_shop_change
    AFTER INSERT OR UPDATE OR DELETE ON rental_shops
    FOR EACH STATEMENT
    EXECUTE FUNCTION trigger_location_counts_refresh();

-- ===============================================
-- COMMENTS FOR DOCUMENTATION
-- ===============================================

COMMENT ON INDEX idx_motorcycles_location_brand_category IS 
'Composite index for filtering motorcycles by location, brand, and category - most common search pattern';

COMMENT ON INDEX idx_motorcycles_price_engine IS 
'Composite index for price range and engine capacity filtering';

COMMENT ON INDEX idx_shops_city_rating IS 
'Composite index for location-based shop search with rating sorting';

COMMENT ON MATERIALIZED VIEW mv_location_motorcycle_counts IS 
'Cached location statistics for fast location search with counts';

COMMENT ON FUNCTION search_locations_with_counts IS 
'Optimized location search function with motorcycle and shop counts'; 