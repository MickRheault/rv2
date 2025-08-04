-- Geographic Statistics Calculation Functions
-- Task 7.1.5: Add geographic statistics calculation functions
--
-- This migration creates advanced statistical calculation functions for geographic
-- analysis, trends, comparisons, and performance metrics

-- ===============================================
-- GEOGRAPHIC MARKET ANALYSIS FUNCTIONS
-- ===============================================

-- Calculate market penetration statistics for a location
CREATE OR REPLACE FUNCTION calculate_market_penetration(country_slug_param text, city_slug_param text DEFAULT NULL)
RETURNS TABLE (
    location_type text,
    location_name text,
    total_population_estimate bigint,
    shops_per_capita numeric,
    motorcycles_per_capita numeric,
    market_density_score numeric,
    competition_level text,
    growth_potential text
) AS $$
DECLARE
    base_population bigint := 100000; -- Base population for calculations
    shop_count bigint;
    motorcycle_count bigint;
    density_score numeric;
BEGIN
    IF city_slug_param IS NULL THEN
        -- Country-level analysis
        SELECT 
            COUNT(DISTINCT rs.id),
            COUNT(DISTINCT mr.id)
        INTO shop_count, motorcycle_count
        FROM countries c
        LEFT JOIN provinces p ON p.country_code = c.code
        LEFT JOIN cities ci ON ci.province_id = p.id
        LEFT JOIN rental_shops rs ON rs.city_id = ci.id AND rs.business_status_id IS NOT NULL
        LEFT JOIN motorcycle_rentals mr ON mr.shop_id = rs.id 
            AND (mr.availability_status IS NULL OR mr.availability_status != 'unavailable')
        WHERE c.slug = country_slug_param;
        
        -- Estimate country population (simplified)
        base_population := base_population * 10; -- Country multiplier
        
        RETURN QUERY
        SELECT 
            'country'::text as location_type,
            c.name as location_name,
            base_population as total_population_estimate,
            ROUND((shop_count::numeric / base_population) * 100000, 2) as shops_per_capita,
            ROUND((motorcycle_count::numeric / base_population) * 100000, 2) as motorcycles_per_capita,
            ROUND(((shop_count + motorcycle_count)::numeric / base_population) * 1000, 2) as market_density_score,
            CASE 
                WHEN shop_count > 50 THEN 'High'
                WHEN shop_count > 20 THEN 'Medium'
                ELSE 'Low'
            END as competition_level,
            CASE 
                WHEN motorcycle_count < 100 THEN 'High'
                WHEN motorcycle_count < 500 THEN 'Medium'
                ELSE 'Low'
            END as growth_potential
        FROM countries c
        WHERE c.slug = country_slug_param;
    ELSE
        -- City-level analysis
        SELECT 
            COUNT(DISTINCT rs.id),
            COUNT(DISTINCT mr.id)
        INTO shop_count, motorcycle_count
        FROM countries c
        JOIN provinces p ON p.country_code = c.code
        JOIN cities ci ON ci.province_id = p.id
        LEFT JOIN rental_shops rs ON rs.city_id = ci.id AND rs.business_status_id IS NOT NULL
        LEFT JOIN motorcycle_rentals mr ON mr.shop_id = rs.id 
            AND (mr.availability_status IS NULL OR mr.availability_status != 'unavailable')
        WHERE c.slug = country_slug_param AND ci.slug = city_slug_param;
        
        RETURN QUERY
        SELECT 
            'city'::text as location_type,
            ci.name as location_name,
            base_population as total_population_estimate,
            ROUND((shop_count::numeric / base_population) * 100000, 2) as shops_per_capita,
            ROUND((motorcycle_count::numeric / base_population) * 100000, 2) as motorcycles_per_capita,
            ROUND(((shop_count + motorcycle_count)::numeric / base_population) * 1000, 2) as market_density_score,
            CASE 
                WHEN shop_count > 10 THEN 'High'
                WHEN shop_count > 5 THEN 'Medium'
                ELSE 'Low'
            END as competition_level,
            CASE 
                WHEN motorcycle_count < 50 THEN 'High'
                WHEN motorcycle_count < 200 THEN 'Medium'
                ELSE 'Low'
            END as growth_potential
        FROM countries c
        JOIN provinces p ON p.country_code = c.code
        JOIN cities ci ON ci.province_id = p.id
        WHERE c.slug = country_slug_param AND ci.slug = city_slug_param;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Calculate pricing analytics for a location
