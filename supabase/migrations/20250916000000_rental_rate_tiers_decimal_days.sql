-- Migration: Support hourly and half-day rentals by converting min_days and max_days to decimal values
-- 
-- This migration changes the rental_rate_tiers table to allow fractional days:
-- - 0.5 = half day
-- - 0.042 (1/24) = 1 hour
-- - 0.125 (3/24) = 3 hours
-- etc.
--
-- This is a SAFE migration because:
-- 1. All existing integer values (1, 2, 3, etc.) are valid numeric values
-- 2. PostgreSQL automatically converts integers to numeric during the ALTER
-- 3. No data loss occurs
-- 4. Existing queries continue to work

-- Change min_days from integer to numeric to support fractional days
ALTER TABLE rental_rate_tiers 
  ALTER COLUMN min_days TYPE NUMERIC(10, 4);

-- Change max_days from integer to numeric to support fractional days
ALTER TABLE rental_rate_tiers 
  ALTER COLUMN max_days TYPE NUMERIC(10, 4);

-- Add a comment to document the change
COMMENT ON COLUMN rental_rate_tiers.min_days IS 'Minimum rental duration in days (supports decimals for hourly rentals, e.g., 0.5 for half-day, 0.042 for 1 hour)';
COMMENT ON COLUMN rental_rate_tiers.max_days IS 'Maximum rental duration in days (supports decimals for hourly rentals, e.g., 0.5 for half-day, 0.042 for 1 hour)';

-- Verify the migration worked (this will output the new column types)
SELECT 
  column_name, 
  data_type, 
  numeric_precision, 
  numeric_scale
FROM information_schema.columns 
WHERE table_name = 'rental_rate_tiers' 
  AND column_name IN ('min_days', 'max_days');

