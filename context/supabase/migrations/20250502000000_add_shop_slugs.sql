-- Add slug column to rental_shops table
ALTER TABLE rental_shops ADD COLUMN slug TEXT;

-- Add extension for unaccent if not exists
CREATE EXTENSION IF NOT EXISTS unaccent;

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

-- Make slug unique and not null
ALTER TABLE rental_shops ALTER COLUMN slug SET NOT NULL;
CREATE UNIQUE INDEX rental_shops_slug_idx ON rental_shops (slug);

-- Create trigger to automatically generate slug on insert
CREATE OR REPLACE FUNCTION rental_shops_slug_trigger()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.slug IS NULL THEN
    NEW.slug := generate_slug(NEW.provider_name) || '-' || substring(NEW.id::text, 1, 8);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_rental_shops_slug
BEFORE INSERT ON rental_shops
FOR EACH ROW
EXECUTE FUNCTION rental_shops_slug_trigger(); 