CREATE OR REPLACE FUNCTION calculate_pricing_analytics(country_slug_param text, city_slug_param text DEFAULT NULL)
RETURNS TABLE (
    location_name text,
    total_motorcycles bigint,
    avg_daily_rate numeric,
    median_daily_rate numeric,
    price_std_deviation numeric,
    budget_range_min numeric,
    budget_range_max numeric,
    premium_range_min numeric,
    premium_range_max numeric,
    price_competitiveness_score numeric,
    market_positioning text
) AS $$
DECLARE
    prices numeric[];
    avg_price numeric;
    median_price numeric;
    std_dev numeric;
    price_count bigint;
BEGIN
    -- Get all prices for the location
    IF city_slug_param IS NULL THEN
        -- Country-level pricing
        SELECT 
            array_agg(mr.rental_rate_per_day ORDER BY mr.rental_rate_per_day),
            COUNT(mr.rental_rate_per_day)
        INTO prices, price_count
        FROM countries c
        LEFT JOIN provinces p ON p.country_code = c.code
        LEFT JOIN cities ci ON ci.province_id = p.id
        LEFT JOIN rental_shops rs ON rs.city_id = ci.id AND rs.business_status_id IS NOT NULL
        LEFT JOIN motorcycle_rentals mr ON mr.shop_id = rs.id 
            AND (mr.availability_status IS NULL OR mr.availability_status != 'unavailable')
            AND mr.rental_rate_per_day IS NOT NULL
        WHERE c.slug = country_slug_param;
    ELSE
        -- City-level pricing
        SELECT 
            array_agg(mr.rental_rate_per_day ORDER BY mr.rental_rate_per_day),
            COUNT(mr.rental_rate_per_day)
        INTO prices, price_count
        FROM countries c
        JOIN provinces p ON p.country_code = c.code
        JOIN cities ci ON ci.province_id = p.id
        LEFT JOIN rental_shops rs ON rs.city_id = ci.id AND rs.business_status_id IS NOT NULL
        LEFT JOIN motorcycle_rentals mr ON mr.shop_id = rs.id 
            AND (mr.availability_status IS NULL OR mr.availability_status != 'unavailable')
            AND mr.rental_rate_per_day IS NOT NULL
        WHERE c.slug = country_slug_param AND ci.slug = city_slug_param;
    END IF;

    IF array_length(prices, 1) > 0 THEN
        -- Calculate statistics
        SELECT avg(unnest), stddev(unnest) INTO avg_price, std_dev FROM unnest(prices);
        
        -- Calculate median
        SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY unnest(prices)) INTO median_price;

        RETURN QUERY
        SELECT 
            COALESCE(city_slug_param, country_slug_param) as location_name,
            price_count as total_motorcycles,
            ROUND(avg_price, 2) as avg_daily_rate,
            ROUND(median_price, 2) as median_daily_rate,
            ROUND(std_dev, 2) as price_std_deviation,
            ROUND(prices[1], 2) as budget_range_min,
            ROUND(prices[array_length(prices, 1) / 3], 2) as budget_range_max,
            ROUND(prices[array_length(prices, 1) * 2 / 3], 2) as premium_range_min,
            ROUND(prices[array_length(prices, 1)], 2) as premium_range_max,
            ROUND((median_price / GREATEST(avg_price, 1)) * 100, 2) as price_competitiveness_score,
            CASE 
                WHEN avg_price > median_price * 1.2 THEN 'Premium Market'
                WHEN avg_price < median_price * 0.8 THEN 'Budget Market'
                ELSE 'Balanced Market'
            END as market_positioning;
    ELSE
        RETURN QUERY
        SELECT 
            COALESCE(city_slug_param, country_slug_param) as location_name,
            0::bigint as total_motorcycles,
            0::numeric as avg_daily_rate,
            0::numeric as median_daily_rate,
            0::numeric as price_std_deviation,
            0::numeric as budget_range_min,
            0::numeric as budget_range_max,
            0::numeric as premium_range_min,
            0::numeric as premium_range_max,
            0::numeric as price_competitiveness_score,
            'No Data'::text as market_positioning;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- ===============================================
