-- This migration updates the insert_daily_snapshot function
-- to run with SECURITY DEFINER, allowing admins to trigger it manually.

CREATE OR REPLACE FUNCTION insert_daily_snapshot()
RETURNS void AS $$
BEGIN
  INSERT INTO public.analytics_snapshots (data)
  SELECT capture_daily_analytics_snapshot();
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER; 