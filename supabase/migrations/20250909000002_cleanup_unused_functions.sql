-- Remove unused location search functions and materialized view
-- These functions were created for performance optimization but are not being used in the application

-- Drop triggers first (they depend on the functions)
DROP TRIGGER IF EXISTS refresh_location_counts_on_motorcycle_change ON motorcycle_rentals;
DROP TRIGGER IF EXISTS refresh_location_counts_on_shop_change ON rental_shops;

-- Drop the unused functions
DROP FUNCTION IF EXISTS search_locations_with_counts(text, integer);
DROP FUNCTION IF EXISTS refresh_location_counts();
DROP FUNCTION IF EXISTS trigger_location_counts_refresh();
DROP FUNCTION IF EXISTS get_query_performance_stats();

-- Drop the materialized view (and its indexes)
DROP INDEX IF EXISTS idx_mv_location_counts_city;
DROP INDEX IF EXISTS idx_mv_location_counts_province;
DROP INDEX IF EXISTS idx_mv_location_counts_country;
DROP MATERIALIZED VIEW IF EXISTS mv_location_motorcycle_counts;

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Successfully removed unused location search infrastructure:';
    RAISE NOTICE '- Dropped 4 unused functions';
    RAISE NOTICE '- Dropped 2 database triggers';
    RAISE NOTICE '- Dropped materialized view and 3 indexes';
    RAISE NOTICE '- Database cleanup completed';
END
$$;