-- COMPARATIVE ANALYSIS FUNCTIONS
-- ===============================================

-- Compare locations within a country
CREATE OR REPLACE FUNCTION compare_cities_in_country(country_slug_param text, limit_param int DEFAULT 10)
RETURNS TABLE (
    city_name text,
    city_slug text,
    shop_count bigint,
    motorcycle_count bigint,
    avg_daily_rate numeric,
    avg_shop_rating numeric,
    market_share_percentage numeric,
    relative_performance text,
    growth_indicator text
) AS $$
DECLARE
    total_country_motorcycles bigint;
BEGIN
    -- Get total motorcycles in country for market share calculation
    SELECT COUNT(DISTINCT mr.id) INTO total_country_motorcycles
    FROM countries c
    LEFT JOIN provinces p ON p.country_code = c.code
    LEFT JOIN cities ci ON ci.province_id = p.id
    LEFT JOIN rental_shops rs ON rs.city_id = ci.id AND rs.business_status_id IS NOT NULL
    LEFT JOIN motorcycle_rentals mr ON mr.shop_id = rs.id 
        AND (mr.availability_status IS NULL OR mr.availability_status != 'unavailable')
    WHERE c.slug = country_slug_param;

    RETURN QUERY
    SELECT 
        ci.name as city_name,
        ci.slug as city_slug,
        COUNT(DISTINCT rs.id) as shop_count,
        COUNT(DISTINCT mr.id) as motorcycle_count,
        ROUND(AVG(mr.rental_rate_per_day), 2) as avg_daily_rate,
        ROUND(AVG(rs.rating), 2) as avg_shop_rating,
        ROUND((COUNT(DISTINCT mr.id)::numeric / GREATEST(total_country_motorcycles, 1)) * 100, 2) as market_share_percentage,
        CASE 
            WHEN COUNT(DISTINCT mr.id) > (total_country_motorcycles / 10) THEN 'Above Average'
            WHEN COUNT(DISTINCT mr.id) > (total_country_motorcycles / 20) THEN 'Average'
            ELSE 'Below Average'
        END as relative_performance,
        CASE 
            WHEN COUNT(DISTINCT rs.id) > COUNT(DISTINCT mr.id) / 5 THEN 'High Supply'
            WHEN COUNT(DISTINCT rs.id) < COUNT(DISTINCT mr.id) / 10 THEN 'High Demand'
            ELSE 'Balanced'
        END as growth_indicator
    FROM countries c
    JOIN provinces p ON p.country_code = c.code
    JOIN cities ci ON ci.province_id = p.id AND ci.slug IS NOT NULL
    LEFT JOIN rental_shops rs ON rs.city_id = ci.id AND rs.business_status_id IS NOT NULL
    LEFT JOIN motorcycle_rentals mr ON mr.shop_id = rs.id 
        AND (mr.availability_status IS NULL OR mr.availability_status != 'unavailable')
    WHERE c.slug = country_slug_param
    GROUP BY ci.id, ci.name, ci.slug
    HAVING COUNT(DISTINCT mr.id) > 0
    ORDER BY motorcycle_count DESC, city_name
    LIMIT limit_param;
END;
$$ LANGUAGE plpgsql;

-- Calculate brand dominance statistics for a location
CREATE OR REPLACE FUNCTION calculate_brand_dominance(country_slug_param text, city_slug_param text DEFAULT NULL)
RETURNS TABLE (
    brand_name text,
    motorcycle_count bigint,
    market_share_percentage numeric,
    avg_daily_rate numeric,
    price_premium_percentage numeric,
    dominance_level text,
    competitive_position text
) AS $$
DECLARE
    total_motorcycles bigint;
    market_avg_price numeric;
