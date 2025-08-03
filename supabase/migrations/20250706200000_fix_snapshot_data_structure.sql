-- This migration updates the capture_daily_analytics_snapshot function
-- to create a JSONB structure that is consistent with the live AnalyticsData type.

CREATE OR REPLACE FUNCTION capture_daily_analytics_snapshot()
RETURNS jsonb AS $$
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
$$ LANGUAGE plpgsql;

-- We also need to update the function that calls this one.
CREATE OR REPLACE FUNCTION insert_daily_snapshot()
RETURNS void AS $$
BEGIN
  INSERT INTO public.analytics_snapshots (data)
  SELECT capture_daily_analytics_snapshot();
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER; 