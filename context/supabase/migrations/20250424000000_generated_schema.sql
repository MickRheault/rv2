-- PostgreSQL Schema for Motorcycle Rentals (Merged Shop/Provider)
-- Generated: [You can add the date here]

-- Enable UUID generation if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- === Geographic Lookup Tables ===

CREATE TABLE IF NOT EXISTS countries (
    code CHAR(2) PRIMARY KEY, -- ISO 3166-1 alpha-2 (e.g., 'TH', 'US')
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS provinces (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    country_code CHAR(2) NOT NULL REFERENCES countries(code) ON DELETE RESTRICT,
    UNIQUE (name, country_code), -- Province name unique within a country
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    province_id UUID NOT NULL REFERENCES provinces(id) ON DELETE RESTRICT,
    UNIQUE (name, province_id), -- City name unique within a province
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- === Business Status Lookup ===

CREATE TABLE IF NOT EXISTS business_statuses (
    id SERIAL PRIMARY KEY,
    status_code TEXT NOT NULL UNIQUE, -- e.g., 'OPERATIONAL', 'CLOSED_TEMPORARILY', 'CLOSED_PERMANENTLY'
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- === Combined Rental Shop Table ===

CREATE TABLE IF NOT EXISTS rental_shops (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    -- Fields originally from rental_providers (potentially repeated for multiple locations of same provider)
    provider_name TEXT NOT NULL,    -- The business name listed in the CSV (e.g., "Fatboy's Motorbike Rentals Bangkok - Silom and Sathorn")
    -- Fields originally from shop_locations
    location_name TEXT,             -- Optional specific name if different from provider_name (can derive or leave null)
    place_id TEXT UNIQUE,           -- Google Place ID for this specific location (nullable if not from Google)
    full_address TEXT NOT NULL,     -- Store the original full address string
    city_id UUID REFERENCES cities(id) ON DELETE SET NULL, -- Link to normalized city
    latitude NUMERIC(10, 7),        -- Latitude
    longitude NUMERIC(10, 7),       -- Longitude
    phone TEXT,                     -- Phone listed for this specific entry
    website TEXT,                   -- Website listed for this specific entry
    google_maps_url TEXT,
    business_status_id INTEGER REFERENCES business_statuses(id) ON DELETE SET NULL,
    rating NUMERIC(2, 1),           -- Google rating (e.g., 4.7)
    review_count INTEGER,           -- Number of Google reviews
    -- Add other location-specific details (e.g., opening_hours JSONB)
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- === Motorcycle-Related Lookup Tables ===

CREATE TABLE IF NOT EXISTS brands (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS features (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS required_document_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS insurance_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS condition_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS images (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    url TEXT NOT NULL UNIQUE,
    alt_text TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- === Core Motorcycle Offering Table ===

CREATE TABLE IF NOT EXISTS motorcycle_rentals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID NOT NULL REFERENCES rental_shops(id) ON DELETE CASCADE, -- Link to the specific shop location offering this bike
    brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE RESTRICT,
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    model TEXT NOT NULL,
    year INTEGER,
    engine_capacity_cc INTEGER,
    rental_rate_per_day NUMERIC(10, 2),
    rental_rate_currency CHAR(3),
    specifications_details JSONB, -- Stores less structured/variable specs
    conditions_details JSONB,     -- Stores less structured/variable conditions/rates
    availability_status TEXT,
    source_url TEXT,             -- URL specific to this offering if available
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- === Junction / Detail Tables ===

CREATE TABLE IF NOT EXISTS motorcycle_features (
    motorcycle_id UUID NOT NULL REFERENCES motorcycle_rentals(id) ON DELETE CASCADE,
    feature_id UUID NOT NULL REFERENCES features(id) ON DELETE CASCADE,
    PRIMARY KEY (motorcycle_id, feature_id)
);

CREATE TABLE IF NOT EXISTS motorcycle_required_documents (
    motorcycle_id UUID NOT NULL REFERENCES motorcycle_rentals(id) ON DELETE CASCADE,
    document_type_id UUID NOT NULL REFERENCES required_document_types(id) ON DELETE CASCADE,
    PRIMARY KEY (motorcycle_id, document_type_id)
);

CREATE TABLE IF NOT EXISTS motorcycle_conditions (
    motorcycle_id UUID NOT NULL REFERENCES motorcycle_rentals(id) ON DELETE CASCADE,
    condition_type_id UUID NOT NULL REFERENCES condition_types(id) ON DELETE CASCADE,
    notes TEXT,
    PRIMARY KEY (motorcycle_id, condition_type_id)
);

CREATE TABLE IF NOT EXISTS motorcycle_images (
    motorcycle_id UUID NOT NULL REFERENCES motorcycle_rentals(id) ON DELETE CASCADE,
    image_id UUID NOT NULL REFERENCES images(id) ON DELETE CASCADE,
    sort_order INTEGER DEFAULT 0,
    PRIMARY KEY (motorcycle_id, image_id)
);

CREATE TABLE IF NOT EXISTS motorcycle_insurance_details (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    motorcycle_id UUID NOT NULL REFERENCES motorcycle_rentals(id) ON DELETE CASCADE,
    insurance_type_id UUID NOT NULL REFERENCES insurance_types(id) ON DELETE RESTRICT,
    is_included BOOLEAN NOT NULL DEFAULT FALSE,
    cost_per_day NUMERIC(10, 2),
    cost_currency CHAR(3),
    deductible NUMERIC(12, 2),
    deductible_currency CHAR(3),
    notes TEXT,
    UNIQUE (motorcycle_id, insurance_type_id)
);

CREATE TABLE IF NOT EXISTS rental_rate_tiers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    motorcycle_id UUID NOT NULL REFERENCES motorcycle_rentals(id) ON DELETE CASCADE,
    min_days INTEGER NOT NULL,
    max_days INTEGER,
    rate_per_day NUMERIC(10, 2) NOT NULL,
    currency CHAR(3) NOT NULL,
    CHECK (min_days > 0),
    CHECK (max_days IS NULL OR max_days >= min_days)
);

-- === Indexes ===

-- Indexes for rental_shops
CREATE INDEX IF NOT EXISTS idx_rs_provider_name ON rental_shops (provider_name);
CREATE INDEX IF NOT EXISTS idx_rs_city_id ON rental_shops (city_id);
CREATE INDEX IF NOT EXISTS idx_rs_place_id ON rental_shops (place_id);
-- Use postgis for spatial index if using geometry type later
-- CREATE INDEX IF NOT EXISTS idx_rs_coordinates ON rental_shops USING GIST (point(longitude, latitude));

-- Indexes for motorcycle_rentals
CREATE INDEX IF NOT EXISTS idx_mr_shop_id ON motorcycle_rentals (shop_id);
CREATE INDEX IF NOT EXISTS idx_mr_brand_id ON motorcycle_rentals (brand_id);
CREATE INDEX IF NOT EXISTS idx_mr_category_id ON motorcycle_rentals (category_id);
CREATE INDEX IF NOT EXISTS idx_mr_model ON motorcycle_rentals (model);
CREATE INDEX IF NOT EXISTS idx_mr_engine_cc ON motorcycle_rentals (engine_capacity_cc);
CREATE INDEX IF NOT EXISTS idx_mr_rate_day ON motorcycle_rentals (rental_rate_per_day);

-- Indexes for junction tables
CREATE INDEX IF NOT EXISTS idx_mf_motorcycle_id ON motorcycle_features (motorcycle_id);
CREATE INDEX IF NOT EXISTS idx_mrd_motorcycle_id ON motorcycle_required_documents (motorcycle_id);
CREATE INDEX IF NOT EXISTS idx_mc_motorcycle_id ON motorcycle_conditions (motorcycle_id);
CREATE INDEX IF NOT EXISTS idx_mi_motorcycle_id ON motorcycle_images (motorcycle_id);
CREATE INDEX IF NOT EXISTS idx_mid_motorcycle_id ON motorcycle_insurance_details (motorcycle_id);
CREATE INDEX IF NOT EXISTS idx_rrt_motorcycle_id ON rental_rate_tiers (motorcycle_id);

-- GIN Indexes on JSONB columns
CREATE INDEX IF NOT EXISTS idx_mr_spec_details_gin ON motorcycle_rentals USING GIN (specifications_details);
CREATE INDEX IF NOT EXISTS idx_mr_cond_details_gin ON motorcycle_rentals USING GIN (conditions_details);


-- === Trigger Function for updated_at ===

CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to all tables with updated_at
DO $$
DECLARE
    t_name TEXT;
    trigger_name TEXT;
BEGIN
    FOR t_name IN (SELECT table_name FROM information_schema.columns WHERE column_name = 'updated_at' AND table_schema = 'public') -- Adjust schema if needed
    LOOP
        trigger_name := 'set_timestamp_' || t_name;
        -- Check if trigger already exists before creating
        IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = trigger_name AND tgrelid = t_name::regclass) THEN
             EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp()', trigger_name, t_name);
        END IF;
    END LOOP;
END;
$$; 