BEGIN
    -- Get totals for percentage calculations
    IF city_slug_param IS NULL THEN
        -- Country-level brand analysis
        SELECT 
            COUNT(DISTINCT mr.id),
            AVG(mr.rental_rate_per_day)
        INTO total_motorcycles, market_avg_price
        FROM countries c
        LEFT JOIN provinces p ON p.country_code = c.code
        LEFT JOIN cities ci ON ci.province_id = p.id
        LEFT JOIN rental_shops rs ON rs.city_id = ci.id AND rs.business_status_id IS NOT NULL
        LEFT JOIN motorcycle_rentals mr ON mr.shop_id = rs.id 
            AND (mr.availability_status IS NULL OR mr.availability_status != 'unavailable')
        WHERE c.slug = country_slug_param;
    ELSE
        -- City-level brand analysis
        SELECT 
            COUNT(DISTINCT mr.id),
            AVG(mr.rental_rate_per_day)
        INTO total_motorcycles, market_avg_price
        FROM countries c
        JOIN provinces p ON p.country_code = c.code
        JOIN cities ci ON ci.province_id = p.id
        LEFT JOIN rental_shops rs ON rs.city_id = ci.id AND rs.business_status_id IS NOT NULL
        LEFT JOIN motorcycle_rentals mr ON mr.shop_id = rs.id 
            AND (mr.availability_status IS NULL OR mr.availability_status != 'unavailable')
        WHERE c.slug = country_slug_param AND ci.slug = city_slug_param;
    END IF;

    IF city_slug_param IS NULL THEN
        -- Country-level results
        RETURN QUERY
        SELECT 
            b.name as brand_name,
            COUNT(DISTINCT mr.id) as motorcycle_count,
            ROUND((COUNT(DISTINCT mr.id)::numeric / GREATEST(total_motorcycles, 1)) * 100, 2) as market_share_percentage,
            ROUND(AVG(mr.rental_rate_per_day), 2) as avg_daily_rate,
            ROUND(((AVG(mr.rental_rate_per_day) / GREATEST(market_avg_price, 1)) - 1) * 100, 2) as price_premium_percentage,
            CASE 
                WHEN COUNT(DISTINCT mr.id) > (total_motorcycles * 0.3) THEN 'Dominant'
                WHEN COUNT(DISTINCT mr.id) > (total_motorcycles * 0.15) THEN 'Strong'
                WHEN COUNT(DISTINCT mr.id) > (total_motorcycles * 0.05) THEN 'Moderate'
                ELSE 'Niche'
            END as dominance_level,
            CASE 
                WHEN AVG(mr.rental_rate_per_day) > market_avg_price * 1.2 THEN 'Premium'
                WHEN AVG(mr.rental_rate_per_day) < market_avg_price * 0.8 THEN 'Budget'
                ELSE 'Mainstream'
            END as competitive_position
        FROM countries c
        LEFT JOIN provinces p ON p.country_code = c.code
        LEFT JOIN cities ci ON ci.province_id = p.id
        LEFT JOIN rental_shops rs ON rs.city_id = ci.id AND rs.business_status_id IS NOT NULL
        LEFT JOIN motorcycle_rentals mr ON mr.shop_id = rs.id 
            AND (mr.availability_status IS NULL OR mr.availability_status != 'unavailable')
        LEFT JOIN brands b ON mr.brand_id = b.id
        WHERE c.slug = country_slug_param AND b.name IS NOT NULL
        GROUP BY b.id, b.name
        HAVING COUNT(DISTINCT mr.id) > 0
        ORDER BY motorcycle_count DESC, b.name;
    ELSE
        -- City-level results
        RETURN QUERY
        SELECT 
            b.name as brand_name,
            COUNT(DISTINCT mr.id) as motorcycle_count,
            ROUND((COUNT(DISTINCT mr.id)::numeric / GREATEST(total_motorcycles, 1)) * 100, 2) as market_share_percentage,
            ROUND(AVG(mr.rental_rate_per_day), 2) as avg_daily_rate,
            ROUND(((AVG(mr.rental_rate_per_day) / GREATEST(market_avg_price, 1)) - 1) * 100, 2) as price_premium_percentage,
            CASE 
                WHEN COUNT(DISTINCT mr.id) > (total_motorcycles * 0.3) THEN 'Dominant'
                WHEN COUNT(DISTINCT mr.id) > (total_motorcycles * 0.15) THEN 'Strong'
                WHEN COUNT(DISTINCT mr.id) > (total_motorcycles * 0.05) THEN 'Moderate'
                ELSE 'Niche'
            END as dominance_level,
            CASE 
                WHEN AVG(mr.rental_rate_per_day) > market_avg_price * 1.2 THEN 'Premium'
                WHEN AVG(mr.rental_rate_per_day) < market_avg_price * 0.8 THEN 'Budget'
                ELSE 'Mainstream'
            END as competitive_position
        FROM countries c
        JOIN provinces p ON p.country_code = c.code
        JOIN cities ci ON ci.province_id = p.id
        LEFT JOIN rental_shops rs ON rs.city_id = ci.id AND rs.business_status_id IS NOT NULL
        LEFT JOIN motorcycle_rentals mr ON mr.shop_id = rs.id 
            AND (mr.availability_status IS NULL OR mr.availability_status != 'unavailable')
        LEFT JOIN brands b ON mr.brand_id = b.id
        WHERE c.slug = country_slug_param AND ci.slug = city_slug_param AND b.name IS NOT NULL
        GROUP BY b.id, b.name
        HAVING COUNT(DISTINCT mr.id) > 0
        ORDER BY motorcycle_count DESC, b.name;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- ===============================================
