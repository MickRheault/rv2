-- Fix specific Unicode slug issues and add debugging

-- Check if we have the problematic shop and show current state
DO $$
DECLARE
  shop_record RECORD;
  test_slug text;
BEGIN
  -- Look for shops with Unicode characters in provider_name that might have bad slugs
  FOR shop_record IN 
    SELECT id, provider_name, slug 
    FROM rental_shops 
    WHERE provider_name ~ '[^\x00-\x7F]' -- Contains non-ASCII characters
    ORDER BY provider_name
  LOOP
    -- Generate what the slug should be
    test_slug := generate_unique_slug(shop_record.id, shop_record.provider_name);
    
    -- If current slug doesn't match what it should be, log it
    IF shop_record.slug != test_slug THEN
      RAISE NOTICE 'Shop ID: %, Name: "%" Current slug: "%" Should be: "%"', 
        shop_record.id, 
        shop_record.provider_name, 
        shop_record.slug, 
        test_slug;
    END IF;
  END LOOP;
END $$;

-- Update any shops that still have problematic slugs
UPDATE rental_shops 
SET slug = generate_unique_slug(id, provider_name)
WHERE slug IS NULL 
   OR slug = '' 
   OR provider_name ~ '[^\x00-\x7F]'; -- Has Unicode characters

-- Verify the fix worked
DO $$
DECLARE
  problematic_count integer;
BEGIN
  -- Count shops where the slug doesn't contain Unicode but provider_name does
  SELECT COUNT(*) INTO problematic_count
  FROM rental_shops 
  WHERE provider_name ~ '[^\x00-\x7F]' -- Contains Unicode
    AND slug !~ '[^\x00-\x7F]'; -- Slug doesn't contain Unicode
    
  IF problematic_count > 0 THEN
    RAISE NOTICE 'Still have % shops with Unicode in name but not in slug', problematic_count;
  ELSE
    RAISE NOTICE 'All shops with Unicode names now have proper slugs';
  END IF;
END $$; 