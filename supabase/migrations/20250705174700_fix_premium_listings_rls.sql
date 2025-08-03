-- Fix premium listings RLS policy for public read access
-- Created: 2025-07-05 17:47:00
-- Purpose: Allow public read access to active premium listings for display

-- Add public read policy for active premium listings
CREATE POLICY "Public can read active premium listings"
ON premium_listings FOR SELECT
TO authenticated, anon
USING (status = 'active' AND end_date > CURRENT_DATE); 