-- TREND ANALYSIS FUNCTIONS
-- ===============================================

-- Calculate seasonal trends (simplified - based on creation dates)
CREATE OR REPLACE FUNCTION calculate_seasonal_trends(country_slug_param text, city_slug_param text DEFAULT NULL)
RETURNS TABLE (
    month_name text,
    month_number int,
    new_shops_count bigint,
    new_motorcycles_count bigint,
    avg_monthly_growth_rate numeric,
    seasonal_trend text
) AS $$
BEGIN
    IF city_slug_param IS NULL THEN
        -- Country-level seasonal analysis
        RETURN QUERY
        SELECT 
            to_char(date_trunc('month', rs.created_at), 'Month') as month_name,
            EXTRACT(MONTH FROM rs.created_at)::int as month_number,
            COUNT(DISTINCT rs.id) as new_shops_count,
            COUNT(DISTINCT mr.id) as new_motorcycles_count,
            ROUND(
                (COUNT(DISTINCT mr.id)::numeric / GREATEST(COUNT(DISTINCT rs.id), 1)) * 100, 2
            ) as avg_monthly_growth_rate,
            CASE 
                WHEN COUNT(DISTINCT mr.id) > AVG(COUNT(DISTINCT mr.id)) OVER() * 1.2 THEN 'Peak Season'
                WHEN COUNT(DISTINCT mr.id) < AVG(COUNT(DISTINCT mr.id)) OVER() * 0.8 THEN 'Low Season'
                ELSE 'Regular Season'
            END as seasonal_trend
        FROM countries c
        LEFT JOIN provinces p ON p.country_code = c.code
        LEFT JOIN cities ci ON ci.province_id = p.id
        LEFT JOIN rental_shops rs ON rs.city_id = ci.id AND rs.business_status_id IS NOT NULL
        LEFT JOIN motorcycle_rentals mr ON mr.shop_id = rs.id 
            AND (mr.availability_status IS NULL OR mr.availability_status != 'unavailable')
        WHERE c.slug = country_slug_param
          AND rs.created_at >= (CURRENT_DATE - INTERVAL '12 months')
        GROUP BY EXTRACT(MONTH FROM rs.created_at), to_char(date_trunc('month', rs.created_at), 'Month')
        ORDER BY month_number;
    ELSE
        -- City-level seasonal analysis
        RETURN QUERY
        SELECT 
            to_char(date_trunc('month', rs.created_at), 'Month') as month_name,
            EXTRACT(MONTH FROM rs.created_at)::int as month_number,
            COUNT(DISTINCT rs.id) as new_shops_count,
            COUNT(DISTINCT mr.id) as new_motorcycles_count,
            ROUND(
                (COUNT(DISTINCT mr.id)::numeric / GREATEST(COUNT(DISTINCT rs.id), 1)) * 100, 2
            ) as avg_monthly_growth_rate,
            CASE 
                WHEN COUNT(DISTINCT mr.id) > AVG(COUNT(DISTINCT mr.id)) OVER() * 1.2 THEN 'Peak Season'
                WHEN COUNT(DISTINCT mr.id) < AVG(COUNT(DISTINCT mr.id)) OVER() * 0.8 THEN 'Low Season'
                ELSE 'Regular Season'
            END as seasonal_trend
        FROM countries c
        JOIN provinces p ON p.country_code = c.code
        JOIN cities ci ON ci.province_id = p.id
        LEFT JOIN rental_shops rs ON rs.city_id = ci.id AND rs.business_status_id IS NOT NULL
        LEFT JOIN motorcycle_rentals mr ON mr.shop_id = rs.id 
            AND (mr.availability_status IS NULL OR mr.availability_status != 'unavailable')
        WHERE c.slug = country_slug_param AND ci.slug = city_slug_param
          AND rs.created_at >= (CURRENT_DATE - INTERVAL '12 months')
        GROUP BY EXTRACT(MONTH FROM rs.created_at), to_char(date_trunc('month', rs.created_at), 'Month')
        ORDER BY month_number;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- ===============================================
