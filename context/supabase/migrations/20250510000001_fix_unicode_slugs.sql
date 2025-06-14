-- Fix slug generation to properly handle Unicode characters (comprehensive fix)
-- This migration ensures proper handling of international characters

-- First, let's create a robust slug generation function
CREATE OR REPLACE FUNCTION generate_slug(input_text text) RETURNS text AS $$
DECLARE
  result text;
BEGIN
  -- Handle null or empty input
  IF input_text IS NULL OR trim(input_text) = '' THEN
    RETURN 'unnamed-shop';
  END IF;
  
  -- Start with the input text
  result := trim(input_text);
  
  -- Convert to lowercase
  result := lower(result);
  
  -- Replace multiple whitespace/tabs/newlines with single space
  result := regexp_replace(result, '\s+', ' ', 'g');
  
  -- Replace spaces with hyphens
  result := regexp_replace(result, '\s', '-', 'g');
  
  -- Remove only truly problematic URL characters, keep Unicode
  -- Remove: < > " \ | ? * % # [ ] { } ^ ` and control characters
  result := regexp_replace(result, '[<>:"\\|?*%#\[\]{}^`\x00-\x1F\x7F]', '', 'g');
  
  -- Remove/replace other problematic characters for URLs
  result := regexp_replace(result, '[&+=@!$'',;]', '', 'g');
  
  -- Replace multiple hyphens with single hyphen
  result := regexp_replace(result, '-+', '-', 'g');
  
  -- Remove leading/trailing hyphens
  result := regexp_replace(result, '^-+|-+$', '', 'g');
  
  -- Ensure we have something left
  IF result = '' THEN
    result := 'shop';
  END IF;
  
  -- Limit length to reasonable URL length
  IF length(result) > 100 THEN
    result := left(result, 100);
    -- Remove trailing hyphen if we cut in the middle
    result := regexp_replace(result, '-$', '');
  END IF;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to generate unique slug for a specific shop
CREATE OR REPLACE FUNCTION generate_unique_slug(shop_id uuid, provider_name text) RETURNS text AS $$
DECLARE
  base_slug text;
  final_slug text;
  counter integer := 0;
  id_suffix text;
BEGIN
  -- Generate base slug
  base_slug := generate_slug(provider_name);
  final_slug := base_slug;
  
  -- Check if slug already exists for other shops
  WHILE EXISTS (
    SELECT 1 FROM rental_shops 
    WHERE slug = final_slug 
    AND (shop_id IS NULL OR id != shop_id)
  ) LOOP
    counter := counter + 1;
    
    -- After 3 attempts, use shop ID for uniqueness
    IF counter > 3 THEN
      id_suffix := substring(shop_id::text, 1, 8);
      final_slug := base_slug || '-' || id_suffix;
      EXIT;
    ELSE
      final_slug := base_slug || '-' || counter::text;
    END IF;
  END LOOP;
  
  RETURN final_slug;
END;
$$ LANGUAGE plpgsql;

-- Update trigger function to use the new logic
CREATE OR REPLACE FUNCTION rental_shops_slug_trigger()
RETURNS TRIGGER AS $$
BEGIN
  -- Always regenerate slug if provider_name changed or slug is empty
  IF NEW.slug IS NULL OR NEW.slug = '' OR 
     (TG_OP = 'UPDATE' AND OLD.provider_name != NEW.provider_name) THEN
    NEW.slug := generate_unique_slug(NEW.id, NEW.provider_name);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop and recreate trigger
DROP TRIGGER IF EXISTS set_rental_shops_slug ON rental_shops;
CREATE TRIGGER set_rental_shops_slug
  BEFORE INSERT OR UPDATE ON rental_shops
  FOR EACH ROW
  EXECUTE FUNCTION rental_shops_slug_trigger();

-- Regenerate all slugs with the new function
-- This will fix existing slugs that had Unicode characters stripped
UPDATE rental_shops 
SET slug = generate_unique_slug(id, provider_name)
WHERE provider_name IS NOT NULL;

-- Handle any shops with NULL provider_name
UPDATE rental_shops 
SET slug = 'shop-' || substring(id::text, 1, 8)
WHERE provider_name IS NULL AND slug IS NULL;

-- Add a comment to track this fix
COMMENT ON FUNCTION generate_slug(text) IS 'Unicode-friendly slug generation function - updated 2025-01-04'; 