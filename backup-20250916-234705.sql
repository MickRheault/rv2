

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA "pg_catalog";








ALTER SCHEMA "public" OWNER TO "postgres";


CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgjwt" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "unaccent" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."app_permission" AS ENUM (
    'content.moderate',
    'premium.manage',
    'analytics.view',
    'system.manage'
);


ALTER TYPE "public"."app_permission" OWNER TO "postgres";


CREATE TYPE "public"."app_role" AS ENUM (
    'admin',
    'user'
);


ALTER TYPE "public"."app_role" OWNER TO "postgres";


CREATE TYPE "public"."content_type" AS ENUM (
    'motorcycle',
    'rental_shop',
    'motorcycle_feature',
    'motorcycle_condition',
    'motorcycle_insurance',
    'rental_shop_inclusion',
    'rental_shop_tour'
);


ALTER TYPE "public"."content_type" OWNER TO "postgres";


CREATE TYPE "public"."flag_category" AS ENUM (
    'incorrect_info',
    'outdated_info',
    'missing_info',
    'inappropriate_content',
    'pricing_error',
    'contact_error',
    'location_error',
    'specification_error',
    'availability_error',
    'other'
);


ALTER TYPE "public"."flag_category" OWNER TO "postgres";


CREATE TYPE "public"."flag_status" AS ENUM (
    'pending',
    'under_review',
    'approved',
    'rejected',
    'applied'
);


ALTER TYPE "public"."flag_status" OWNER TO "postgres";


CREATE TYPE "public"."freshness_content_type" AS ENUM (
    'motorcycle',
    'rental_shop'
);


ALTER TYPE "public"."freshness_content_type" OWNER TO "postgres";


CREATE TYPE "public"."freshness_status" AS ENUM (
    'fresh',
    'stale',
    'very_stale'
);


ALTER TYPE "public"."freshness_status" OWNER TO "postgres";


CREATE TYPE "public"."premium_content_type" AS ENUM (
    'motorcycle',
    'rental_shop'
);


ALTER TYPE "public"."premium_content_type" OWNER TO "postgres";


CREATE TYPE "public"."premium_metric_type" AS ENUM (
    'views',
    'clicks',
    'inquiries',
    'conversions',
    'favorites'
);


ALTER TYPE "public"."premium_metric_type" OWNER TO "postgres";


CREATE TYPE "public"."premium_status" AS ENUM (
    'active',
    'expired',
    'paused',
    'cancelled'
);


ALTER TYPE "public"."premium_status" OWNER TO "postgres";


CREATE TYPE "public"."premium_tier" AS ENUM (
    'gold',
    'platinum',
    'featured'
);