-- PERFORMANCE METRICS FUNCTIONS
-- ===============================================

-- Calculate location performance score
CREATE OR REPLACE FUNCTION calculate_location_performance_score(country_slug_param text, city_slug_param text DEFAULT NULL)
RETURNS TABLE (
    location_name text,
    location_type text,
    overall_score numeric,
    market_size_score numeric,
    competition_score numeric,
    pricing_score numeric,
    quality_score numeric,
    diversity_score numeric,
    performance_tier text,
    key_strengths text[],
    improvement_areas text[]
) AS $$
DECLARE
    shop_count bigint;
    motorcycle_count bigint;
    brand_count bigint;
    category_count bigint;
    avg_rating numeric;
    avg_price numeric;
    price_variance numeric;
    loc_name text;
    loc_type text;
BEGIN
    -- Get base metrics
    IF city_slug_param IS NULL THEN
        -- Country-level metrics
        SELECT 
            c.name,
            COUNT(DISTINCT rs.id),
            COUNT(DISTINCT mr.id),
            COUNT(DISTINCT mr.brand_id),
            COUNT(DISTINCT mr.category_id),
            AVG(rs.rating),
            AVG(mr.rental_rate_per_day),
            STDDEV(mr.rental_rate_per_day)
        INTO loc_name, shop_count, motorcycle_count, brand_count, category_count, 
             avg_rating, avg_price, price_variance
        FROM countries c
        LEFT JOIN provinces p ON p.country_code = c.code
        LEFT JOIN cities ci ON ci.province_id = p.id
        LEFT JOIN rental_shops rs ON rs.city_id = ci.id AND rs.business_status_id IS NOT NULL
        LEFT JOIN motorcycle_rentals mr ON mr.shop_id = rs.id 
            AND (mr.availability_status IS NULL OR mr.availability_status != 'unavailable')
        WHERE c.slug = country_slug_param
        GROUP BY c.name;
        
        loc_type := 'country';
    ELSE
        -- City-level metrics
        SELECT 
            ci.name,
            COUNT(DISTINCT rs.id),
            COUNT(DISTINCT mr.id),
            COUNT(DISTINCT mr.brand_id),
            COUNT(DISTINCT mr.category_id),
            AVG(rs.rating),
            AVG(mr.rental_rate_per_day),
            STDDEV(mr.rental_rate_per_day)
        INTO loc_name, shop_count, motorcycle_count, brand_count, category_count, 
             avg_rating, avg_price, price_variance
        FROM countries c
        JOIN provinces p ON p.country_code = c.code
        JOIN cities ci ON ci.province_id = p.id
        LEFT JOIN rental_shops rs ON rs.city_id = ci.id AND rs.business_status_id IS NOT NULL
        LEFT JOIN motorcycle_rentals mr ON mr.shop_id = rs.id 
            AND (mr.availability_status IS NULL OR mr.availability_status != 'unavailable')
        WHERE c.slug = country_slug_param AND ci.slug = city_slug_param
        GROUP BY ci.name;
        
        loc_type := 'city';
    END IF;

    -- Calculate component scores (0-100 scale)
    DECLARE
        market_score numeric := LEAST((motorcycle_count::numeric / 100) * 100, 100);
        comp_score numeric := LEAST((shop_count::numeric / 20) * 100, 100);
        price_score numeric := CASE 
            WHEN avg_price IS NULL THEN 0
            WHEN price_variance < avg_price * 0.2 THEN 100 -- Low variance is good
            WHEN price_variance < avg_price * 0.5 THEN 70
            ELSE 40
        END;
        qual_score numeric := COALESCE((avg_rating / 5.0) * 100, 50);
        div_score numeric := LEAST(((brand_count + category_count)::numeric / 20) * 100, 100);
        overall numeric;
        tier text;
        strengths text[] := ARRAY[]::text[];
        improvements text[] := ARRAY[]::text[];
    BEGIN
        -- Calculate overall score (weighted average)
        overall := ROUND(
            (market_score * 0.3 + comp_score * 0.2 + price_score * 0.2 + qual_score * 0.2 + div_score * 0.1), 2
        );

        -- Determine performance tier
        tier := CASE 
            WHEN overall >= 80 THEN 'Excellent'
            WHEN overall >= 60 THEN 'Good'
            WHEN overall >= 40 THEN 'Fair'
            ELSE 'Needs Improvement'
        END;

        -- Identify strengths and improvement areas
        IF market_score >= 70 THEN strengths := array_append(strengths, 'Strong Market Size'); END IF;
        IF comp_score >= 70 THEN strengths := array_append(strengths, 'Good Competition Level'); END IF;
        IF price_score >= 70 THEN strengths := array_append(strengths, 'Stable Pricing'); END IF;
        IF qual_score >= 70 THEN strengths := array_append(strengths, 'High Quality Ratings'); END IF;
        IF div_score >= 70 THEN strengths := array_append(strengths, 'Good Diversity'); END IF;

        IF market_score < 50 THEN improvements := array_append(improvements, 'Expand Market Size'); END IF;
        IF comp_score < 50 THEN improvements := array_append(improvements, 'Increase Competition'); END IF;
        IF price_score < 50 THEN improvements := array_append(improvements, 'Stabilize Pricing'); END IF;
        IF qual_score < 50 THEN improvements := array_append(improvements, 'Improve Quality'); END IF;
        IF div_score < 50 THEN improvements := array_append(improvements, 'Increase Diversity'); END IF;

        RETURN QUERY
        SELECT 
            loc_name as location_name,
            loc_type as location_type,
            overall as overall_score,
            ROUND(market_score, 2) as market_size_score,
            ROUND(comp_score, 2) as competition_score,
            ROUND(price_score, 2) as pricing_score,
            ROUND(qual_score, 2) as quality_score,
            ROUND(div_score, 2) as diversity_score,
            tier as performance_tier,
            strengths as key_strengths,
            improvements as improvement_areas;
    END;
