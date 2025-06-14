-- Add business_description column to rental_shops table
ALTER TABLE rental_shops 
ADD COLUMN business_description TEXT;

-- Add comment to the new column
COMMENT ON COLUMN rental_shops.business_description IS 'Detailed description of the business, including history, mission, services, and other overview information.';

-- Optional: Add some sample data for existing shops (you can remove this if not needed)
-- UPDATE rental_shops 
-- SET business_description = 'Welcome to ' || provider_name || '! We are a trusted motorcycle rental service providing quality bikes and excellent customer service in ' || location_name || '. Contact us for the best rental experience in the area.'
-- WHERE business_description IS NULL AND provider_name IS NOT NULL; 