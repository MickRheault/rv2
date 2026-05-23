-- Fix search path mutable issue for public functions
-- Pinning search_path to 'public, extensions' allows functions to securely access public tables and extensions.

ALTER FUNCTION public.insert_daily_snapshot() SET search_path = public, extensions;
ALTER FUNCTION public.apply_flagged_content_changes(uuid, uuid) SET search_path = public, extensions;
ALTER FUNCTION public.get_entities_by_freshness(public.freshness_content_type, public.freshness_status, integer, integer) SET search_path = public, extensions;
ALTER FUNCTION public.parse_flagged_content_changes() SET search_path = public, extensions;
ALTER FUNCTION public.clear_all_data() SET search_path = public, extensions;
ALTER FUNCTION public.remove_user_admin(text) SET search_path = public, extensions;
ALTER FUNCTION public.make_user_admin(text) SET search_path = public, extensions;
ALTER FUNCTION public.update_updated_at_column() SET search_path = public, extensions;
ALTER FUNCTION public.expire_premium_listings() SET search_path = public, extensions;
ALTER FUNCTION public.get_premium_analytics_summary(uuid, date, date) SET search_path = public, extensions;
ALTER FUNCTION public.calculate_freshness_status(integer) SET search_path = public, extensions;
ALTER FUNCTION public.get_brand_distribution() SET search_path = public, extensions;
ALTER FUNCTION public.get_geographic_distribution() SET search_path = public, extensions;
ALTER FUNCTION public.get_category_distribution() SET search_path = public, extensions;
ALTER FUNCTION public.capture_daily_analytics_snapshot() SET search_path = public, extensions;
ALTER FUNCTION public.refresh_data_freshness() SET search_path = public, extensions;
ALTER FUNCTION public.get_data_freshness_stats() SET search_path = public, extensions;
