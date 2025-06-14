

-- Create a function to generate slug from provider_name
CREATE OR REPLACE FUNCTION generate_slug(text) RETURNS text AS $$
  SELECT 
    lower(
      regexp_replace(
        regexp_replace(
          unaccent($1), 
          '[^\w\s-]', 
          '', 
          'g'
        ),
        '\s+', 
        '-', 
        'g'
      )
    );
$$ LANGUAGE sql IMMUTABLE;

-- Generate initial slugs for existing shops
UPDATE rental_shops
SET slug = generate_slug(provider_name);

-- Create trigger to automatically generate slug on insert
CREATE OR REPLACE FUNCTION rental_shops_slug_trigger()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.slug IS NULL THEN
    NEW.slug := generate_slug(NEW.provider_name);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;