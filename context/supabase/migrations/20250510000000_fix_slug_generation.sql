-- Fix slug generation to properly handle Unicode characters
CREATE OR REPLACE FUNCTION generate_slug(text) RETURNS text AS $$
DECLARE
  result text;
BEGIN
  -- Convert to lowercase and replace spaces/special chars with hyphens
  result := lower($1);
  
  -- Replace multiple whitespace with single space
  result := regexp_replace(result, '\s+', ' ', 'g');
  
  -- Replace spaces with hyphens
  result := regexp_replace(result, '\s', '-', 'g');
  
  -- Remove or replace problematic characters for URLs but keep Unicode chars
  -- Only remove actual problematic URL characters
  result := regexp_replace(result, '[<>:"\\|?*%#\[\]{}^`]', '', 'g');
  
  -- Replace multiple hyphens with single hyphen
  result := regexp_replace(result, '-+', '-', 'g');
  
  -- Remove leading/trailing hyphens
  result := regexp_replace(result, '^-+|-+$', '', 'g');
  
  RETURN result;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Regenerate slugs for existing shops with the new function
UPDATE rental_shops 
SET slug = generate_slug(provider_name);

-- Update the trigger to use the new function
DROP TRIGGER IF EXISTS set_rental_shops_slug ON rental_shops;
CREATE OR REPLACE FUNCTION rental_shops_slug_trigger()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    NEW.slug := generate_slug(NEW.provider_name);
    
    -- Ensure uniqueness by appending shop ID if needed
    IF EXISTS (SELECT 1 FROM rental_shops WHERE slug = NEW.slug AND id != NEW.id) THEN
      NEW.slug := NEW.slug || '-' || substring(NEW.id::text, 1, 8);
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_rental_shops_slug
BEFORE INSERT OR UPDATE ON rental_shops
FOR EACH ROW
EXECUTE FUNCTION rental_shops_slug_trigger(); 