-- Add rental condition fields to rental_shops
ALTER TABLE rental_shops
ADD COLUMN IF NOT EXISTS age_requirement TEXT,
ADD COLUMN IF NOT EXISTS license_requirement TEXT,
ADD COLUMN IF NOT EXISTS visa_requirement TEXT,
ADD COLUMN IF NOT EXISTS security_deposit_details TEXT;

-- Create rental_shop_inclusions table
CREATE TABLE IF NOT EXISTS rental_shop_inclusions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID NOT NULL REFERENCES rental_shops(id) ON DELETE CASCADE,
    inclusion_text TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create rental_shop_service_locations table
CREATE TABLE IF NOT EXISTS rental_shop_service_locations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID NOT NULL REFERENCES rental_shops(id) ON DELETE CASCADE,
    location_name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create rental_shop_tours table
CREATE TABLE IF NOT EXISTS rental_shop_tours (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID NOT NULL REFERENCES rental_shops(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    duration_text TEXT,
    distance_km NUMERIC(10, 2),
    price_text TEXT,
    currency CHAR(3),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add indexes for the new tables
CREATE INDEX IF NOT EXISTS idx_rsi_shop_id ON rental_shop_inclusions (shop_id);
CREATE INDEX IF NOT EXISTS idx_rssl_shop_id ON rental_shop_service_locations (shop_id);
CREATE INDEX IF NOT EXISTS idx_rst_shop_id ON rental_shop_tours (shop_id);

-- Apply updated_at trigger to new tables
CREATE TRIGGER set_timestamp_rental_shop_inclusions
    BEFORE UPDATE ON rental_shop_inclusions
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_timestamp();

CREATE TRIGGER set_timestamp_rental_shop_service_locations
    BEFORE UPDATE ON rental_shop_service_locations
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_timestamp();

CREATE TRIGGER set_timestamp_rental_shop_tours
    BEFORE UPDATE ON rental_shop_tours
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_timestamp(); 