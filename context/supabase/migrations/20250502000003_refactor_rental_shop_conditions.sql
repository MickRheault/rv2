-- Create a junction table for rental shop conditions
CREATE TABLE IF NOT EXISTS rental_shop_conditions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID NOT NULL REFERENCES rental_shops(id) ON DELETE CASCADE,
    condition_type_id UUID NOT NULL REFERENCES condition_types(id) ON DELETE CASCADE,
    condition_value TEXT NOT NULL, -- Stores the actual value of the condition, e.g., "21", "Required", "THB 2000"
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (shop_id, condition_type_id) -- Ensures a shop doesn't have duplicate condition types
);

-- Add comments to the new tables and columns
COMMENT ON TABLE rental_shop_conditions IS 'Junction table linking rental shops to their specific conditions and values.';
COMMENT ON COLUMN rental_shop_conditions.shop_id IS 'Foreign key referencing the rental shop.';
COMMENT ON COLUMN rental_shop_conditions.condition_type_id IS 'Foreign key referencing the type of condition from the shared condition_types table.';
COMMENT ON COLUMN rental_shop_conditions.condition_value IS 'The specific value for this condition at this shop (e.g., "21", "International Driving Permit", "THB 3000").';
COMMENT ON COLUMN rental_shop_conditions.notes IS 'Any additional notes or details about this specific condition for the shop.';

-- Remove old columns from rental_shops table
ALTER TABLE rental_shops
DROP COLUMN IF EXISTS age_requirement,
DROP COLUMN IF EXISTS license_requirement,
DROP COLUMN IF EXISTS visa_requirement,
DROP COLUMN IF EXISTS security_deposit_details;

-- Optional: Trigger to update updated_at timestamp on rental_shop_conditions
CREATE OR REPLACE TRIGGER handle_rental_shop_conditions_updated_at
BEFORE UPDATE ON rental_shop_conditions
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp(); 