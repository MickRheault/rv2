-- Location-Based Content Retrieval Database Functions
-- Task 7.1.4: Implement database queries for location-based content retrieval
--
-- This migration creates specialized database functions to efficiently retrieve
-- location-based content for the new geo-first URL structure pages

-- ===============================================
-- COUNTRY-LEVEL CONTENT RETRIEVAL
-- ===============================================

-- Get country with full content and basic statistics
CREATE OR REPLACE FUNCTION get_country_with_content(country_slug_param text)
RETURNS TABLE (
    code text,
    name text,
    slug text,
    title text,
    description text,
    keywords text[],
    general_information jsonb,
    seasonal_info jsonb,
    legal_requirements jsonb,
    featured_image_url text,
    created_at timestamptz,
    updated_at timestamptz,
    total_provinces bigint,
    total_cities bigint,
    total_shops bigint,
    total_motorcycles bigint,
    min_daily_rate numeric,
    max_daily_rate numeric,
    avg_shop_rating numeric
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.code,
        c.name,
        c.slug,
        c.title,
        c.description,
        c.keywords,
        c.general_information,
        c.seasonal_info,
        c.legal_requirements,
        c.featured_image_url,
        c.created_at,
        c.updated_at,
        
        -- Aggregate statistics
        COUNT(DISTINCT p.id) as total_provinces,
        COUNT(DISTINCT ci.id) as total_cities,
        COUNT(DISTINCT rs.id) as total_shops,
        COUNT(DISTINCT mr.id) as total_motorcycles,
        MIN(mr.rental_rate_per_day) as min_daily_rate,
        MAX(mr.rental_rate_per_day) as max_daily_rate,
        AVG(rs.rating) as avg_shop_rating
        
    FROM countries c
    LEFT JOIN provinces p ON p.country_code = c.code
    LEFT JOIN cities ci ON ci.province_id = p.id
    LEFT JOIN rental_shops rs ON rs.city_id = ci.id AND rs.business_status_id IS NOT NULL
    LEFT JOIN motorcycle_rentals mr ON mr.shop_id = rs.id 
        AND (mr.availability_status IS NULL OR mr.availability_status != 'unavailable')
    
    WHERE c.slug = country_slug_param
    GROUP BY c.code, c.name, c.slug, c.title, c.description, c.keywords, 
             c.general_information, c.seasonal_info, c.legal_requirements, 
             c.featured_image_url, c.created_at, c.updated_at;
END;
$$ LANGUAGE plpgsql;

-- Get featured cities for a country (top by motorcycle count)
CREATE OR REPLACE FUNCTION get_country_featured_cities(country_slug_param text, city_limit int DEFAULT 5)
RETURNS TABLE (
    city_id uuid,
    city_name text,
    city_slug text,
    city_title text,
    city_description text,
    province_name text,
    shop_count bigint,
    motorcycle_count bigint,
    min_daily_rate numeric,
    max_daily_rate numeric,
    avg_shop_rating numeric
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ci.id as city_id,
        ci.name as city_name,
        ci.slug as city_slug,
        ci.title as city_title,
        ci.description as city_description,
        p.name as province_name,
        
        COUNT(DISTINCT rs.id) as shop_count,
        COUNT(DISTINCT mr.id) as motorcycle_count,
        MIN(mr.rental_rate_per_day) as min_daily_rate,
        MAX(mr.rental_rate_per_day) as max_daily_rate,
        AVG(rs.rating) as avg_shop_rating
        
    FROM cities ci
    JOIN provinces p ON ci.province_id = p.id
    JOIN countries c ON p.country_code = c.code
    LEFT JOIN rental_shops rs ON rs.city_id = ci.id AND rs.business_status_id IS NOT NULL
    LEFT JOIN motorcycle_rentals mr ON mr.shop_id = rs.id 
        AND (mr.availability_status IS NULL OR mr.availability_status != 'unavailable')
    
    WHERE c.slug = country_slug_param 
      AND ci.slug IS NOT NULL
    
    GROUP BY ci.id, ci.name, ci.slug, ci.title, ci.description, p.name
    HAVING COUNT(DISTINCT mr.id) > 0
    ORDER BY motorcycle_count DESC, ci.name
    LIMIT city_limit;
END;
$$ LANGUAGE plpgsql;

-- ===============================================
-- CITY-LEVEL CONTENT RETRIEVAL
-- ===============================================

-- Get city with full content and statistics
CREATE OR REPLACE FUNCTION get_city_with_content(country_slug_param text, city_slug_param text)
RETURNS TABLE (
    city_id uuid,
    city_name text,
    city_slug text,
    city_title text,
    city_description text,
    city_keywords text[],
    city_general_information jsonb,
    city_local_attractions jsonb,
    city_popular_routes jsonb,
    city_local_regulations jsonb,
    city_weather_info jsonb,
    city_featured_image_url text,
    province_id uuid,
    province_name text,
    country_code text,
    country_name text,
    country_slug text,
    shop_count bigint,
    motorcycle_count bigint,
    brand_count bigint,
    category_count bigint,
    min_daily_rate numeric,
    max_daily_rate numeric,
    avg_daily_rate numeric,
    avg_shop_rating numeric
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ci.id as city_id,
        ci.name as city_name,
        ci.slug as city_slug,
        ci.title as city_title,
        ci.description as city_description,
        ci.keywords as city_keywords,
        ci.general_information as city_general_information,
        ci.local_attractions as city_local_attractions,
        ci.popular_routes as city_popular_routes,
        ci.local_regulations as city_local_regulations,
        ci.weather_info as city_weather_info,
        ci.featured_image_url as city_featured_image_url,
        p.id as province_id,
        p.name as province_name,
        c.code as country_code,
        c.name as country_name,
        c.slug as country_slug,
        
        -- Aggregate statistics
        COUNT(DISTINCT rs.id) as shop_count,
        COUNT(DISTINCT mr.id) as motorcycle_count,
        COUNT(DISTINCT mr.brand_id) as brand_count,
        COUNT(DISTINCT mr.category_id) as category_count,
        MIN(mr.rental_rate_per_day) as min_daily_rate,
        MAX(mr.rental_rate_per_day) as max_daily_rate,
        AVG(mr.rental_rate_per_day) as avg_daily_rate,
        AVG(rs.rating) as avg_shop_rating
        
    FROM cities ci
    JOIN provinces p ON ci.province_id = p.id
    JOIN countries c ON p.country_code = c.code
    LEFT JOIN rental_shops rs ON rs.city_id = ci.id AND rs.business_status_id IS NOT NULL
    LEFT JOIN motorcycle_rentals mr ON mr.shop_id = rs.id 
        AND (mr.availability_status IS NULL OR mr.availability_status != 'unavailable')
    
    WHERE c.slug = country_slug_param 
      AND ci.slug = city_slug_param
    
    GROUP BY ci.id, ci.name, ci.slug, ci.title, ci.description, ci.keywords,
             ci.general_information, ci.local_attractions, ci.popular_routes,
             ci.local_regulations, ci.weather_info, ci.featured_image_url,
             p.id, p.name, c.code, c.name, c.slug;
END;
$$ LANGUAGE plpgsql;

-- ===============================================
-- SHOP LISTINGS BY LOCATION
-- ===============================================

-- Get shops for a specific city with aggregated data
CREATE OR REPLACE FUNCTION get_shops_by_location(
    country_slug_param text, 
    city_slug_param text,
    sort_by_param text DEFAULT 'rating',
    limit_param int DEFAULT 20,
    offset_param int DEFAULT 0
)
RETURNS TABLE (
    shop_id uuid,
    provider_name text,
    slug text,
    location_name text,
    full_address text,
    phone text,
    website text,
    rating numeric,
    review_count int,
    business_description text,
    motorcycle_count bigint,
    brand_count bigint,
    category_count bigint,
    min_daily_rate numeric,
    max_daily_rate numeric,
    avg_daily_rate numeric,
    created_at timestamptz
) AS $$
DECLARE
    sort_clause text;
BEGIN
    -- Build sort clause based on parameter
    CASE sort_by_param
        WHEN 'name' THEN sort_clause := 'ORDER BY rs.provider_name ASC';
        WHEN 'motorcycle_count' THEN sort_clause := 'ORDER BY motorcycle_count DESC, rs.provider_name ASC';
        WHEN 'rating' THEN sort_clause := 'ORDER BY rs.rating DESC NULLS LAST, rs.provider_name ASC';
        ELSE sort_clause := 'ORDER BY rs.rating DESC NULLS LAST, rs.provider_name ASC';
    END CASE;

    RETURN QUERY EXECUTE format('
        SELECT 
            rs.id as shop_id,
            rs.provider_name,
            rs.slug,
            rs.location_name,
            rs.full_address,
            rs.phone,
            rs.website,
            rs.rating,
            rs.review_count,
            rs.business_description,
            
            -- Aggregate motorcycle data
            COUNT(DISTINCT mr.id) as motorcycle_count,
            COUNT(DISTINCT mr.brand_id) as brand_count,
            COUNT(DISTINCT mr.category_id) as category_count,
            MIN(mr.rental_rate_per_day) as min_daily_rate,
            MAX(mr.rental_rate_per_day) as max_daily_rate,
            AVG(mr.rental_rate_per_day) as avg_daily_rate,
            rs.created_at
            
        FROM rental_shops rs
        JOIN cities ci ON rs.city_id = ci.id
        JOIN provinces p ON ci.province_id = p.id
        JOIN countries c ON p.country_code = c.code
        LEFT JOIN motorcycle_rentals mr ON mr.shop_id = rs.id 
            AND (mr.availability_status IS NULL OR mr.availability_status != ''unavailable'')
        
        WHERE c.slug = $1 
          AND ci.slug = $2
          AND rs.business_status_id IS NOT NULL
        
        GROUP BY rs.id, rs.provider_name, rs.slug, rs.location_name, rs.full_address,
                 rs.phone, rs.website, rs.rating, rs.review_count, rs.business_description,
                 rs.created_at
        
        %s
        LIMIT $3 OFFSET $4
    ', sort_clause) 
    USING country_slug_param, city_slug_param, limit_param, offset_param;
END;
$$ LANGUAGE plpgsql;

-- Get total count of shops for a location (for pagination)
CREATE OR REPLACE FUNCTION get_shops_count_by_location(country_slug_param text, city_slug_param text)
RETURNS bigint AS $$
DECLARE
    total_count bigint;
BEGIN
    SELECT COUNT(DISTINCT rs.id) INTO total_count
    FROM rental_shops rs
    JOIN cities ci ON rs.city_id = ci.id
    JOIN provinces p ON ci.province_id = p.id
    JOIN countries c ON p.country_code = c.code
    
    WHERE c.slug = country_slug_param 
      AND ci.slug = city_slug_param
      AND rs.business_status_id IS NOT NULL;
    
    RETURN COALESCE(total_count, 0);
END;
$$ LANGUAGE plpgsql;

-- ===============================================
-- MOTORCYCLE LISTINGS BY LOCATION
-- ===============================================

-- Get motorcycles for a specific city with filtering
CREATE OR REPLACE FUNCTION get_motorcycles_by_location(
    country_slug_param text,
    city_slug_param text,
    brand_id_param uuid DEFAULT NULL,
    category_id_param uuid DEFAULT NULL,
    min_price_param numeric DEFAULT NULL,
    max_price_param numeric DEFAULT NULL,
    sort_by_param text DEFAULT 'newest',
    limit_param int DEFAULT 20,
    offset_param int DEFAULT 0
)
RETURNS TABLE (
    motorcycle_id uuid,
    model text,
    year int,
    engine_capacity_cc int,
    rental_rate_per_day numeric,
    rental_rate_currency text,
    availability_status text,
    brand_id uuid,
    brand_name text,
    category_id uuid,
    category_name text,
    shop_id uuid,
    shop_name text,
    shop_slug text,
    shop_rating numeric,
    created_at timestamptz
) AS $$
DECLARE
    sort_clause text;
    filter_clause text := '';
BEGIN
    -- Build filter clauses
    IF brand_id_param IS NOT NULL THEN
        filter_clause := filter_clause || ' AND mr.brand_id = ''' || brand_id_param || '''';
    END IF;
    
    IF category_id_param IS NOT NULL THEN
        filter_clause := filter_clause || ' AND mr.category_id = ''' || category_id_param || '''';
    END IF;
    
    IF min_price_param IS NOT NULL THEN
        filter_clause := filter_clause || ' AND mr.rental_rate_per_day >= ' || min_price_param;
    END IF;
    
    IF max_price_param IS NOT NULL THEN
        filter_clause := filter_clause || ' AND mr.rental_rate_per_day <= ' || max_price_param;
    END IF;

    -- Build sort clause
    CASE sort_by_param
        WHEN 'price' THEN sort_clause := 'ORDER BY mr.rental_rate_per_day ASC NULLS LAST, mr.model ASC';
        WHEN 'brand' THEN sort_clause := 'ORDER BY b.name ASC, mr.model ASC';
        WHEN 'category' THEN sort_clause := 'ORDER BY cat.name ASC, mr.model ASC';
        WHEN 'newest' THEN sort_clause := 'ORDER BY mr.created_at DESC, mr.model ASC';
        ELSE sort_clause := 'ORDER BY mr.created_at DESC, mr.model ASC';
    END CASE;

    RETURN QUERY EXECUTE format('
        SELECT 
            mr.id as motorcycle_id,
            mr.model,
            mr.year,
            mr.engine_capacity_cc,
            mr.rental_rate_per_day,
            mr.rental_rate_currency,
            mr.availability_status,
            mr.brand_id,
            b.name as brand_name,
            mr.category_id,
            cat.name as category_name,
            rs.id as shop_id,
            rs.provider_name as shop_name,
            rs.slug as shop_slug,
            rs.rating as shop_rating,
            mr.created_at
            
        FROM motorcycle_rentals mr
        JOIN rental_shops rs ON mr.shop_id = rs.id
        JOIN cities ci ON rs.city_id = ci.id
        JOIN provinces p ON ci.province_id = p.id
        JOIN countries c ON p.country_code = c.code
        LEFT JOIN brands b ON mr.brand_id = b.id
        LEFT JOIN categories cat ON mr.category_id = cat.id
        
        WHERE c.slug = $1 
          AND ci.slug = $2
          AND rs.business_status_id IS NOT NULL
          AND (mr.availability_status IS NULL OR mr.availability_status != ''unavailable'')
          %s
        
        %s
        LIMIT $3 OFFSET $4
    ', filter_clause, sort_clause) 
    USING country_slug_param, city_slug_param, limit_param, offset_param;
END;
$$ LANGUAGE plpgsql;

-- Get total count of motorcycles for a location with filters (for pagination)
CREATE OR REPLACE FUNCTION get_motorcycles_count_by_location(
    country_slug_param text,
    city_slug_param text,
    brand_id_param uuid DEFAULT NULL,
    category_id_param uuid DEFAULT NULL,
    min_price_param numeric DEFAULT NULL,
    max_price_param numeric DEFAULT NULL
)
RETURNS bigint AS $$
DECLARE
    total_count bigint;
    filter_clause text := '';
BEGIN
    -- Build filter clauses
    IF brand_id_param IS NOT NULL THEN
        filter_clause := filter_clause || ' AND mr.brand_id = ''' || brand_id_param || '''';
    END IF;
    
    IF category_id_param IS NOT NULL THEN
        filter_clause := filter_clause || ' AND mr.category_id = ''' || category_id_param || '''';
    END IF;
    
    IF min_price_param IS NOT NULL THEN
        filter_clause := filter_clause || ' AND mr.rental_rate_per_day >= ' || min_price_param;
    END IF;
    
    IF max_price_param IS NOT NULL THEN
        filter_clause := filter_clause || ' AND mr.rental_rate_per_day <= ' || max_price_param;
    END IF;

    EXECUTE format('
        SELECT COUNT(DISTINCT mr.id)
        FROM motorcycle_rentals mr
        JOIN rental_shops rs ON mr.shop_id = rs.id
        JOIN cities ci ON rs.city_id = ci.id
        JOIN provinces p ON ci.province_id = p.id
        JOIN countries c ON p.country_code = c.code
        
        WHERE c.slug = $1 
          AND ci.slug = $2
          AND rs.business_status_id IS NOT NULL
          AND (mr.availability_status IS NULL OR mr.availability_status != ''unavailable'')
          %s
    ', filter_clause) 
    INTO total_count
    USING country_slug_param, city_slug_param;
    
    RETURN COALESCE(total_count, 0);
END;
$$ LANGUAGE plpgsql;

-- ===============================================
-- FILTER OPTIONS FOR LOCATION-BASED PAGES
-- ===============================================

-- Get available brands for a location
CREATE OR REPLACE FUNCTION get_location_brands(country_slug_param text, city_slug_param text)
RETURNS TABLE (
    brand_id uuid,
    brand_name text,
    motorcycle_count bigint
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        b.id as brand_id,
        b.name as brand_name,
        COUNT(DISTINCT mr.id) as motorcycle_count
    FROM brands b
    JOIN motorcycle_rentals mr ON mr.brand_id = b.id
    JOIN rental_shops rs ON mr.shop_id = rs.id
    JOIN cities ci ON rs.city_id = ci.id
    JOIN provinces p ON ci.province_id = p.id
    JOIN countries c ON p.country_code = c.code
    
    WHERE c.slug = country_slug_param 
      AND ci.slug = city_slug_param
      AND rs.business_status_id IS NOT NULL
      AND (mr.availability_status IS NULL OR mr.availability_status != 'unavailable')
    
    GROUP BY b.id, b.name
    HAVING COUNT(DISTINCT mr.id) > 0
    ORDER BY motorcycle_count DESC, b.name;
END;
$$ LANGUAGE plpgsql;

-- Get available categories for a location
CREATE OR REPLACE FUNCTION get_location_categories(country_slug_param text, city_slug_param text)
RETURNS TABLE (
    category_id uuid,
    category_name text,
    motorcycle_count bigint
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        cat.id as category_id,
        cat.name as category_name,
        COUNT(DISTINCT mr.id) as motorcycle_count
    FROM categories cat
    JOIN motorcycle_rentals mr ON mr.category_id = cat.id
    JOIN rental_shops rs ON mr.shop_id = rs.id
    JOIN cities ci ON rs.city_id = ci.id
    JOIN provinces p ON ci.province_id = p.id
    JOIN countries c ON p.country_code = c.code
    
    WHERE c.slug = country_slug_param 
      AND ci.slug = city_slug_param
      AND rs.business_status_id IS NOT NULL
      AND (mr.availability_status IS NULL OR mr.availability_status != 'unavailable')
    
    GROUP BY cat.id, cat.name
    HAVING COUNT(DISTINCT mr.id) > 0
    ORDER BY motorcycle_count DESC, cat.name;
END;
$$ LANGUAGE plpgsql;

-- Get price ranges for a location
CREATE OR REPLACE FUNCTION get_location_price_ranges(country_slug_param text, city_slug_param text)
RETURNS TABLE (
    min_price numeric,
    max_price numeric,
    avg_price numeric,
    price_percentiles jsonb
) AS $$
DECLARE
    prices numeric[];
    percentile_25 numeric;
    percentile_50 numeric;
    percentile_75 numeric;
BEGIN
    -- Get all prices for the location
    SELECT array_agg(mr.rental_rate_per_day ORDER BY mr.rental_rate_per_day) 
    INTO prices
    FROM motorcycle_rentals mr
    JOIN rental_shops rs ON mr.shop_id = rs.id
    JOIN cities ci ON rs.city_id = ci.id
    JOIN provinces p ON ci.province_id = p.id
    JOIN countries c ON p.country_code = c.code
    
    WHERE c.slug = country_slug_param 
      AND ci.slug = city_slug_param
      AND rs.business_status_id IS NOT NULL
      AND (mr.availability_status IS NULL OR mr.availability_status != 'unavailable')
      AND mr.rental_rate_per_day IS NOT NULL;

    IF array_length(prices, 1) > 0 THEN
        -- Calculate percentiles
        SELECT percentile_cont(0.25) WITHIN GROUP (ORDER BY unnest(prices)) INTO percentile_25;
        SELECT percentile_cont(0.50) WITHIN GROUP (ORDER BY unnest(prices)) INTO percentile_50;
        SELECT percentile_cont(0.75) WITHIN GROUP (ORDER BY unnest(prices)) INTO percentile_75;

        RETURN QUERY
        SELECT 
            prices[1] as min_price,
            prices[array_upper(prices, 1)] as max_price,
            (SELECT avg(unnest) FROM unnest(prices)) as avg_price,
            jsonb_build_object(
                'p25', percentile_25,
                'p50', percentile_50,
                'p75', percentile_75
            ) as price_percentiles;
    ELSE
        RETURN QUERY
        SELECT 
            NULL::numeric as min_price,
            NULL::numeric as max_price,
            NULL::numeric as avg_price,
            NULL::jsonb as price_percentiles;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- ===============================================
-- LOCATION VALIDATION AND UTILITIES
-- ===============================================

-- Validate country and city slug combination
CREATE OR REPLACE FUNCTION validate_location_slugs(country_slug_param text, city_slug_param text DEFAULT NULL)
RETURNS TABLE (
    is_valid boolean,
    country_code text,
    country_name text,
    city_id uuid,
    city_name text,
    province_name text
) AS $$
BEGIN
    IF city_slug_param IS NULL THEN
        -- Validate country only
        RETURN QUERY
        SELECT 
            (c.slug IS NOT NULL) as is_valid,
            c.code as country_code,
            c.name as country_name,
            NULL::uuid as city_id,
            NULL::text as city_name,
            NULL::text as province_name
        FROM countries c
        WHERE c.slug = country_slug_param;
    ELSE
        -- Validate country and city combination
        RETURN QUERY
        SELECT 
            (c.slug IS NOT NULL AND ci.slug IS NOT NULL) as is_valid,
            c.code as country_code,
            c.name as country_name,
            ci.id as city_id,
            ci.name as city_name,
            p.name as province_name
        FROM countries c
        JOIN provinces p ON p.country_code = c.code
        JOIN cities ci ON ci.province_id = p.id
        WHERE c.slug = country_slug_param 
          AND ci.slug = city_slug_param;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Generate breadcrumb data for geographic navigation
CREATE OR REPLACE FUNCTION get_location_breadcrumbs(country_slug_param text, city_slug_param text DEFAULT NULL)
RETURNS TABLE (
    level int,
    type text,
    name text,
    slug text,
    url_path text
) AS $$
BEGIN
    IF city_slug_param IS NULL THEN
        -- Country level breadcrumbs
        RETURN QUERY
        SELECT 
            1 as level,
            'country'::text as type,
            c.name,
            c.slug,
            ('/' || c.slug) as url_path
        FROM countries c
        WHERE c.slug = country_slug_param;
    ELSE
        -- Country and city breadcrumbs
        RETURN QUERY
        SELECT 
            1 as level,
            'country'::text as type,
            c.name,
            c.slug,
            ('/' || c.slug) as url_path
        FROM countries c
        JOIN provinces p ON p.country_code = c.code
        JOIN cities ci ON ci.province_id = p.id
        WHERE c.slug = country_slug_param 
          AND ci.slug = city_slug_param
          
        UNION ALL
        
        SELECT 
            2 as level,
            'city'::text as type,
            ci.name,
            ci.slug,
            ('/' || c.slug || '/' || ci.slug) as url_path
        FROM countries c
        JOIN provinces p ON p.country_code = c.code
        JOIN cities ci ON ci.province_id = p.id
        WHERE c.slug = country_slug_param 
          AND ci.slug = city_slug_param
          
        ORDER BY level;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- ===============================================
-- PERFORMANCE AND MAINTENANCE
-- ===============================================

-- Function to analyze query performance for location-based queries
CREATE OR REPLACE FUNCTION analyze_location_query_performance()
RETURNS TABLE (
    function_name text,
    avg_execution_time_ms numeric,
    call_count bigint,
    last_called timestamptz
) AS $$
BEGIN
    -- This would integrate with pg_stat_statements if available
    -- For now, return placeholder data
    RETURN QUERY
    SELECT 
        'get_country_with_content'::text as function_name,
        0.0::numeric as avg_execution_time_ms,
        0::bigint as call_count,
        now() as last_called
    WHERE false; -- Placeholder - no actual data yet
END;
$$ LANGUAGE plpgsql;

-- ===============================================
-- FUNCTION DOCUMENTATION
-- ===============================================

COMMENT ON FUNCTION get_country_with_content IS 
'Retrieves complete country data with content fields and aggregated statistics for country landing pages';

COMMENT ON FUNCTION get_country_featured_cities IS 
'Gets top cities by motorcycle count for a country, used for featured cities section';

COMMENT ON FUNCTION get_city_with_content IS 
'Retrieves complete city data with content fields and statistics for city landing pages';

COMMENT ON FUNCTION get_shops_by_location IS 
'Gets paginated shop listings for a city with aggregated motorcycle data and flexible sorting';

COMMENT ON FUNCTION get_shops_count_by_location IS 
'Returns total count of shops in a location for pagination calculations';

COMMENT ON FUNCTION get_motorcycles_by_location IS 
'Gets filtered and paginated motorcycle listings for a city with comprehensive filtering options';

COMMENT ON FUNCTION get_motorcycles_count_by_location IS 
'Returns total count of motorcycles in a location with filters for pagination calculations';

COMMENT ON FUNCTION get_location_brands IS 
'Gets available motorcycle brands for a location with counts for filter options';

COMMENT ON FUNCTION get_location_categories IS 
'Gets available motorcycle categories for a location with counts for filter options';

COMMENT ON FUNCTION get_location_price_ranges IS 
'Calculates price statistics and percentiles for motorcycles in a location';

COMMENT ON FUNCTION validate_location_slugs IS 
'Validates country and city slug combinations for URL routing';

COMMENT ON FUNCTION get_location_breadcrumbs IS 
'Generates breadcrumb navigation data for geographic pages';

COMMENT ON FUNCTION analyze_location_query_performance IS 
'Analyzes performance metrics for location-based database queries';