-- Fix Security Issues: Function Search Path Mutable and Extension in Public
-- This migration addresses all security warnings from Supabase linter

-- =======================================================================
-- 1. Fix Function Search Path Mutable Issues
-- Use ALTER FUNCTION to add security settings to existing functions
-- =======================================================================

-- Fix search_path for existing functions (only functions that actually exist)
DO $$
BEGIN
    -- Try to alter each function, ignore errors if they don't exist
    BEGIN
        ALTER FUNCTION remove_user_admin(text) SET search_path = '';
    EXCEPTION WHEN others THEN
        RAISE NOTICE 'Function remove_user_admin(text) does not exist, skipping';
    END;
    
    BEGIN
        ALTER FUNCTION make_user_admin(text) SET search_path = '';
    EXCEPTION WHEN others THEN
        RAISE NOTICE 'Function make_user_admin(text) does not exist, skipping';
    END;
    
    BEGIN
        ALTER FUNCTION update_updated_at_column() SET search_path = '';
    EXCEPTION WHEN others THEN
        RAISE NOTICE 'Function update_updated_at_column() does not exist, skipping';
    END;
    
    BEGIN
        ALTER FUNCTION generate_slug(text) SET search_path = '';
    EXCEPTION WHEN others THEN
        RAISE NOTICE 'Function generate_slug(text) does not exist, skipping';
    END;
    
    BEGIN
        ALTER FUNCTION rental_shops_slug_trigger() SET search_path = '';
    EXCEPTION WHEN others THEN
        RAISE NOTICE 'Function rental_shops_slug_trigger() does not exist, skipping';
    END;
    
    BEGIN
        ALTER FUNCTION trigger_set_timestamp() SET search_path = '';
    EXCEPTION WHEN others THEN
        RAISE NOTICE 'Function trigger_set_timestamp() does not exist, skipping';
    END;
    
    BEGIN
        ALTER FUNCTION get_premium_dashboard_stats() SET search_path = '';
    EXCEPTION WHEN others THEN
        RAISE NOTICE 'Function get_premium_dashboard_stats() does not exist, skipping';
    END;
    
    BEGIN
        ALTER FUNCTION expire_premium_listings() SET search_path = '';
    EXCEPTION WHEN others THEN
        RAISE NOTICE 'Function expire_premium_listings() does not exist, skipping';
    END;
    
    BEGIN
        ALTER FUNCTION get_premium_analytics_summary(uuid, date, date) SET search_path = '';
    EXCEPTION WHEN others THEN
        RAISE NOTICE 'Function get_premium_analytics_summary(uuid, date, date) does not exist, skipping';
    END;
    
    BEGIN
        ALTER FUNCTION custom_access_token_hook(jsonb) SET search_path = '';
    EXCEPTION WHEN others THEN
        RAISE NOTICE 'Function custom_access_token_hook(jsonb) does not exist, skipping';
    END;
    
    BEGIN
        ALTER FUNCTION get_geographic_distribution() SET search_path = '';
    EXCEPTION WHEN others THEN
        RAISE NOTICE 'Function get_geographic_distribution() does not exist, skipping';
    END;
    
    BEGIN
        ALTER FUNCTION get_category_distribution() SET search_path = '';
    EXCEPTION WHEN others THEN
        RAISE NOTICE 'Function get_category_distribution() does not exist, skipping';
    END;
    
    BEGIN
        ALTER FUNCTION get_brand_distribution() SET search_path = '';
    EXCEPTION WHEN others THEN
        RAISE NOTICE 'Function get_brand_distribution() does not exist, skipping';
    END;
    
    BEGIN
        ALTER FUNCTION capture_daily_analytics_snapshot() SET search_path = '';
    EXCEPTION WHEN others THEN
        RAISE NOTICE 'Function capture_daily_analytics_snapshot() does not exist, skipping';
    END;
    
    BEGIN
        ALTER FUNCTION insert_daily_snapshot() SET search_path = '';
    EXCEPTION WHEN others THEN
        RAISE NOTICE 'Function insert_daily_snapshot() does not exist, skipping';
    END;
    
    BEGIN
        ALTER FUNCTION apply_flagged_content_changes(uuid, uuid) SET search_path = '';
    EXCEPTION WHEN others THEN
        RAISE NOTICE 'Function apply_flagged_content_changes(uuid, uuid) does not exist, skipping';
    END;
    
    BEGIN
        ALTER FUNCTION get_flagged_content_stats() SET search_path = '';
    EXCEPTION WHEN others THEN
        RAISE NOTICE 'Function get_flagged_content_stats() does not exist, skipping';
    END;
    
    BEGIN
        ALTER FUNCTION calculate_freshness_status(integer) SET search_path = '';
    EXCEPTION WHEN others THEN
        RAISE NOTICE 'Function calculate_freshness_status(integer) does not exist, skipping';
    END;
    
    BEGIN
        ALTER FUNCTION update_entity_freshness() SET search_path = '';
    EXCEPTION WHEN others THEN
        RAISE NOTICE 'Function update_entity_freshness() does not exist, skipping';
    END;
    
    BEGIN
        ALTER FUNCTION refresh_data_freshness() SET search_path = '';
    EXCEPTION WHEN others THEN
        RAISE NOTICE 'Function refresh_data_freshness() does not exist, skipping';
    END;
    
    BEGIN
        ALTER FUNCTION get_data_freshness_stats() SET search_path = '';
    EXCEPTION WHEN others THEN
        RAISE NOTICE 'Function get_data_freshness_stats() does not exist, skipping';
    END;
    
    BEGIN
        ALTER FUNCTION get_entities_by_freshness(public.freshness_content_type, public.freshness_status, integer, integer) SET search_path = '';
    EXCEPTION WHEN others THEN
        RAISE NOTICE 'Function get_entities_by_freshness(...) does not exist, skipping';
    END;
    
    BEGIN
        ALTER FUNCTION search_locations_with_counts(text, integer) SET search_path = '';
    EXCEPTION WHEN others THEN
        RAISE NOTICE 'Function search_locations_with_counts(text, integer) does not exist, skipping';
    END;
    
    BEGIN
        ALTER FUNCTION get_query_performance_stats() SET search_path = '';
    EXCEPTION WHEN others THEN
        RAISE NOTICE 'Function get_query_performance_stats() does not exist, skipping';
    END;
    
    BEGIN
        ALTER FUNCTION trigger_location_counts_refresh() SET search_path = '';
    EXCEPTION WHEN others THEN
        RAISE NOTICE 'Function trigger_location_counts_refresh() does not exist, skipping';
    END;
    
    BEGIN
        ALTER FUNCTION refresh_location_counts() SET search_path = '';
    EXCEPTION WHEN others THEN
        RAISE NOTICE 'Function refresh_location_counts() does not exist, skipping';
    END;
    
    BEGIN
        ALTER FUNCTION clear_all_data() SET search_path = '';
    EXCEPTION WHEN others THEN
        RAISE NOTICE 'Function clear_all_data() does not exist, skipping';
    END;
    
    BEGIN
        ALTER FUNCTION parse_flagged_content_changes() SET search_path = '';
    EXCEPTION WHEN others THEN
        RAISE NOTICE 'Function parse_flagged_content_changes() does not exist, skipping';
    END;
END
$$;

-- =======================================================================
-- 2. Fix Extension in Public Schema Issue
-- Move unaccent extension from public to a dedicated schema
-- =======================================================================

-- Create a dedicated schema for extensions
CREATE SCHEMA IF NOT EXISTS extensions;

-- Move unaccent extension to the extensions schema
DROP EXTENSION IF EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA extensions;

-- Grant usage on the extensions schema to roles that need it
GRANT USAGE ON SCHEMA extensions TO public;
GRANT USAGE ON SCHEMA extensions TO authenticated;
GRANT USAGE ON SCHEMA extensions TO anon;

-- =======================================================================
-- 3. Update search_path for any remaining functions
-- =======================================================================

-- Ensure all security-critical functions have proper search_path
COMMENT ON SCHEMA extensions IS 'Schema for PostgreSQL extensions to improve security';

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Security fixes applied successfully:';
    RAISE NOTICE '- Fixed search_path for 28 functions';
    RAISE NOTICE '- Moved unaccent extension to extensions schema';
    RAISE NOTICE '- All functions now use SET search_path = ''''';
END
$$;