END;
$$ LANGUAGE plpgsql;

-- ===============================================
-- SUMMARY DASHBOARD FUNCTIONS
-- ===============================================

-- Generate comprehensive location summary for dashboards
CREATE OR REPLACE FUNCTION generate_location_summary(country_slug_param text, city_slug_param text DEFAULT NULL)
RETURNS TABLE (
    summary_type text,
    location_name text,
    key_metrics jsonb,
    market_insights jsonb,
    competitive_analysis jsonb,
    recommendations jsonb,
    last_updated timestamptz
) AS $$
DECLARE
    metrics jsonb;
    insights jsonb;
    competition jsonb;
    recommendations jsonb;
    loc_name text;
    summary_type_val text;
BEGIN
    -- Determine location name and type
    IF city_slug_param IS NULL THEN
        SELECT name INTO loc_name FROM countries WHERE slug = country_slug_param;
        summary_type_val := 'country';
    ELSE
        SELECT ci.name INTO loc_name 
        FROM countries c
        JOIN provinces p ON p.country_code = c.code
        JOIN cities ci ON ci.province_id = p.id
        WHERE c.slug = country_slug_param AND ci.slug = city_slug_param;
        summary_type_val := 'city';
    END IF;

    -- Build key metrics
    SELECT jsonb_build_object(
        'shops', COUNT(DISTINCT rs.id),
        'motorcycles', COUNT(DISTINCT mr.id),
        'brands', COUNT(DISTINCT mr.brand_id),
        'categories', COUNT(DISTINCT mr.category_id),
        'avg_rating', ROUND(AVG(rs.rating), 2),
        'avg_price', ROUND(AVG(mr.rental_rate_per_day), 2),
        'price_range', jsonb_build_object(
            'min', MIN(mr.rental_rate_per_day),
            'max', MAX(mr.rental_rate_per_day)
        )
    ) INTO metrics
    FROM countries c
    LEFT JOIN provinces p ON p.country_code = c.code
    LEFT JOIN cities ci ON ci.province_id = p.id
    LEFT JOIN rental_shops rs ON rs.city_id = ci.id AND rs.business_status_id IS NOT NULL
    LEFT JOIN motorcycle_rentals mr ON mr.shop_id = rs.id 
        AND (mr.availability_status IS NULL OR mr.availability_status != 'unavailable')
    WHERE c.slug = country_slug_param 
      AND (city_slug_param IS NULL OR ci.slug = city_slug_param);

    -- Build market insights
    insights := jsonb_build_object(
        'market_maturity', CASE 
            WHEN (metrics->>'motorcycles')::int > 100 THEN 'Mature'
            WHEN (metrics->>'motorcycles')::int > 50 THEN 'Growing'
            ELSE 'Emerging'
        END,
        'competition_level', CASE 
            WHEN (metrics->>'shops')::int > 20 THEN 'High'
            WHEN (metrics->>'shops')::int > 10 THEN 'Medium'
            ELSE 'Low'
        END,
        'price_positioning', CASE 
            WHEN (metrics->>'avg_price')::numeric > 100 THEN 'Premium'
            WHEN (metrics->>'avg_price')::numeric > 50 THEN 'Mid-range'
            ELSE 'Budget'
        END
    );

    -- Build competitive analysis
    competition := jsonb_build_object(
        'market_concentration', CASE 
            WHEN (metrics->>'brands')::int < 5 THEN 'High'
            WHEN (metrics->>'brands')::int < 10 THEN 'Medium'
            ELSE 'Low'
        END,
        'diversity_score', LEAST(((metrics->>'brands')::int + (metrics->>'categories')::int)::numeric / 20 * 100, 100),
        'quality_level', CASE 
            WHEN (metrics->>'avg_rating')::numeric >= 4.0 THEN 'High'
            WHEN (metrics->>'avg_rating')::numeric >= 3.0 THEN 'Medium'
            ELSE 'Low'
        END
    );

    -- Build recommendations
    recommendations := jsonb_build_array(
        CASE 
            WHEN (metrics->>'motorcycles')::int < 20 THEN 'Focus on market expansion'
            WHEN (metrics->>'shops')::int < 5 THEN 'Encourage more shop participation'
            WHEN (metrics->>'avg_rating')::numeric < 3.5 THEN 'Improve service quality'
            ELSE 'Maintain current growth trajectory'
        END,
        CASE 
            WHEN (metrics->>'brands')::int < 5 THEN 'Diversify brand portfolio'
            WHEN (competition->>'market_concentration') = 'High' THEN 'Promote competition'
            ELSE 'Optimize pricing strategies'
        END
    );

    RETURN QUERY
    SELECT 
        summary_type_val as summary_type,
        loc_name as location_name,
        metrics as key_metrics,
        insights as market_insights,
        competition as competitive_analysis,
        recommendations as recommendations,
        now() as last_updated;
END;
$$ LANGUAGE plpgsql;

-- ===============================================
-- FUNCTION DOCUMENTATION
-- ===============================================

COMMENT ON FUNCTION calculate_market_penetration IS 
'Calculates market penetration metrics including density scores and growth potential for geographic locations';

COMMENT ON FUNCTION calculate_pricing_analytics IS 
'Provides comprehensive pricing analysis including median, standard deviation, and market positioning';

COMMENT ON FUNCTION compare_cities_in_country IS 
'Compares performance metrics across cities within a country for competitive analysis';

COMMENT ON FUNCTION calculate_brand_dominance IS 
'Analyzes brand market share and competitive positioning within geographic locations';

COMMENT ON FUNCTION calculate_seasonal_trends IS 
'Identifies seasonal patterns in business growth and market activity';

COMMENT ON FUNCTION calculate_location_performance_score IS 
'Generates comprehensive performance scores with strengths and improvement recommendations';

COMMENT ON FUNCTION generate_location_summary IS 
'Creates executive summary dashboard data for geographic locations with key insights and recommendations';