ALTER TYPE "public"."premium_tier" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."apply_flagged_content_changes"("flagged_content_id" "uuid", "admin_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
DECLARE
  flag_record RECORD;
  update_query TEXT;
  field_name TEXT;
  field_value TEXT;
  table_name TEXT;
  success BOOLEAN DEFAULT false;
BEGIN
  -- Get the flagged content record
  SELECT * INTO flag_record FROM flagged_content 
  WHERE id = flagged_content_id AND status = 'approved';
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Flagged content not found or not approved';
  END IF;
  
  -- Determine target table based on content type
  table_name := CASE flag_record.content_type
    WHEN 'motorcycle' THEN 'motorcycle_rentals'
    WHEN 'rental_shop' THEN 'rental_shops'
    ELSE NULL
  END;
  
  IF table_name IS NULL THEN
    RAISE EXCEPTION 'Unsupported content type: %', flag_record.content_type;
  END IF;
  
  -- Build dynamic update query for top-level fields
  update_query := 'UPDATE ' || table_name || ' SET ';
  
  -- Add each field from proposed_data
  FOR field_name IN SELECT jsonb_object_keys(flag_record.proposed_data)
  LOOP
    field_value := flag_record.proposed_data ->> field_name;
    
    -- Skip certain fields that shouldn't be directly updated
    IF field_name NOT IN ('id', 'created_at', 'updated_at') THEN
      update_query := update_query || field_name || ' = ' || quote_literal(field_value) || ', ';
    END IF;
  END LOOP;
  
  -- Remove trailing comma and add WHERE clause
  update_query := rtrim(update_query, ', ');
  update_query := update_query || ', updated_at = NOW()';
  update_query := update_query || ' WHERE id = ' || quote_literal(flag_record.entity_id);
  
  -- Execute the update
  EXECUTE update_query;
  
  -- Update the flagged content status
  UPDATE flagged_content 
  SET 
    status = 'applied',
    applied_by_admin_id = admin_id,
    applied_at = NOW()
  WHERE id = flagged_content_id;
  
  success := true;
  RETURN success;
  
EXCEPTION
  WHEN OTHERS THEN
    -- Log error and return false
    RAISE WARNING 'Error applying flagged content changes: %', SQLERRM;
    RETURN false;
END;
$$;


ALTER FUNCTION "public"."apply_flagged_content_changes"("flagged_content_id" "uuid", "admin_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."authorize"("requested_permission" "public"."app_permission") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    AS $$
DECLARE
  bind_permissions int;
  user_role public.app_role;
BEGIN
  -- Fetch user role from JWT token
  SELECT (auth.jwt() ->> 'user_role')::public.app_role INTO user_role;

  -- Count matching permissions for the user's role
  SELECT count(*)
  INTO bind_permissions
  FROM public.role_permissions
  WHERE role_permissions.permission = requested_permission
    AND role_permissions.role = user_role;

  RETURN bind_permissions > 0;
END;
$$;


ALTER FUNCTION "public"."authorize"("requested_permission" "public"."app_permission") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calculate_freshness_status"("days_since_update" integer) RETURNS "public"."freshness_status"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
    -- Fresh: 0-3 months (90 days)
    IF days_since_update <= 90 THEN
        RETURN 'fresh'::freshness_status;
    -- Stale: 3-6 months (91-180 days)
    ELSIF days_since_update <= 180 THEN
        RETURN 'stale'::freshness_status;
    -- Very Stale: 6+ months (181+ days)
    ELSE
        RETURN 'very_stale'::freshness_status;
    END IF;
END;
$$;


ALTER FUNCTION "public"."calculate_freshness_status"("days_since_update" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."calculate_freshness_status"("days_since_update" integer) IS 'Calculates freshness status: fresh (0-90 days), stale (91-180 days), very_stale (181+ days)';



CREATE OR REPLACE FUNCTION "public"."capture_daily_analytics_snapshot"() RETURNS "jsonb"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
DECLARE
  v_overview_stats jsonb;
  v_data_freshness_stats jsonb;
  v_flagged_content_stats_raw jsonb;
  v_flagged_content_stats_transformed jsonb;
  v_premium_listings_stats jsonb;
  v_geographic_dist jsonb;
  v_category_dist jsonb;
  v_brand_dist jsonb;
  v_final_snapshot jsonb;
BEGIN
  -- 1. Overview Stats (as an array of objects for consistency)
  SELECT jsonb_build_array(
    jsonb_build_object('label', 'Total Rental Shops', 'value', (SELECT count(*) FROM public.rental_shops)),
    jsonb_build_object('label', 'Total Motorcycles', 'value', (SELECT count(*) FROM public.motorcycle_rentals)),
    jsonb_build_object('label', 'Total Brands', 'value', (SELECT count(*) FROM public.brands)),
    jsonb_build_object('label', 'Total Categories', 'value', (SELECT count(*) FROM public.categories))
  ) INTO v_overview_stats;

  -- 2. Data Freshness, Raw Flagged Content, and Premium Listings Stats
  SELECT to_jsonb(s) INTO v_data_freshness_stats FROM get_data_freshness_stats() s;
  SELECT to_jsonb(s) INTO v_flagged_content_stats_raw FROM get_flagged_content_stats() s;
  SELECT to_jsonb(s) INTO v_premium_listings_stats FROM get_premium_dashboard_stats() s;

  -- 3. Transform Flagged Content to match AnalyticsData type
  SELECT jsonb_build_object(
      'total', (
          COALESCE((v_flagged_content_stats_raw->>'total_pending')::numeric, 0) +
          COALESCE((v_flagged_content_stats_raw->>'total_under_review')::numeric, 0) +
          COALESCE((v_flagged_content_stats_raw->>'total_approved')::numeric, 0) +
          COALESCE((v_flagged_content_stats_raw->>'total_applied')::numeric, 0) +
          COALESCE((v_flagged_content_stats_raw->>'total_rejected')::numeric, 0)
      ),
      'motorcycles', '[]'::jsonb,
      'shops', '[]'::jsonb
  ) INTO v_flagged_content_stats_transformed;

  -- 4. Distributions
  SELECT jsonb_agg(s) INTO v_geographic_dist FROM get_geographic_distribution() s;
  SELECT jsonb_agg(s) INTO v_category_dist FROM get_category_distribution() s;
  SELECT jsonb_agg(s) INTO v_brand_dist FROM get_brand_distribution() s;

  -- 5. Combine all stats into the final snapshot object
  SELECT jsonb_build_object(
    'overviewStats', v_overview_stats,
    'dataFreshness', v_data_freshness_stats,
    'flaggedContent', v_flagged_content_stats_transformed,
    'premiumListings', v_premium_listings_stats,
    'geographicDistribution', v_geographic_dist,
    'categoryDistribution', v_category_dist,
    'brandDistribution', v_brand_dist
  ) INTO v_final_snapshot;

  RETURN v_final_snapshot;
END;
$$;


ALTER FUNCTION "public"."capture_daily_analytics_snapshot"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."clear_all_data"() RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
    -- Truncate tables. Using CASCADE handles Foreign Key dependencies automatically.
    -- RESTART IDENTITY resets any sequences (like SERIAL columns).
    -- Ensure the database role running this has TRUNCATE privileges.

    RAISE NOTICE 'Attempting to truncate all seed-related tables...';

    TRUNCATE TABLE
        public.rental_rate_tiers,       -- Assuming 'public' schema
        public.motorcycle_insurance_details,
        public.motorcycle_images,
        public.motorcycle_conditions,
        public.motorcycle_required_documents,
        public.motorcycle_features,
        public.motorcycle_rentals,
        public.images,
        public.rental_shops,
        public.cities,
        public.provinces,
        public.countries,
        public.business_statuses,
        public.brands,
        public.categories,
        public.features,
        public.required_document_types,
        public.insurance_types,
        public.condition_types
    RESTART IDENTITY CASCADE;

    RAISE NOTICE 'Finished truncating tables.';
END;
$$;


ALTER FUNCTION "public"."clear_all_data"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."custom_access_token_hook"("event" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE
    AS $$
DECLARE
  claims jsonb;
  user_role public.app_role;
BEGIN
  -- Fetch the user role from user_roles table
  SELECT role INTO user_role 
  FROM public.user_roles 
  WHERE user_id = (event->>'user_id')::uuid
  LIMIT 1; -- Get first role if multiple exist

  claims := event->'claims';

  IF user_role IS NOT NULL THEN
    -- Set the user_role claim in JWT
    claims := jsonb_set(claims, '{user_role}', to_jsonb(user_role));
  ELSE
    -- Default to 'user' role if no role assigned
    claims := jsonb_set(claims, '{user_role}', '"user"');
  END IF;

  -- Update the 'claims' object in the original event
  event := jsonb_set(event, '{claims}', claims);

  -- Return the modified event
  RETURN event;
END;
$$;


ALTER FUNCTION "public"."custom_access_token_hook"("event" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."expire_premium_listings"() RETURNS integer
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
DECLARE
    expired_count INTEGER;
BEGIN
    UPDATE premium_listings
    SET status = 'expired',
        updated_at = now()
    WHERE status = 'active' 
      AND end_date < CURRENT_DATE;
    
    GET DIAGNOSTICS expired_count = ROW_COUNT;
    RETURN expired_count;
END;
$$;


ALTER FUNCTION "public"."expire_premium_listings"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_slug"("text") RETURNS "text"
    LANGUAGE "plpgsql" IMMUTABLE
    AS $_$
BEGIN
  -- Simple slug generation without external dependencies
  RETURN lower(
    regexp_replace(
      regexp_replace(
        regexp_replace($1, '[^a-zA-Z0-9\s]', '', 'g'),
        '\s+', '-', 'g'
      ),
      '-+', '-', 'g'
    )
  );
END;
$_$;


ALTER FUNCTION "public"."generate_slug"("text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_brand_distribution"() RETURNS TABLE("brand" "text", "count" bigint, "avg_price" numeric, "avg_engine_size" numeric)
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    b.name AS brand,
    count(mr.id) AS count,
    avg(mr.rental_rate_per_day)::NUMERIC(10, 2) AS avg_price,
    avg(mr.engine_capacity_cc)::NUMERIC(10, 0) AS avg_engine_size
  FROM motorcycle_rentals mr
  JOIN brands b ON mr.brand_id = b.id
  GROUP BY b.name
  ORDER BY count DESC;
END;
$$;


ALTER FUNCTION "public"."get_brand_distribution"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_category_distribution"() RETURNS TABLE("category" "text", "count" bigint, "avg_price" numeric, "avg_engine_size" numeric)
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.name AS category,
    count(mr.id) AS count,
    avg(mr.rental_rate_per_day)::NUMERIC(10, 2) AS avg_price,
    avg(mr.engine_capacity_cc)::NUMERIC(10, 0) AS avg_engine_size
  FROM motorcycle_rentals mr
  JOIN categories c ON mr.category_id = c.id
  GROUP BY c.name
  ORDER BY count DESC;
END;
$$;


ALTER FUNCTION "public"."get_category_distribution"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_data_freshness_stats"() RETURNS TABLE("total_entities" integer, "fresh_entities" integer, "stale_entities" integer, "very_stale_entities" integer, "fresh_percentage" numeric, "stale_percentage" numeric, "very_stale_percentage" numeric, "motorcycle_fresh" integer, "motorcycle_stale" integer, "motorcycle_very_stale" integer, "shop_fresh" integer, "shop_stale" integer, "shop_very_stale" integer, "oldest_motorcycle_days" integer, "oldest_shop_days" integer)
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
DECLARE
    _total INTEGER;
    _fresh INTEGER;
    _stale INTEGER;
    _very_stale INTEGER;
BEGIN
    -- Get overall counts
    SELECT COUNT(*) INTO _total FROM data_freshness;
    SELECT COUNT(*) INTO _fresh FROM data_freshness WHERE freshness_status = 'fresh';
    SELECT COUNT(*) INTO _stale FROM data_freshness WHERE freshness_status = 'stale';
    SELECT COUNT(*) INTO _very_stale FROM data_freshness WHERE freshness_status = 'very_stale';

    RETURN QUERY
    SELECT 
        _total as total_entities,
        _fresh as fresh_entities,
        _stale as stale_entities,
        _very_stale as very_stale_entities,
        CASE WHEN _total > 0 THEN ROUND((_fresh::DECIMAL / _total) * 100, 2) ELSE 0 END as fresh_percentage,
        CASE WHEN _total > 0 THEN ROUND((_stale::DECIMAL / _total) * 100, 2) ELSE 0 END as stale_percentage,
        CASE WHEN _total > 0 THEN ROUND((_very_stale::DECIMAL / _total) * 100, 2) ELSE 0 END as very_stale_percentage,
        (SELECT COUNT(*) FROM data_freshness WHERE content_type = 'motorcycle' AND freshness_status = 'fresh')::INTEGER as motorcycle_fresh,
        (SELECT COUNT(*) FROM data_freshness WHERE content_type = 'motorcycle' AND freshness_status = 'stale')::INTEGER as motorcycle_stale,
        (SELECT COUNT(*) FROM data_freshness WHERE content_type = 'motorcycle' AND freshness_status = 'very_stale')::INTEGER as motorcycle_very_stale,
        (SELECT COUNT(*) FROM data_freshness WHERE content_type = 'rental_shop' AND freshness_status = 'fresh')::INTEGER as shop_fresh,
        (SELECT COUNT(*) FROM data_freshness WHERE content_type = 'rental_shop' AND freshness_status = 'stale')::INTEGER as shop_stale,
        (SELECT COUNT(*) FROM data_freshness WHERE content_type = 'rental_shop' AND freshness_status = 'very_stale')::INTEGER as shop_very_stale,
        COALESCE((SELECT MAX(days_since_update) FROM data_freshness WHERE content_type = 'motorcycle'), 0)::INTEGER as oldest_motorcycle_days,
        COALESCE((SELECT MAX(days_since_update) FROM data_freshness WHERE content_type = 'rental_shop'), 0)::INTEGER as oldest_shop_days;
END;
$$;


ALTER FUNCTION "public"."get_data_freshness_stats"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_data_freshness_stats"() IS 'Returns comprehensive data freshness statistics for admin dashboard';



CREATE OR REPLACE FUNCTION "public"."get_entities_by_freshness"("p_content_type" "public"."freshness_content_type" DEFAULT NULL::"public"."freshness_content_type", "p_freshness_status" "public"."freshness_status" DEFAULT NULL::"public"."freshness_status", "p_limit" integer DEFAULT 50, "p_offset" integer DEFAULT 0) RETURNS TABLE("id" "uuid", "content_type" "public"."freshness_content_type", "entity_id" "uuid", "entity_name" "text", "last_updated_at" timestamp with time zone, "days_since_update" integer, "freshness_status" "public"."freshness_status", "location_info" "text")
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        df.id,
        df.content_type,
        df.entity_id,
        CASE 
            WHEN df.content_type = 'motorcycle' THEN 
                CONCAT(b.name, ' ', mr.model, ' (', mr.year, ')')
            WHEN df.content_type = 'rental_shop' THEN 
                rs2.provider_name
        END as entity_name,
        df.last_updated_at,
        df.days_since_update,
        df.freshness_status,
        CASE 
            WHEN df.content_type = 'motorcycle' THEN 
                CONCAT(c.name, ', ', p.name, ', ', co.name)
            WHEN df.content_type = 'rental_shop' THEN 
                CONCAT(c2.name, ', ', p2.name, ', ', co2.name)
        END as location_info
    FROM data_freshness df
    LEFT JOIN motorcycle_rentals mr ON df.content_type = 'motorcycle' AND df.entity_id = mr.id
    LEFT JOIN brands b ON mr.brand_id = b.id
    LEFT JOIN rental_shops rs ON mr.shop_id = rs.id
    LEFT JOIN cities c ON rs.city_id = c.id
    LEFT JOIN provinces p ON c.province_id = p.id
    LEFT JOIN countries co ON p.country_code = co.code
    LEFT JOIN rental_shops rs2 ON df.content_type = 'rental_shop' AND df.entity_id = rs2.id
    LEFT JOIN cities c2 ON rs2.city_id = c2.id
    LEFT JOIN provinces p2 ON c2.province_id = p2.id
    LEFT JOIN countries co2 ON p2.country_code = co2.code
    WHERE 
        (p_content_type IS NULL OR df.content_type = p_content_type)
        AND (p_freshness_status IS NULL OR df.freshness_status = p_freshness_status)
    ORDER BY df.days_since_update DESC, df.last_updated_at ASC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$;


ALTER FUNCTION "public"."get_entities_by_freshness"("p_content_type" "public"."freshness_content_type", "p_freshness_status" "public"."freshness_status", "p_limit" integer, "p_offset" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_entities_by_freshness"("p_content_type" "public"."freshness_content_type", "p_freshness_status" "public"."freshness_status", "p_limit" integer, "p_offset" integer) IS 'Returns paginated list of entities filtered by content type and freshness status - Fixed rental shop names';



CREATE OR REPLACE FUNCTION "public"."get_flagged_content_stats"() RETURNS TABLE("total_pending" integer, "total_under_review" integer, "total_approved" integer, "total_applied" integer, "total_rejected" integer, "critical_pending" integer, "motorcycle_flags" integer, "rental_shop_flags" integer)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(CASE WHEN status = 'pending' THEN 1 END)::INTEGER as total_pending,
    COUNT(CASE WHEN status = 'under_review' THEN 1 END)::INTEGER as total_under_review,
    COUNT(CASE WHEN status = 'approved' THEN 1 END)::INTEGER as total_approved,
    COUNT(CASE WHEN status = 'applied' THEN 1 END)::INTEGER as total_applied,
    COUNT(CASE WHEN status = 'rejected' THEN 1 END)::INTEGER as total_rejected,
    COUNT(CASE WHEN status = 'pending' AND priority >= 4 THEN 1 END)::INTEGER as critical_pending,
    COUNT(CASE WHEN content_type = 'motorcycle' THEN 1 END)::INTEGER as motorcycle_flags,
    COUNT(CASE WHEN content_type = 'rental_shop' THEN 1 END)::INTEGER as rental_shop_flags
  FROM public.flagged_content;
END;
$$;


ALTER FUNCTION "public"."get_flagged_content_stats"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_geographic_distribution"() RETURNS TABLE("country" "text", "city" "text", "shop_count" bigint)
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.name AS country,
    ci.name AS city,
    count(rs.id) AS shop_count
  FROM rental_shops rs
  JOIN cities ci ON rs.city_id = ci.id
  JOIN provinces p ON ci.province_id = p.id
  JOIN countries c ON p.country_code = c.code
  GROUP BY c.name, ci.name
  ORDER BY shop_count DESC
  LIMIT 10;
END;
$$;


ALTER FUNCTION "public"."get_geographic_distribution"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_premium_analytics_summary"("p_listing_id" "uuid", "p_start_date" "date" DEFAULT NULL::"date", "p_end_date" "date" DEFAULT NULL::"date") RETURNS TABLE("metric_type" "public"."premium_metric_type", "total_value" bigint, "avg_daily_value" numeric, "days_tracked" integer)
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        pa.metric_type,
        SUM(pa.metric_value)::BIGINT as total_value,
        ROUND(AVG(pa.metric_value)::NUMERIC, 2) as avg_daily_value,
        COUNT(DISTINCT pa.recorded_date)::INTEGER as days_tracked
    FROM premium_analytics pa
    WHERE pa.premium_listing_id = p_listing_id
      AND (p_start_date IS NULL OR pa.recorded_date >= p_start_date)
      AND (p_end_date IS NULL OR pa.recorded_date <= p_end_date)
    GROUP BY pa.metric_type
    ORDER BY total_value DESC;
END;
$$;


ALTER FUNCTION "public"."get_premium_analytics_summary"("p_listing_id" "uuid", "p_start_date" "date", "p_end_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_premium_dashboard_stats"() RETURNS TABLE("total_active_listings" bigint, "total_expired_listings" bigint, "expiring_soon" bigint, "revenue_this_month" numeric, "revenue_last_month" numeric, "new_listings_this_month" bigint)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*) FILTER (WHERE status = 'active') as total_active_listings,
        COUNT(*) FILTER (WHERE status = 'expired') as total_expired_listings,
        COUNT(*) FILTER (WHERE status = 'active' AND end_date <= CURRENT_DATE + INTERVAL '7 days') as expiring_soon,
        COALESCE(SUM(price_paid) FILTER (WHERE created_at >= date_trunc('month', CURRENT_DATE)), 0) as revenue_this_month,
        COALESCE(SUM(price_paid) FILTER (WHERE created_at >= date_trunc('month', CURRENT_DATE) - INTERVAL '1 month' 
                                              AND created_at < date_trunc('month', CURRENT_DATE)), 0) as revenue_last_month,
        COUNT(*) FILTER (WHERE created_at >= date_trunc('month', CURRENT_DATE)) as new_listings_this_month
    FROM public.premium_listings;
END;
$$;


ALTER FUNCTION "public"."get_premium_dashboard_stats"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."insert_daily_snapshot"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
  INSERT INTO public.analytics_snapshots (data)
  SELECT capture_daily_analytics_snapshot();
END;
$$;


ALTER FUNCTION "public"."insert_daily_snapshot"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_admin"() RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    AS $$
DECLARE
  user_id_val uuid;
  admin_count int;
BEGIN
  -- Get current user ID
  user_id_val := auth.uid();
  
  -- If no user, not admin
  IF user_id_val IS NULL THEN
    RETURN false;
  END IF;
  
  -- Check if user has admin role in user_roles table
  SELECT count(*)
  INTO admin_count
  FROM public.user_roles
  WHERE user_roles.user_id = user_id_val
    AND user_roles.role = 'admin';
  
  RETURN admin_count > 0;
END;
$$;


ALTER FUNCTION "public"."is_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."make_user_admin"("user_email" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  target_user_id uuid;
  admin_exists boolean;
BEGIN
  -- Find the user by email
  SELECT auth.users.id INTO target_user_id
  FROM auth.users
  WHERE auth.users.email = user_email;
  
  -- Check if user exists
  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'User with email % not found', user_email;
  END IF;
  
  -- Check if user is already an admin
  SELECT EXISTS(
    SELECT 1 FROM public.user_roles 
    WHERE user_id = target_user_id AND role = 'admin'
  ) INTO admin_exists;
  
  IF admin_exists THEN
    RAISE NOTICE 'User % is already an admin', user_email;
    RETURN TRUE;
  END IF;
  
  -- Add admin role
  INSERT INTO public.user_roles (user_id, role, created_at, updated_at)
  VALUES (target_user_id, 'admin', NOW(), NOW());
  
  RAISE NOTICE 'User % has been granted admin privileges', user_email;
  RETURN TRUE;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error making user admin: %', SQLERRM;
    RETURN FALSE;
END;
$$;


ALTER FUNCTION "public"."make_user_admin"("user_email" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."parse_flagged_content_changes"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
DECLARE
  key TEXT;
  original_val TEXT;
  proposed_val TEXT;
BEGIN
  -- Parse top-level field changes
  FOR key IN SELECT jsonb_object_keys(NEW.proposed_data)
  LOOP
    original_val := COALESCE((NEW.original_data ->> key), '');
    proposed_val := NEW.proposed_data ->> key;
    
    -- Only insert if values are different
    IF original_val != proposed_val THEN
      INSERT INTO flagged_content_changes (
        flagged_content_id,
        field_name,
        original_value,
        proposed_value,
        change_type,
        is_critical
      ) VALUES (
        NEW.id,
        key,
        original_val,
        proposed_val,
        CASE 
          WHEN original_val = '' THEN 'add'
          WHEN proposed_val = '' THEN 'remove'
          ELSE 'update'
        END,
        -- Mark certain fields as critical
        key IN ('rental_rate_per_day', 'phone', 'website', 'full_address', 'provider_name')
      );
    END IF;
  END LOOP;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."parse_flagged_content_changes"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refresh_data_freshness"() RETURNS TABLE("updated_count" integer, "fresh_count" integer, "stale_count" integer, "very_stale_count" integer)
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
DECLARE
    _updated_count INTEGER := 0;
    _fresh_count INTEGER := 0;
    _stale_count INTEGER := 0;
    _very_stale_count INTEGER := 0;
    _days_diff INTEGER;
    _status freshness_status;
BEGIN
    -- Update freshness for motorcycles
    INSERT INTO data_freshness (content_type, entity_id, last_updated_at, days_since_update, freshness_status)
    SELECT 
        'motorcycle'::freshness_content_type,
        id,
        updated_at,
        EXTRACT(DAY FROM NOW() - updated_at)::INTEGER,
        calculate_freshness_status(EXTRACT(DAY FROM NOW() - updated_at)::INTEGER)
    FROM motorcycle_rentals
    ON CONFLICT (content_type, entity_id) 
    DO UPDATE SET 
        last_updated_at = EXCLUDED.last_updated_at,
        days_since_update = EXCLUDED.days_since_update,
        freshness_status = EXCLUDED.freshness_status,
        updated_at = NOW();

    -- Update freshness for rental shops
    INSERT INTO data_freshness (content_type, entity_id, last_updated_at, days_since_update, freshness_status)
    SELECT 
        'rental_shop'::freshness_content_type,
        id,
        updated_at,
        EXTRACT(DAY FROM NOW() - updated_at)::INTEGER,
        calculate_freshness_status(EXTRACT(DAY FROM NOW() - updated_at)::INTEGER)
    FROM rental_shops
    ON CONFLICT (content_type, entity_id) 
    DO UPDATE SET 
        last_updated_at = EXCLUDED.last_updated_at,
        days_since_update = EXCLUDED.days_since_update,
        freshness_status = EXCLUDED.freshness_status,
        updated_at = NOW();

    -- Get counts
    SELECT COUNT(*) INTO _updated_count FROM data_freshness;
    SELECT COUNT(*) INTO _fresh_count FROM data_freshness WHERE freshness_status = 'fresh';
    SELECT COUNT(*) INTO _stale_count FROM data_freshness WHERE freshness_status = 'stale';
    SELECT COUNT(*) INTO _very_stale_count FROM data_freshness WHERE freshness_status = 'very_stale';

    RETURN QUERY SELECT _updated_count, _fresh_count, _stale_count, _very_stale_count;
END;
$$;


ALTER FUNCTION "public"."refresh_data_freshness"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."refresh_data_freshness"() IS 'Refreshes all data freshness records and returns summary statistics';



CREATE OR REPLACE FUNCTION "public"."remove_user_admin"("user_email" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  target_user_id uuid;
BEGIN
  -- Find the user by email
  SELECT auth.users.id INTO target_user_id
  FROM auth.users
  WHERE auth.users.email = user_email;
  
  -- Check if user exists
  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'User with email % not found', user_email;
  END IF;
  
  -- Remove admin role
  DELETE FROM public.user_roles 
  WHERE user_id = target_user_id AND role = 'admin';
  
  RAISE NOTICE 'Admin privileges removed from user %', user_email;
  RETURN TRUE;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error removing admin privileges: %', SQLERRM;
    RETURN FALSE;
END;
$$;


ALTER FUNCTION "public"."remove_user_admin"("user_email" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rental_shops_slug_trigger"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.slug IS NULL THEN
    NEW.slug := public.generate_slug(NEW.provider_name);
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."rental_shops_slug_trigger"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_set_timestamp"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trigger_set_timestamp"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_entity_freshness"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    -- Update or insert freshness record
    INSERT INTO public.data_freshness (
        content_type, 
        entity_id, 
        last_updated_at, 
        days_since_update, 
        freshness_status,
        data_source
    ) VALUES (
        CASE TG_TABLE_NAME 
            WHEN 'motorcycle_rentals' THEN 'motorcycle'::public.freshness_content_type
            WHEN 'rental_shops' THEN 'rental_shop'::public.freshness_content_type
        END,
        NEW.id,
        NEW.updated_at,
        0, -- Just updated, so 0 days
        'fresh'::public.freshness_status,
        'manual'
    )
    ON CONFLICT (content_type, entity_id) 
    DO UPDATE SET 
        last_updated_at = NEW.updated_at,
        days_since_update = 0,
        freshness_status = 'fresh'::public.freshness_status,
        data_source = 'manual',
        updated_at = NOW();
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_entity_freshness"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."analytics_snapshots" (
    "id" bigint NOT NULL,
    "snapshot_date" "date" DEFAULT ("now"() AT TIME ZONE 'utc'::"text") NOT NULL,
    "data" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."analytics_snapshots" OWNER TO "postgres";


ALTER TABLE "public"."analytics_snapshots" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."analytics_snapshots_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."brands" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."brands" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."business_statuses" (
    "id" integer NOT NULL,
    "status_code" "text" NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."business_statuses" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."business_statuses_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE "public"."business_statuses_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."business_statuses_id_seq" OWNED BY "public"."business_statuses"."id";



CREATE TABLE IF NOT EXISTS "public"."categories" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cities" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text" NOT NULL,
    "province_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."cities" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."condition_types" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."condition_types" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."countries" (
    "code" character(2) NOT NULL,
    "name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."countries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."data_freshness" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "content_type" "public"."freshness_content_type" NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "last_updated_at" timestamp with time zone NOT NULL,
    "data_source" "text" DEFAULT 'import'::"text",
    "freshness_status" "public"."freshness_status" NOT NULL,
    "days_since_update" integer NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."data_freshness" OWNER TO "postgres";


COMMENT ON TABLE "public"."data_freshness" IS 'Tracks data freshness at entity level for admin monitoring';



CREATE TABLE IF NOT EXISTS "public"."features" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."features" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."flagged_content" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "content_type" "public"."content_type" NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "flag_category" "public"."flag_category" NOT NULL,
    "flag_reason" "text" NOT NULL,
    "original_data" "jsonb" NOT NULL,
    "proposed_data" "jsonb" NOT NULL,
    "status" "public"."flag_status" DEFAULT 'pending'::"public"."flag_status" NOT NULL,
    "admin_notes" "text",
    "flagged_by_user_id" "uuid",
    "flagged_by_email" character varying(255),
    "reviewed_by_admin_id" "uuid",
    "applied_by_admin_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "reviewed_at" timestamp with time zone,
    "applied_at" timestamp with time zone,
    "priority" integer DEFAULT 1,
    "is_verified" boolean DEFAULT false,
    CONSTRAINT "flagged_content_contact_check" CHECK ((("flagged_by_user_id" IS NOT NULL) OR ("flagged_by_email" IS NOT NULL))),
    CONSTRAINT "flagged_content_priority_check" CHECK ((("priority" >= 1) AND ("priority" <= 5)))
);


ALTER TABLE "public"."flagged_content" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."flagged_content_changes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "flagged_content_id" "uuid" NOT NULL,
    "field_name" character varying(100) NOT NULL,
    "field_path" character varying(200),
    "original_value" "text",
    "proposed_value" "text" NOT NULL,
    "change_type" character varying(20) DEFAULT 'update'::character varying NOT NULL,
    "is_critical" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."flagged_content_changes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."images" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "url" "text" NOT NULL,
    "alt_text" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."images" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."insurance_types" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."insurance_types" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."motorcycle_conditions" (
    "motorcycle_id" "uuid" NOT NULL,
    "condition_type_id" "uuid" NOT NULL,
    "notes" "text"
);


ALTER TABLE "public"."motorcycle_conditions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."motorcycle_features" (
    "motorcycle_id" "uuid" NOT NULL,
    "feature_id" "uuid" NOT NULL
);


ALTER TABLE "public"."motorcycle_features" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."motorcycle_images" (
    "motorcycle_id" "uuid" NOT NULL,
    "image_id" "uuid" NOT NULL,
    "sort_order" integer DEFAULT 0
);


ALTER TABLE "public"."motorcycle_images" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."motorcycle_insurance_details" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "motorcycle_id" "uuid" NOT NULL,
    "insurance_type_id" "uuid" NOT NULL,
    "is_included" boolean DEFAULT false NOT NULL,
    "cost_per_day" numeric(10,2),
    "cost_currency" character(3),
    "deductible" numeric(12,2),
    "deductible_currency" character(3),
    "notes" "text"
);


ALTER TABLE "public"."motorcycle_insurance_details" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."motorcycle_rentals" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "brand_id" "uuid" NOT NULL,
    "category_id" "uuid",
    "model" "text" NOT NULL,
    "year" integer,
    "engine_capacity_cc" integer,
    "rental_rate_per_day" numeric(10,2),
    "rental_rate_currency" character(3),
    "specifications_details" "jsonb",
    "conditions_details" "jsonb",
    "availability_status" "text",
    "source_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."motorcycle_rentals" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."motorcycle_required_documents" (
    "motorcycle_id" "uuid" NOT NULL,
    "document_type_id" "uuid" NOT NULL
);


ALTER TABLE "public"."motorcycle_required_documents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."premium_analytics" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "premium_listing_id" "uuid" NOT NULL,
    "metric_type" "public"."premium_metric_type" NOT NULL,
    "metric_value" integer DEFAULT 0 NOT NULL,
    "recorded_date" "date" NOT NULL,
    "metadata" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "premium_analytics_value_check" CHECK (("metric_value" >= 0))
);


ALTER TABLE "public"."premium_analytics" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."premium_listings" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "content_type" "public"."premium_content_type" NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "premium_tier" "public"."premium_tier" NOT NULL,
    "status" "public"."premium_status" DEFAULT 'active'::"public"."premium_status" NOT NULL,
    "start_date" "date" NOT NULL,
    "end_date" "date" NOT NULL,
    "price_paid" numeric(10,2),
    "currency" character varying(3) DEFAULT 'USD'::character varying,
    "pricing_plan_id" "uuid",
    "auto_renew" boolean DEFAULT false,
    "admin_notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid",
    "updated_by" "uuid",
    CONSTRAINT "premium_listings_date_check" CHECK (("end_date" > "start_date")),
    CONSTRAINT "premium_listings_price_check" CHECK ((("price_paid" IS NULL) OR ("price_paid" > (0)::numeric)))
);


ALTER TABLE "public"."premium_listings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."premium_pricing_plans" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "tier" "public"."premium_tier" NOT NULL,
    "duration_days" integer NOT NULL,
    "price" numeric(10,2) NOT NULL,
    "currency" character varying(3) DEFAULT 'USD'::character varying NOT NULL,
    "features" "jsonb",
    "description" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "premium_pricing_plans_duration_check" CHECK (("duration_days" > 0)),
    CONSTRAINT "premium_pricing_plans_price_check" CHECK (("price" > (0)::numeric))
);


ALTER TABLE "public"."premium_pricing_plans" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."provinces" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text" NOT NULL,
    "country_code" character(2) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."provinces" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rental_rate_tiers" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "motorcycle_id" "uuid" NOT NULL,
    "min_days" integer NOT NULL,
    "max_days" integer,
    "rate_per_day" numeric(10,2) NOT NULL,
    "currency" character(3) NOT NULL,
    CONSTRAINT "rental_rate_tiers_check" CHECK ((("max_days" IS NULL) OR ("max_days" >= "min_days"))),
    CONSTRAINT "rental_rate_tiers_min_days_check" CHECK (("min_days" > 0))
);


ALTER TABLE "public"."rental_rate_tiers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rental_shop_conditions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "condition_type_id" "uuid" NOT NULL,
    "condition_value" "text" NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."rental_shop_conditions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rental_shop_inclusions" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "inclusion_text" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."rental_shop_inclusions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rental_shop_service_locations" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "location_name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."rental_shop_service_locations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rental_shop_tours" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "duration_text" "text",
    "distance_km" numeric(10,2),
    "price_text" "text",
    "currency" character(3),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."rental_shop_tours" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rental_shops" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "provider_name" "text" NOT NULL,
    "location_name" "text",
    "place_id" "text",
    "full_address" "text" NOT NULL,
    "city_id" "uuid",
    "latitude" numeric(10,7),
    "longitude" numeric(10,7),
    "phone" "text",
    "website" "text",
    "google_maps_url" "text",
    "business_status_id" integer,
    "rating" numeric(2,1),
    "review_count" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "slug" "text" NOT NULL,
    "business_description" "text"
);


ALTER TABLE "public"."rental_shops" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."required_document_types" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."required_document_types" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."role_permissions" (
    "id" bigint NOT NULL,
    "role" "public"."app_role" NOT NULL,
    "permission" "public"."app_permission" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."role_permissions" OWNER TO "postgres";


COMMENT ON TABLE "public"."role_permissions" IS 'Permissions assigned to each role';



ALTER TABLE "public"."role_permissions" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."role_permissions_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."user_roles" (
    "id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "public"."app_role" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_roles" OWNER TO "postgres";


COMMENT ON TABLE "public"."user_roles" IS 'Application roles for each user (admin/user)';



ALTER TABLE "public"."user_roles" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."user_roles_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



ALTER TABLE ONLY "public"."business_statuses" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."business_statuses_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."analytics_snapshots"
    ADD CONSTRAINT "analytics_snapshots_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."brands"
    ADD CONSTRAINT "brands_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."brands"
    ADD CONSTRAINT "brands_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."business_statuses"
    ADD CONSTRAINT "business_statuses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."business_statuses"
    ADD CONSTRAINT "business_statuses_status_code_key" UNIQUE ("status_code");



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cities"
    ADD CONSTRAINT "cities_name_province_id_key" UNIQUE ("name", "province_id");



ALTER TABLE ONLY "public"."cities"
    ADD CONSTRAINT "cities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."condition_types"
    ADD CONSTRAINT "condition_types_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."condition_types"
    ADD CONSTRAINT "condition_types_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."countries"
    ADD CONSTRAINT "countries_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."countries"
    ADD CONSTRAINT "countries_pkey" PRIMARY KEY ("code");



ALTER TABLE ONLY "public"."data_freshness"
    ADD CONSTRAINT "data_freshness_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."data_freshness"
    ADD CONSTRAINT "data_freshness_unique_entity" UNIQUE ("content_type", "entity_id");



ALTER TABLE ONLY "public"."features"
    ADD CONSTRAINT "features_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."features"
    ADD CONSTRAINT "features_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."flagged_content_changes"
    ADD CONSTRAINT "flagged_content_changes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."flagged_content"
    ADD CONSTRAINT "flagged_content_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."images"
    ADD CONSTRAINT "images_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."images"
    ADD CONSTRAINT "images_url_key" UNIQUE ("url");



ALTER TABLE ONLY "public"."insurance_types"
    ADD CONSTRAINT "insurance_types_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."insurance_types"
    ADD CONSTRAINT "insurance_types_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."motorcycle_conditions"
    ADD CONSTRAINT "motorcycle_conditions_pkey" PRIMARY KEY ("motorcycle_id", "condition_type_id");



ALTER TABLE ONLY "public"."motorcycle_features"
    ADD CONSTRAINT "motorcycle_features_pkey" PRIMARY KEY ("motorcycle_id", "feature_id");



ALTER TABLE ONLY "public"."motorcycle_images"
    ADD CONSTRAINT "motorcycle_images_pkey" PRIMARY KEY ("motorcycle_id", "image_id");



ALTER TABLE ONLY "public"."motorcycle_insurance_details"
    ADD CONSTRAINT "motorcycle_insurance_details_motorcycle_id_insurance_type_i_key" UNIQUE ("motorcycle_id", "insurance_type_id");



ALTER TABLE ONLY "public"."motorcycle_insurance_details"
    ADD CONSTRAINT "motorcycle_insurance_details_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."motorcycle_rentals"
    ADD CONSTRAINT "motorcycle_rentals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."motorcycle_required_documents"
    ADD CONSTRAINT "motorcycle_required_documents_pkey" PRIMARY KEY ("motorcycle_id", "document_type_id");



ALTER TABLE ONLY "public"."premium_analytics"
    ADD CONSTRAINT "premium_analytics_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."premium_analytics"
    ADD CONSTRAINT "premium_analytics_unique_daily" UNIQUE ("premium_listing_id", "metric_type", "recorded_date");



ALTER TABLE ONLY "public"."premium_listings"
    ADD CONSTRAINT "premium_listings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."premium_listings"
    ADD CONSTRAINT "premium_listings_unique_active" UNIQUE ("content_type", "entity_id");



ALTER TABLE ONLY "public"."premium_pricing_plans"
    ADD CONSTRAINT "premium_pricing_plans_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."provinces"
    ADD CONSTRAINT "provinces_name_country_code_key" UNIQUE ("name", "country_code");



ALTER TABLE ONLY "public"."provinces"
    ADD CONSTRAINT "provinces_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rental_rate_tiers"
    ADD CONSTRAINT "rental_rate_tiers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rental_shop_conditions"
    ADD CONSTRAINT "rental_shop_conditions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rental_shop_conditions"
    ADD CONSTRAINT "rental_shop_conditions_shop_id_condition_type_id_key" UNIQUE ("shop_id", "condition_type_id");



ALTER TABLE ONLY "public"."rental_shop_inclusions"
    ADD CONSTRAINT "rental_shop_inclusions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rental_shop_service_locations"
    ADD CONSTRAINT "rental_shop_service_locations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rental_shop_tours"
    ADD CONSTRAINT "rental_shop_tours_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rental_shops"
    ADD CONSTRAINT "rental_shops_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rental_shops"
    ADD CONSTRAINT "rental_shops_place_id_key" UNIQUE ("place_id");



ALTER TABLE ONLY "public"."required_document_types"
    ADD CONSTRAINT "required_document_types_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."required_document_types"
    ADD CONSTRAINT "required_document_types_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."role_permissions"
    ADD CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."role_permissions"
    ADD CONSTRAINT "role_permissions_role_permission_key" UNIQUE ("role", "permission");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_role_key" UNIQUE ("user_id", "role");



CREATE INDEX "idx_analytics_snapshots_snapshot_date" ON "public"."analytics_snapshots" USING "btree" ("snapshot_date");



CREATE INDEX "idx_cities_name_lower" ON "public"."cities" USING "btree" ("lower"("name"));



CREATE INDEX "idx_cities_province_country" ON "public"."cities" USING "btree" ("province_id", "name");



CREATE INDEX "idx_countries_name_lower" ON "public"."countries" USING "btree" ("lower"("name"));



CREATE INDEX "idx_data_freshness_content_type" ON "public"."data_freshness" USING "btree" ("content_type");



CREATE INDEX "idx_data_freshness_days_since_update" ON "public"."data_freshness" USING "btree" ("days_since_update");



CREATE INDEX "idx_data_freshness_last_updated" ON "public"."data_freshness" USING "btree" ("last_updated_at");



CREATE INDEX "idx_data_freshness_status" ON "public"."data_freshness" USING "btree" ("freshness_status");



CREATE INDEX "idx_flagged_content_admin_review" ON "public"."flagged_content" USING "btree" ("status", "priority" DESC, "created_at" DESC);



CREATE INDEX "idx_flagged_content_changes_field_name" ON "public"."flagged_content_changes" USING "btree" ("field_name");



CREATE INDEX "idx_flagged_content_changes_flagged_content_id" ON "public"."flagged_content_changes" USING "btree" ("flagged_content_id");



CREATE INDEX "idx_flagged_content_content_entity" ON "public"."flagged_content" USING "btree" ("content_type", "entity_id");



CREATE INDEX "idx_flagged_content_content_type" ON "public"."flagged_content" USING "btree" ("content_type");



CREATE INDEX "idx_flagged_content_created_at" ON "public"."flagged_content" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_flagged_content_entity_id" ON "public"."flagged_content" USING "btree" ("entity_id");



CREATE INDEX "idx_flagged_content_flag_category" ON "public"."flagged_content" USING "btree" ("flag_category");



CREATE INDEX "idx_flagged_content_priority" ON "public"."flagged_content" USING "btree" ("priority" DESC);



CREATE INDEX "idx_flagged_content_status" ON "public"."flagged_content" USING "btree" ("status");



CREATE INDEX "idx_mc_motorcycle_id" ON "public"."motorcycle_conditions" USING "btree" ("motorcycle_id");



CREATE INDEX "idx_mf_motorcycle_id" ON "public"."motorcycle_features" USING "btree" ("motorcycle_id");



CREATE INDEX "idx_mi_motorcycle_id" ON "public"."motorcycle_images" USING "btree" ("motorcycle_id");



CREATE INDEX "idx_mid_motorcycle_id" ON "public"."motorcycle_insurance_details" USING "btree" ("motorcycle_id");



CREATE INDEX "idx_motorcycle_features_covering" ON "public"."motorcycle_features" USING "btree" ("feature_id", "motorcycle_id");



CREATE INDEX "idx_motorcycles_category_price" ON "public"."motorcycle_rentals" USING "btree" ("category_id", "rental_rate_per_day") WHERE ("rental_rate_per_day" IS NOT NULL);



CREATE INDEX "idx_motorcycles_created_desc" ON "public"."motorcycle_rentals" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_motorcycles_location_brand_category" ON "public"."motorcycle_rentals" USING "btree" ("shop_id", "brand_id", "category_id") WHERE (("availability_status" IS NULL) OR ("availability_status" <> 'unavailable'::"text"));



COMMENT ON INDEX "public"."idx_motorcycles_location_brand_category" IS 'Composite index for filtering motorcycles by location, brand, and category - most common search pattern';



CREATE INDEX "idx_motorcycles_model_text" ON "public"."motorcycle_rentals" USING "gin" ("to_tsvector"('"english"'::"regconfig", "model"));



CREATE INDEX "idx_motorcycles_price_engine" ON "public"."motorcycle_rentals" USING "btree" ("rental_rate_per_day", "engine_capacity_cc") WHERE ("rental_rate_per_day" IS NOT NULL);



COMMENT ON INDEX "public"."idx_motorcycles_price_engine" IS 'Composite index for price range and engine capacity filtering';



CREATE INDEX "idx_mr_brand_id" ON "public"."motorcycle_rentals" USING "btree" ("brand_id");



CREATE INDEX "idx_mr_category_id" ON "public"."motorcycle_rentals" USING "btree" ("category_id");



CREATE INDEX "idx_mr_cond_details_gin" ON "public"."motorcycle_rentals" USING "gin" ("conditions_details");



CREATE INDEX "idx_mr_engine_cc" ON "public"."motorcycle_rentals" USING "btree" ("engine_capacity_cc");



CREATE INDEX "idx_mr_model" ON "public"."motorcycle_rentals" USING "btree" ("model");



CREATE INDEX "idx_mr_rate_day" ON "public"."motorcycle_rentals" USING "btree" ("rental_rate_per_day");



CREATE INDEX "idx_mr_shop_id" ON "public"."motorcycle_rentals" USING "btree" ("shop_id");



CREATE INDEX "idx_mr_spec_details_gin" ON "public"."motorcycle_rentals" USING "gin" ("specifications_details");



CREATE INDEX "idx_mrd_motorcycle_id" ON "public"."motorcycle_required_documents" USING "btree" ("motorcycle_id");



CREATE INDEX "idx_premium_analytics_listing_date" ON "public"."premium_analytics" USING "btree" ("premium_listing_id", "recorded_date");



CREATE INDEX "idx_premium_analytics_listing_metric" ON "public"."premium_analytics" USING "btree" ("premium_listing_id", "metric_type");



CREATE INDEX "idx_premium_listings_content_type_entity" ON "public"."premium_listings" USING "btree" ("content_type", "entity_id");



CREATE INDEX "idx_premium_listings_created_at" ON "public"."premium_listings" USING "btree" ("created_at");



CREATE INDEX "idx_premium_listings_dates" ON "public"."premium_listings" USING "btree" ("start_date", "end_date");



CREATE INDEX "idx_premium_listings_tier_status" ON "public"."premium_listings" USING "btree" ("premium_tier", "status");



CREATE INDEX "idx_provinces_country_name" ON "public"."provinces" USING "btree" ("country_code", "name");



CREATE INDEX "idx_provinces_name_lower" ON "public"."provinces" USING "btree" ("lower"("name"));



CREATE INDEX "idx_rrt_motorcycle_id" ON "public"."rental_rate_tiers" USING "btree" ("motorcycle_id");



CREATE INDEX "idx_rs_city_id" ON "public"."rental_shops" USING "btree" ("city_id");



CREATE INDEX "idx_rs_place_id" ON "public"."rental_shops" USING "btree" ("place_id");



CREATE INDEX "idx_rs_provider_name" ON "public"."rental_shops" USING "btree" ("provider_name");



CREATE INDEX "idx_rsi_shop_id" ON "public"."rental_shop_inclusions" USING "btree" ("shop_id");



CREATE INDEX "idx_rssl_shop_id" ON "public"."rental_shop_service_locations" USING "btree" ("shop_id");



CREATE INDEX "idx_rst_shop_id" ON "public"."rental_shop_tours" USING "btree" ("shop_id");



CREATE INDEX "idx_shops_city_rating" ON "public"."rental_shops" USING "btree" ("city_id", "rating") WHERE ("rating" IS NOT NULL);



COMMENT ON INDEX "public"."idx_shops_city_rating" IS 'Composite index for location-based shop search with rating sorting';



CREATE INDEX "idx_shops_created_desc" ON "public"."rental_shops" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_shops_location_status" ON "public"."rental_shops" USING "btree" ("city_id", "business_status_id");



CREATE INDEX "idx_shops_name_text" ON "public"."rental_shops" USING "gin" ("to_tsvector"('"english"'::"regconfig", "provider_name"));



CREATE INDEX "idx_shops_rating_reviews" ON "public"."rental_shops" USING "btree" ("rating" DESC NULLS LAST, "review_count" DESC NULLS LAST);



CREATE UNIQUE INDEX "rental_shops_slug_idx" ON "public"."rental_shops" USING "btree" ("slug");



CREATE OR REPLACE TRIGGER "handle_rental_shop_conditions_updated_at" BEFORE UPDATE ON "public"."rental_shop_conditions" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_set_timestamp"();



CREATE OR REPLACE TRIGGER "motorcycle_freshness_trigger" AFTER UPDATE ON "public"."motorcycle_rentals" FOR EACH ROW EXECUTE FUNCTION "public"."update_entity_freshness"();



CREATE OR REPLACE TRIGGER "set_rental_shops_slug" BEFORE INSERT ON "public"."rental_shops" FOR EACH ROW EXECUTE FUNCTION "public"."rental_shops_slug_trigger"();



CREATE OR REPLACE TRIGGER "set_timestamp_brands" BEFORE UPDATE ON "public"."brands" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_set_timestamp"();



CREATE OR REPLACE TRIGGER "set_timestamp_business_statuses" BEFORE UPDATE ON "public"."business_statuses" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_set_timestamp"();



CREATE OR REPLACE TRIGGER "set_timestamp_categories" BEFORE UPDATE ON "public"."categories" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_set_timestamp"();



CREATE OR REPLACE TRIGGER "set_timestamp_cities" BEFORE UPDATE ON "public"."cities" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_set_timestamp"();



CREATE OR REPLACE TRIGGER "set_timestamp_condition_types" BEFORE UPDATE ON "public"."condition_types" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_set_timestamp"();



CREATE OR REPLACE TRIGGER "set_timestamp_countries" BEFORE UPDATE ON "public"."countries" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_set_timestamp"();



CREATE OR REPLACE TRIGGER "set_timestamp_features" BEFORE UPDATE ON "public"."features" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_set_timestamp"();



CREATE OR REPLACE TRIGGER "set_timestamp_insurance_types" BEFORE UPDATE ON "public"."insurance_types" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_set_timestamp"();



CREATE OR REPLACE TRIGGER "set_timestamp_motorcycle_rentals" BEFORE UPDATE ON "public"."motorcycle_rentals" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_set_timestamp"();



CREATE OR REPLACE TRIGGER "set_timestamp_provinces" BEFORE UPDATE ON "public"."provinces" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_set_timestamp"();



CREATE OR REPLACE TRIGGER "set_timestamp_rental_shop_inclusions" BEFORE UPDATE ON "public"."rental_shop_inclusions" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_set_timestamp"();



CREATE OR REPLACE TRIGGER "set_timestamp_rental_shop_service_locations" BEFORE UPDATE ON "public"."rental_shop_service_locations" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_set_timestamp"();



CREATE OR REPLACE TRIGGER "set_timestamp_rental_shop_tours" BEFORE UPDATE ON "public"."rental_shop_tours" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_set_timestamp"();



CREATE OR REPLACE TRIGGER "set_timestamp_rental_shops" BEFORE UPDATE ON "public"."rental_shops" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_set_timestamp"();



CREATE OR REPLACE TRIGGER "set_timestamp_required_document_types" BEFORE UPDATE ON "public"."required_document_types" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_set_timestamp"();



CREATE OR REPLACE TRIGGER "set_timestamp_user_roles" BEFORE UPDATE ON "public"."user_roles" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_set_timestamp"();



CREATE OR REPLACE TRIGGER "shop_freshness_trigger" AFTER UPDATE ON "public"."rental_shops" FOR EACH ROW EXECUTE FUNCTION "public"."update_entity_freshness"();



CREATE OR REPLACE TRIGGER "trigger_parse_flagged_content_changes" AFTER INSERT ON "public"."flagged_content" FOR EACH ROW EXECUTE FUNCTION "public"."parse_flagged_content_changes"();



CREATE OR REPLACE TRIGGER "update_premium_listings_updated_at" BEFORE UPDATE ON "public"."premium_listings" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_premium_pricing_plans_updated_at" BEFORE UPDATE ON "public"."premium_pricing_plans" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."cities"
    ADD CONSTRAINT "cities_province_id_fkey" FOREIGN KEY ("province_id") REFERENCES "public"."provinces"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."flagged_content"
    ADD CONSTRAINT "flagged_content_applied_by_admin_id_fkey" FOREIGN KEY ("applied_by_admin_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."flagged_content_changes"
    ADD CONSTRAINT "flagged_content_changes_flagged_content_id_fkey" FOREIGN KEY ("flagged_content_id") REFERENCES "public"."flagged_content"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."flagged_content"
    ADD CONSTRAINT "flagged_content_reviewed_by_admin_id_fkey" FOREIGN KEY ("reviewed_by_admin_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."motorcycle_conditions"
    ADD CONSTRAINT "motorcycle_conditions_condition_type_id_fkey" FOREIGN KEY ("condition_type_id") REFERENCES "public"."condition_types"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."motorcycle_conditions"
    ADD CONSTRAINT "motorcycle_conditions_motorcycle_id_fkey" FOREIGN KEY ("motorcycle_id") REFERENCES "public"."motorcycle_rentals"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."motorcycle_features"
    ADD CONSTRAINT "motorcycle_features_feature_id_fkey" FOREIGN KEY ("feature_id") REFERENCES "public"."features"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."motorcycle_features"
    ADD CONSTRAINT "motorcycle_features_motorcycle_id_fkey" FOREIGN KEY ("motorcycle_id") REFERENCES "public"."motorcycle_rentals"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."motorcycle_images"
    ADD CONSTRAINT "motorcycle_images_image_id_fkey" FOREIGN KEY ("image_id") REFERENCES "public"."images"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."motorcycle_images"
    ADD CONSTRAINT "motorcycle_images_motorcycle_id_fkey" FOREIGN KEY ("motorcycle_id") REFERENCES "public"."motorcycle_rentals"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."motorcycle_insurance_details"
    ADD CONSTRAINT "motorcycle_insurance_details_insurance_type_id_fkey" FOREIGN KEY ("insurance_type_id") REFERENCES "public"."insurance_types"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."motorcycle_insurance_details"
    ADD CONSTRAINT "motorcycle_insurance_details_motorcycle_id_fkey" FOREIGN KEY ("motorcycle_id") REFERENCES "public"."motorcycle_rentals"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."motorcycle_rentals"
    ADD CONSTRAINT "motorcycle_rentals_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."motorcycle_rentals"
    ADD CONSTRAINT "motorcycle_rentals_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."motorcycle_rentals"
    ADD CONSTRAINT "motorcycle_rentals_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "public"."rental_shops"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."motorcycle_required_documents"
    ADD CONSTRAINT "motorcycle_required_documents_document_type_id_fkey" FOREIGN KEY ("document_type_id") REFERENCES "public"."required_document_types"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."motorcycle_required_documents"
    ADD CONSTRAINT "motorcycle_required_documents_motorcycle_id_fkey" FOREIGN KEY ("motorcycle_id") REFERENCES "public"."motorcycle_rentals"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."premium_analytics"
    ADD CONSTRAINT "premium_analytics_premium_listing_id_fkey" FOREIGN KEY ("premium_listing_id") REFERENCES "public"."premium_listings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."premium_listings"
    ADD CONSTRAINT "premium_listings_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."premium_listings"
    ADD CONSTRAINT "premium_listings_pricing_plan_id_fkey" FOREIGN KEY ("pricing_plan_id") REFERENCES "public"."premium_pricing_plans"("id");



ALTER TABLE ONLY "public"."premium_listings"
    ADD CONSTRAINT "premium_listings_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."provinces"
    ADD CONSTRAINT "provinces_country_code_fkey" FOREIGN KEY ("country_code") REFERENCES "public"."countries"("code") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."rental_rate_tiers"
    ADD CONSTRAINT "rental_rate_tiers_motorcycle_id_fkey" FOREIGN KEY ("motorcycle_id") REFERENCES "public"."motorcycle_rentals"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rental_shop_conditions"
    ADD CONSTRAINT "rental_shop_conditions_condition_type_id_fkey" FOREIGN KEY ("condition_type_id") REFERENCES "public"."condition_types"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rental_shop_conditions"
    ADD CONSTRAINT "rental_shop_conditions_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "public"."rental_shops"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rental_shop_inclusions"
    ADD CONSTRAINT "rental_shop_inclusions_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "public"."rental_shops"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rental_shop_service_locations"
    ADD CONSTRAINT "rental_shop_service_locations_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "public"."rental_shops"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rental_shop_tours"
    ADD CONSTRAINT "rental_shop_tours_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "public"."rental_shops"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rental_shops"
    ADD CONSTRAINT "rental_shops_business_status_id_fkey" FOREIGN KEY ("business_status_id") REFERENCES "public"."business_statuses"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."rental_shops"
    ADD CONSTRAINT "rental_shops_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Admins can manage data freshness" ON "public"."data_freshness" TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "Admins can manage premium analytics" ON "public"."premium_analytics" TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "Admins can manage premium listings" ON "public"."premium_listings" TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "Allow admins to create brands" ON "public"."brands" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin"());



CREATE POLICY "Allow admins to create business statuses" ON "public"."business_statuses" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin"());



CREATE POLICY "Allow admins to create categories" ON "public"."categories" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin"());



CREATE POLICY "Allow admins to create condition types" ON "public"."condition_types" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin"());



CREATE POLICY "Allow admins to create features" ON "public"."features" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin"());



CREATE POLICY "Allow admins to create images" ON "public"."images" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin"());



CREATE POLICY "Allow admins to create insurance types" ON "public"."insurance_types" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin"());



CREATE POLICY "Allow admins to create motorcycle features" ON "public"."motorcycle_features" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin"());



CREATE POLICY "Allow admins to create motorcycle images" ON "public"."motorcycle_images" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin"());



CREATE POLICY "Allow admins to create motorcycle insurance details" ON "public"."motorcycle_insurance_details" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin"());



CREATE POLICY "Allow admins to create motorcycle rentals" ON "public"."motorcycle_rentals" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin"());



CREATE POLICY "Allow admins to create motorcycle required documents" ON "public"."motorcycle_required_documents" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin"());



CREATE POLICY "Allow admins to create rental rate tiers" ON "public"."rental_rate_tiers" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin"());



CREATE POLICY "Allow admins to create rental shop conditions" ON "public"."rental_shop_conditions" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin"());



CREATE POLICY "Allow admins to create rental shop inclusions" ON "public"."rental_shop_inclusions" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin"());



CREATE POLICY "Allow admins to create rental shop service locations" ON "public"."rental_shop_service_locations" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin"());



CREATE POLICY "Allow admins to create rental shop tours" ON "public"."rental_shop_tours" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin"());



CREATE POLICY "Allow admins to create rental shops" ON "public"."rental_shops" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin"());



CREATE POLICY "Allow admins to create required document types" ON "public"."required_document_types" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin"());



CREATE POLICY "Allow admins to delete brands" ON "public"."brands" FOR DELETE TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "Allow admins to delete business statuses" ON "public"."business_statuses" FOR DELETE TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "Allow admins to delete categories" ON "public"."categories" FOR DELETE TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "Allow admins to delete condition types" ON "public"."condition_types" FOR DELETE TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "Allow admins to delete features" ON "public"."features" FOR DELETE TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "Allow admins to delete flagged content" ON "public"."flagged_content" FOR DELETE TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "Allow admins to delete images" ON "public"."images" FOR DELETE TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "Allow admins to delete insurance types" ON "public"."insurance_types" FOR DELETE TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "Allow admins to delete motorcycle features" ON "public"."motorcycle_features" FOR DELETE TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "Allow admins to delete motorcycle images" ON "public"."motorcycle_images" FOR DELETE TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "Allow admins to delete motorcycle insurance details" ON "public"."motorcycle_insurance_details" FOR DELETE TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "Allow admins to delete motorcycle rentals" ON "public"."motorcycle_rentals" FOR DELETE TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "Allow admins to delete motorcycle required documents" ON "public"."motorcycle_required_documents" FOR DELETE TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "Allow admins to delete rental rate tiers" ON "public"."rental_rate_tiers" FOR DELETE TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "Allow admins to delete rental shop conditions" ON "public"."rental_shop_conditions" FOR DELETE TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "Allow admins to delete rental shop inclusions" ON "public"."rental_shop_inclusions" FOR DELETE TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "Allow admins to delete rental shop service locations" ON "public"."rental_shop_service_locations" FOR DELETE TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "Allow admins to delete rental shop tours" ON "public"."rental_shop_tours" FOR DELETE TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "Allow admins to delete rental shops" ON "public"."rental_shops" FOR DELETE TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "Allow admins to delete required document types" ON "public"."required_document_types" FOR DELETE TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "Allow admins to manage flagged content changes" ON "public"."flagged_content_changes" TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "Allow admins to read all flagged content" ON "public"."flagged_content" FOR SELECT TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "Allow admins to update brands" ON "public"."brands" FOR UPDATE TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Allow admins to update business statuses" ON "public"."business_statuses" FOR UPDATE TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Allow admins to update categories" ON "public"."categories" FOR UPDATE TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Allow admins to update condition types" ON "public"."condition_types" FOR UPDATE TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Allow admins to update features" ON "public"."features" FOR UPDATE TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Allow admins to update flagged content" ON "public"."flagged_content" FOR UPDATE TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "Allow admins to update images" ON "public"."images" FOR UPDATE TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Allow admins to update insurance types" ON "public"."insurance_types" FOR UPDATE TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Allow admins to update motorcycle insurance details" ON "public"."motorcycle_insurance_details" FOR UPDATE TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Allow admins to update motorcycle rentals" ON "public"."motorcycle_rentals" FOR UPDATE TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Allow admins to update rental rate tiers" ON "public"."rental_rate_tiers" FOR UPDATE TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Allow admins to update rental shop conditions" ON "public"."rental_shop_conditions" FOR UPDATE TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Allow admins to update rental shop inclusions" ON "public"."rental_shop_inclusions" FOR UPDATE TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Allow admins to update rental shop service locations" ON "public"."rental_shop_service_locations" FOR UPDATE TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Allow admins to update rental shop tours" ON "public"."rental_shop_tours" FOR UPDATE TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Allow admins to update rental shops" ON "public"."rental_shops" FOR UPDATE TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Allow admins to update required document types" ON "public"."required_document_types" FOR UPDATE TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Allow anonymous users to read brands" ON "public"."brands" FOR SELECT TO "anon" USING (true);



CREATE POLICY "Allow anonymous users to read business statuses" ON "public"."business_statuses" FOR SELECT TO "anon" USING (true);



CREATE POLICY "Allow anonymous users to read categories" ON "public"."categories" FOR SELECT TO "anon" USING (true);



CREATE POLICY "Allow anonymous users to read cities" ON "public"."cities" FOR SELECT TO "anon" USING (true);



CREATE POLICY "Allow anonymous users to read condition types" ON "public"."condition_types" FOR SELECT TO "anon" USING (true);



CREATE POLICY "Allow anonymous users to read countries" ON "public"."countries" FOR SELECT TO "anon" USING (true);



CREATE POLICY "Allow anonymous users to read features" ON "public"."features" FOR SELECT TO "anon" USING (true);



CREATE POLICY "Allow anonymous users to read flagged content" ON "public"."flagged_content" FOR SELECT TO "anon" USING (true);



CREATE POLICY "Allow anonymous users to read images" ON "public"."images" FOR SELECT TO "anon" USING (true);



CREATE POLICY "Allow anonymous users to read insurance types" ON "public"."insurance_types" FOR SELECT TO "anon" USING (true);



CREATE POLICY "Allow anonymous users to read motorcycle conditions" ON "public"."motorcycle_conditions" FOR SELECT TO "anon" USING (true);



CREATE POLICY "Allow anonymous users to read motorcycle features" ON "public"."motorcycle_features" FOR SELECT TO "anon" USING (true);



CREATE POLICY "Allow anonymous users to read motorcycle images" ON "public"."motorcycle_images" FOR SELECT TO "anon" USING (true);



CREATE POLICY "Allow anonymous users to read motorcycle insurance details" ON "public"."motorcycle_insurance_details" FOR SELECT TO "anon" USING (true);



CREATE POLICY "Allow anonymous users to read motorcycle rentals" ON "public"."motorcycle_rentals" FOR SELECT TO "anon" USING (true);



CREATE POLICY "Allow anonymous users to read motorcycle required documents" ON "public"."motorcycle_required_documents" FOR SELECT TO "anon" USING (true);



CREATE POLICY "Allow anonymous users to read provinces" ON "public"."provinces" FOR SELECT TO "anon" USING (true);



CREATE POLICY "Allow anonymous users to read rental rate tiers" ON "public"."rental_rate_tiers" FOR SELECT TO "anon" USING (true);



CREATE POLICY "Allow anonymous users to read rental shop conditions" ON "public"."rental_shop_conditions" FOR SELECT TO "anon" USING (true);



CREATE POLICY "Allow anonymous users to read rental shop inclusions" ON "public"."rental_shop_inclusions" FOR SELECT TO "anon" USING (true);



CREATE POLICY "Allow anonymous users to read rental shop service locations" ON "public"."rental_shop_service_locations" FOR SELECT TO "anon" USING (true);



CREATE POLICY "Allow anonymous users to read rental shop tours" ON "public"."rental_shop_tours" FOR SELECT TO "anon" USING (true);



CREATE POLICY "Allow anonymous users to read rental shops" ON "public"."rental_shops" FOR SELECT TO "anon" USING (true);



CREATE POLICY "Allow anonymous users to read required document types" ON "public"."required_document_types" FOR SELECT TO "anon" USING (true);



CREATE POLICY "Allow auth admin to read user roles" ON "public"."user_roles" FOR SELECT TO "supabase_auth_admin" USING (true);



CREATE POLICY "Allow authenticated users to read brands" ON "public"."brands" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow authenticated users to read business statuses" ON "public"."business_statuses" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow authenticated users to read categories" ON "public"."categories" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow authenticated users to read cities" ON "public"."cities" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow authenticated users to read condition types" ON "public"."condition_types" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow authenticated users to read countries" ON "public"."countries" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow authenticated users to read features" ON "public"."features" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow authenticated users to read images" ON "public"."images" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow authenticated users to read insurance types" ON "public"."insurance_types" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow authenticated users to read motorcycle conditions" ON "public"."motorcycle_conditions" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow authenticated users to read motorcycle features" ON "public"."motorcycle_features" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow authenticated users to read motorcycle images" ON "public"."motorcycle_images" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow authenticated users to read motorcycle insurance details" ON "public"."motorcycle_insurance_details" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow authenticated users to read motorcycle rentals" ON "public"."motorcycle_rentals" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow authenticated users to read motorcycle required documents" ON "public"."motorcycle_required_documents" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow authenticated users to read provinces" ON "public"."provinces" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow authenticated users to read rental rate tiers" ON "public"."rental_rate_tiers" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow authenticated users to read rental shop conditions" ON "public"."rental_shop_conditions" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow authenticated users to read rental shop inclusions" ON "public"."rental_shop_inclusions" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow authenticated users to read rental shop service locations" ON "public"."rental_shop_service_locations" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow authenticated users to read rental shop tours" ON "public"."rental_shop_tours" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow authenticated users to read rental shops" ON "public"."rental_shops" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow authenticated users to read required document types" ON "public"."required_document_types" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow insert access for admins" ON "public"."analytics_snapshots" FOR INSERT WITH CHECK ((("auth"."jwt"() ->> 'is_admin'::"text") = 'true'::"text"));



CREATE POLICY "Allow insert for all users" ON "public"."flagged_content" FOR INSERT TO "authenticated", "anon" WITH CHECK (true);



CREATE POLICY "Allow read access to authenticated users" ON "public"."analytics_snapshots" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Allow reading flagged content changes" ON "public"."flagged_content_changes" FOR SELECT TO "authenticated", "anon" USING ((EXISTS ( SELECT 1
   FROM "public"."flagged_content" "fc"
  WHERE (("fc"."id" = "flagged_content_changes"."flagged_content_id") AND (("fc"."flagged_by_user_id" = "auth"."uid"()) OR "public"."is_admin"())))));



CREATE POLICY "Allow system to insert flagged content changes" ON "public"."flagged_content_changes" FOR INSERT TO "authenticated", "anon" WITH CHECK (true);



CREATE POLICY "Allow users to read own flagged content" ON "public"."flagged_content" FOR SELECT TO "authenticated" USING (("flagged_by_user_id" = "auth"."uid"()));



CREATE POLICY "Authenticated users can view role permissions" ON "public"."role_permissions" FOR SELECT TO "authenticated" USING (("role" IN ( SELECT "ur"."role"
   FROM "public"."user_roles" "ur"
  WHERE ("ur"."user_id" = "auth"."uid"()))));



CREATE POLICY "Only service role can manage role permissions" ON "public"."role_permissions" TO "service_role" USING (true);



CREATE POLICY "Only service role can manage user roles" ON "public"."user_roles" TO "service_role" USING (true);



CREATE POLICY "Premium pricing plans are publicly readable" ON "public"."premium_pricing_plans" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Public can read active premium listings" ON "public"."premium_listings" FOR SELECT TO "authenticated", "anon" USING ((("status" = 'active'::"public"."premium_status") AND ("end_date" > CURRENT_DATE)));



CREATE POLICY "Users can view their own roles" ON "public"."user_roles" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."analytics_snapshots" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."brands" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."business_statuses" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."categories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cities" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."condition_types" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."countries" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."data_freshness" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."features" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."flagged_content" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."flagged_content_changes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."images" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."insurance_types" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."motorcycle_conditions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."motorcycle_features" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."motorcycle_images" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."motorcycle_insurance_details" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."motorcycle_rentals" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."motorcycle_required_documents" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."premium_analytics" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."premium_listings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."premium_pricing_plans" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."provinces" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rental_rate_tiers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rental_shop_conditions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rental_shop_inclusions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rental_shop_service_locations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rental_shop_tours" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rental_shops" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."required_document_types" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."role_permissions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_roles" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";





REVOKE USAGE ON SCHEMA "public" FROM PUBLIC;
GRANT ALL ON SCHEMA "public" TO PUBLIC;
GRANT USAGE ON SCHEMA "public" TO "supabase_auth_admin";












































































































































































































GRANT ALL ON FUNCTION "public"."apply_flagged_content_changes"("flagged_content_id" "uuid", "admin_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."apply_flagged_content_changes"("flagged_content_id" "uuid", "admin_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."apply_flagged_content_changes"("flagged_content_id" "uuid", "admin_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."authorize"("requested_permission" "public"."app_permission") TO "anon";
GRANT ALL ON FUNCTION "public"."authorize"("requested_permission" "public"."app_permission") TO "authenticated";
GRANT ALL ON FUNCTION "public"."authorize"("requested_permission" "public"."app_permission") TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_freshness_status"("days_since_update" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_freshness_status"("days_since_update" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_freshness_status"("days_since_update" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."capture_daily_analytics_snapshot"() TO "anon";
GRANT ALL ON FUNCTION "public"."capture_daily_analytics_snapshot"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."capture_daily_analytics_snapshot"() TO "service_role";



GRANT ALL ON FUNCTION "public"."clear_all_data"() TO "anon";
GRANT ALL ON FUNCTION "public"."clear_all_data"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."clear_all_data"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."custom_access_token_hook"("event" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."custom_access_token_hook"("event" "jsonb") TO "supabase_auth_admin";
GRANT ALL ON FUNCTION "public"."custom_access_token_hook"("event" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."custom_access_token_hook"("event" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."custom_access_token_hook"("event" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."expire_premium_listings"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."expire_premium_listings"() TO "anon";
GRANT ALL ON FUNCTION "public"."expire_premium_listings"() TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_slug"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."generate_slug"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_slug"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_brand_distribution"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_brand_distribution"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_brand_distribution"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_category_distribution"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_category_distribution"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_category_distribution"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_data_freshness_stats"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_data_freshness_stats"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_data_freshness_stats"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_entities_by_freshness"("p_content_type" "public"."freshness_content_type", "p_freshness_status" "public"."freshness_status", "p_limit" integer, "p_offset" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_entities_by_freshness"("p_content_type" "public"."freshness_content_type", "p_freshness_status" "public"."freshness_status", "p_limit" integer, "p_offset" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_entities_by_freshness"("p_content_type" "public"."freshness_content_type", "p_freshness_status" "public"."freshness_status", "p_limit" integer, "p_offset" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_flagged_content_stats"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_flagged_content_stats"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_flagged_content_stats"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_geographic_distribution"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_geographic_distribution"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_geographic_distribution"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_premium_analytics_summary"("p_listing_id" "uuid", "p_start_date" "date", "p_end_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_premium_analytics_summary"("p_listing_id" "uuid", "p_start_date" "date", "p_end_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."get_premium_analytics_summary"("p_listing_id" "uuid", "p_start_date" "date", "p_end_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_premium_dashboard_stats"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_premium_dashboard_stats"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_premium_dashboard_stats"() TO "service_role";



GRANT ALL ON FUNCTION "public"."insert_daily_snapshot"() TO "anon";
GRANT ALL ON FUNCTION "public"."insert_daily_snapshot"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."insert_daily_snapshot"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."make_user_admin"("user_email" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."make_user_admin"("user_email" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."make_user_admin"("user_email" "text") TO "authenticated";



GRANT ALL ON FUNCTION "public"."parse_flagged_content_changes"() TO "anon";
GRANT ALL ON FUNCTION "public"."parse_flagged_content_changes"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."parse_flagged_content_changes"() TO "service_role";



GRANT ALL ON FUNCTION "public"."refresh_data_freshness"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."refresh_data_freshness"() TO "anon";
GRANT ALL ON FUNCTION "public"."refresh_data_freshness"() TO "service_role";



GRANT ALL ON FUNCTION "public"."remove_user_admin"("user_email" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."remove_user_admin"("user_email" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."remove_user_admin"("user_email" "text") TO "authenticated";



GRANT ALL ON FUNCTION "public"."rental_shops_slug_trigger"() TO "anon";
GRANT ALL ON FUNCTION "public"."rental_shops_slug_trigger"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rental_shops_slug_trigger"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_set_timestamp"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_set_timestamp"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_set_timestamp"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_entity_freshness"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_entity_freshness"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_entity_freshness"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";
























GRANT ALL ON TABLE "public"."analytics_snapshots" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."analytics_snapshots" TO "authenticated";
GRANT SELECT ON TABLE "public"."analytics_snapshots" TO "anon";



GRANT SELECT,USAGE ON SEQUENCE "public"."analytics_snapshots_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."analytics_snapshots_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."analytics_snapshots_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."brands" TO "anon";
GRANT ALL ON TABLE "public"."brands" TO "authenticated";
GRANT ALL ON TABLE "public"."brands" TO "service_role";



GRANT ALL ON TABLE "public"."business_statuses" TO "anon";
GRANT ALL ON TABLE "public"."business_statuses" TO "authenticated";
GRANT ALL ON TABLE "public"."business_statuses" TO "service_role";



GRANT SELECT,USAGE ON SEQUENCE "public"."business_statuses_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."business_statuses_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."business_statuses_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."categories" TO "anon";
GRANT ALL ON TABLE "public"."categories" TO "authenticated";
GRANT ALL ON TABLE "public"."categories" TO "service_role";



GRANT ALL ON TABLE "public"."cities" TO "anon";
GRANT ALL ON TABLE "public"."cities" TO "authenticated";
GRANT ALL ON TABLE "public"."cities" TO "service_role";



GRANT ALL ON TABLE "public"."condition_types" TO "anon";
GRANT ALL ON TABLE "public"."condition_types" TO "authenticated";
GRANT ALL ON TABLE "public"."condition_types" TO "service_role";



GRANT ALL ON TABLE "public"."countries" TO "anon";
GRANT ALL ON TABLE "public"."countries" TO "authenticated";
GRANT ALL ON TABLE "public"."countries" TO "service_role";



GRANT ALL ON TABLE "public"."data_freshness" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."data_freshness" TO "authenticated";
GRANT SELECT ON TABLE "public"."data_freshness" TO "anon";



GRANT ALL ON TABLE "public"."features" TO "anon";
GRANT ALL ON TABLE "public"."features" TO "authenticated";
GRANT ALL ON TABLE "public"."features" TO "service_role";



GRANT ALL ON TABLE "public"."flagged_content" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."flagged_content" TO "authenticated";
GRANT SELECT ON TABLE "public"."flagged_content" TO "anon";



GRANT ALL ON TABLE "public"."flagged_content_changes" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."flagged_content_changes" TO "authenticated";
GRANT SELECT ON TABLE "public"."flagged_content_changes" TO "anon";



GRANT ALL ON TABLE "public"."images" TO "anon";
GRANT ALL ON TABLE "public"."images" TO "authenticated";
GRANT ALL ON TABLE "public"."images" TO "service_role";



GRANT ALL ON TABLE "public"."insurance_types" TO "anon";
GRANT ALL ON TABLE "public"."insurance_types" TO "authenticated";
GRANT ALL ON TABLE "public"."insurance_types" TO "service_role";



GRANT ALL ON TABLE "public"."motorcycle_conditions" TO "anon";
GRANT ALL ON TABLE "public"."motorcycle_conditions" TO "authenticated";
GRANT ALL ON TABLE "public"."motorcycle_conditions" TO "service_role";



GRANT ALL ON TABLE "public"."motorcycle_features" TO "anon";
GRANT ALL ON TABLE "public"."motorcycle_features" TO "authenticated";
GRANT ALL ON TABLE "public"."motorcycle_features" TO "service_role";



GRANT ALL ON TABLE "public"."motorcycle_images" TO "anon";
GRANT ALL ON TABLE "public"."motorcycle_images" TO "authenticated";
GRANT ALL ON TABLE "public"."motorcycle_images" TO "service_role";



GRANT ALL ON TABLE "public"."motorcycle_insurance_details" TO "anon";
GRANT ALL ON TABLE "public"."motorcycle_insurance_details" TO "authenticated";
GRANT ALL ON TABLE "public"."motorcycle_insurance_details" TO "service_role";



GRANT ALL ON TABLE "public"."motorcycle_rentals" TO "anon";
GRANT ALL ON TABLE "public"."motorcycle_rentals" TO "authenticated";
GRANT ALL ON TABLE "public"."motorcycle_rentals" TO "service_role";



GRANT ALL ON TABLE "public"."motorcycle_required_documents" TO "anon";
GRANT ALL ON TABLE "public"."motorcycle_required_documents" TO "authenticated";
GRANT ALL ON TABLE "public"."motorcycle_required_documents" TO "service_role";



GRANT ALL ON TABLE "public"."premium_analytics" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."premium_analytics" TO "authenticated";
GRANT SELECT ON TABLE "public"."premium_analytics" TO "anon";



GRANT ALL ON TABLE "public"."premium_listings" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."premium_listings" TO "authenticated";
GRANT SELECT ON TABLE "public"."premium_listings" TO "anon";



GRANT ALL ON TABLE "public"."premium_pricing_plans" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."premium_pricing_plans" TO "authenticated";
GRANT SELECT ON TABLE "public"."premium_pricing_plans" TO "anon";



GRANT ALL ON TABLE "public"."provinces" TO "anon";
GRANT ALL ON TABLE "public"."provinces" TO "authenticated";
GRANT ALL ON TABLE "public"."provinces" TO "service_role";



GRANT ALL ON TABLE "public"."rental_rate_tiers" TO "anon";
GRANT ALL ON TABLE "public"."rental_rate_tiers" TO "authenticated";
GRANT ALL ON TABLE "public"."rental_rate_tiers" TO "service_role";



GRANT ALL ON TABLE "public"."rental_shop_conditions" TO "anon";
GRANT ALL ON TABLE "public"."rental_shop_conditions" TO "authenticated";
GRANT ALL ON TABLE "public"."rental_shop_conditions" TO "service_role";



GRANT ALL ON TABLE "public"."rental_shop_inclusions" TO "anon";
GRANT ALL ON TABLE "public"."rental_shop_inclusions" TO "authenticated";
GRANT ALL ON TABLE "public"."rental_shop_inclusions" TO "service_role";



GRANT ALL ON TABLE "public"."rental_shop_service_locations" TO "anon";
GRANT ALL ON TABLE "public"."rental_shop_service_locations" TO "authenticated";
GRANT ALL ON TABLE "public"."rental_shop_service_locations" TO "service_role";



GRANT ALL ON TABLE "public"."rental_shop_tours" TO "anon";
GRANT ALL ON TABLE "public"."rental_shop_tours" TO "authenticated";
GRANT ALL ON TABLE "public"."rental_shop_tours" TO "service_role";



GRANT ALL ON TABLE "public"."rental_shops" TO "anon";
GRANT ALL ON TABLE "public"."rental_shops" TO "authenticated";
GRANT ALL ON TABLE "public"."rental_shops" TO "service_role";



GRANT ALL ON TABLE "public"."required_document_types" TO "anon";
GRANT ALL ON TABLE "public"."required_document_types" TO "authenticated";
GRANT ALL ON TABLE "public"."required_document_types" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."role_permissions" TO "authenticated";
GRANT ALL ON TABLE "public"."role_permissions" TO "service_role";
GRANT SELECT ON TABLE "public"."role_permissions" TO "anon";



GRANT SELECT,USAGE ON SEQUENCE "public"."role_permissions_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."role_permissions_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."role_permissions_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."user_roles" TO "supabase_auth_admin";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."user_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_roles" TO "service_role";
GRANT SELECT ON TABLE "public"."user_roles" TO "anon";



GRANT SELECT,USAGE ON SEQUENCE "public"."user_roles_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."user_roles_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."user_roles_id_seq" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT SELECT,USAGE ON SEQUENCES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT SELECT ON TABLES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT SELECT,INSERT,DELETE,UPDATE ON TABLES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "service_role";



























RESET ALL;
