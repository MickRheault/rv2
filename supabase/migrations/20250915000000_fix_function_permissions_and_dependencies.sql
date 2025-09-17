-- Fix function permissions and dependencies after schema rebuild
-- This migration addresses issues that occurred after the database teardown and rebuild

-- Grant execute permissions on all functions to necessary roles
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;

-- Set default privileges for future functions
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;

-- Grant basic table permissions to all roles (CRITICAL: missing after teardown)
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;

-- Set default privileges for future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO anon;

-- Fix sequence permissions that were missing after teardown
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT UPDATE ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;

-- Set default privileges for future sequences
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT UPDATE ON SEQUENCES TO authenticated, service_role;

-- Recreate generate_slug function with robust implementation
-- The original function had dependency issues with unaccent extension
-- Must use exact signature generate_slug(text) that scripts expect
DROP FUNCTION IF EXISTS generate_slug(input_text text);
DROP FUNCTION IF EXISTS generate_slug(text);

CREATE OR REPLACE FUNCTION generate_slug(text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  -- Simple slug generation without external dependencies
  -- Convert to lowercase, replace non-alphanumeric with hyphens, clean up
  -- Use $1 to reference the unnamed parameter
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
$$;

-- Grant permissions on the recreated function
GRANT EXECUTE ON FUNCTION generate_slug(text) TO anon, authenticated, service_role;

-- Fix other functions that had search path issues
CREATE OR REPLACE FUNCTION rental_shops_slug_trigger()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.slug IS NULL THEN
    NEW.slug := public.generate_slug(NEW.provider_name);
  END IF;
  RETURN NEW;
END;
$$;

-- Fix the authorize function with proper schema references
CREATE OR REPLACE FUNCTION authorize(requested_permission app_permission)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
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

-- Fix the custom_access_token_hook function
CREATE OR REPLACE FUNCTION custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
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

-- Fix the is_admin function to be more reliable
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
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

-- Fix the get_premium_dashboard_stats function
CREATE OR REPLACE FUNCTION get_premium_dashboard_stats()
RETURNS TABLE(
    total_active_listings bigint, 
    total_expired_listings bigint, 
    expiring_soon bigint, 
    revenue_this_month numeric, 
    revenue_last_month numeric, 
    new_listings_this_month bigint
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
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

-- Fix the get_flagged_content_stats function
CREATE OR REPLACE FUNCTION get_flagged_content_stats()
RETURNS TABLE(
    total_pending integer, 
    total_under_review integer, 
    total_approved integer, 
    total_applied integer, 
    total_rejected integer, 
    critical_pending integer, 
    motorcycle_flags integer, 
    rental_shop_flags integer
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
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

-- Fix trigger functions that had search path issues
CREATE OR REPLACE FUNCTION update_entity_freshness()
RETURNS trigger
LANGUAGE plpgsql
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

-- Fix the trigger_set_timestamp function  
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Account passwords are managed through Supabase Auth, outside migrations.

-- Log completion
SELECT 'Function permissions and dependencies fixed successfully' as status;
