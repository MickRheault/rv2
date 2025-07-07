-- Data Freshness Tracking System
-- Created: 2025-07-05 18:00:00
-- Purpose: Track data freshness at entity level for admin monitoring

-- Create content type enum for freshness tracking
CREATE TYPE freshness_content_type AS ENUM ('motorcycle', 'rental_shop');

-- Create freshness status enum
CREATE TYPE freshness_status AS ENUM ('fresh', 'stale', 'very_stale');

-- Data freshness tracking table
CREATE TABLE data_freshness (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    content_type freshness_content_type NOT NULL,
    entity_id UUID NOT NULL,
    last_updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    data_source TEXT DEFAULT 'import', -- 'import', 'manual', 'scraper'
    freshness_status freshness_status NOT NULL,
    days_since_update INTEGER NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure one record per entity
    CONSTRAINT data_freshness_unique_entity UNIQUE (content_type, entity_id)
);

-- Create indexes for performance
CREATE INDEX idx_data_freshness_content_type ON data_freshness(content_type);
CREATE INDEX idx_data_freshness_status ON data_freshness(freshness_status);
CREATE INDEX idx_data_freshness_days_since_update ON data_freshness(days_since_update);
CREATE INDEX idx_data_freshness_last_updated ON data_freshness(last_updated_at);

-- Function to calculate freshness status based on thresholds
CREATE OR REPLACE FUNCTION calculate_freshness_status(days_since_update INTEGER)
RETURNS freshness_status AS $$
BEGIN
    -- Fresh: 0-3 months (90 days)
    IF days_since_update <= 90 THEN
        RETURN 'fresh'::freshness_status;
    -- Stale: 3-6 months (91-180 days)
    ELSIF days_since_update <= 180 THEN
        RETURN 'stale'::freshness_status;
    -- Very Stale: 6+ months (181+ days)
    ELSE
        RETURN 'very_stale'::freshness_status;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to refresh all data freshness records
CREATE OR REPLACE FUNCTION refresh_data_freshness()
RETURNS TABLE (
    updated_count INTEGER,
    fresh_count INTEGER,
    stale_count INTEGER,
    very_stale_count INTEGER
) AS $$
DECLARE
    _updated_count INTEGER := 0;
    _fresh_count INTEGER := 0;
    _stale_count INTEGER := 0;
    _very_stale_count INTEGER := 0;
    _days_diff INTEGER;
    _status freshness_status;
BEGIN
    -- Update freshness for motorcycles
    INSERT INTO data_freshness (content_type, entity_id, last_updated_at, days_since_update, freshness_status)
    SELECT 
        'motorcycle'::freshness_content_type,
        id,
        updated_at,
        EXTRACT(DAY FROM NOW() - updated_at)::INTEGER,
        calculate_freshness_status(EXTRACT(DAY FROM NOW() - updated_at)::INTEGER)
    FROM motorcycle_rentals
    ON CONFLICT (content_type, entity_id) 
    DO UPDATE SET 
        last_updated_at = EXCLUDED.last_updated_at,
        days_since_update = EXCLUDED.days_since_update,
        freshness_status = EXCLUDED.freshness_status,
        updated_at = NOW();

    -- Update freshness for rental shops
    INSERT INTO data_freshness (content_type, entity_id, last_updated_at, days_since_update, freshness_status)
    SELECT 
        'rental_shop'::freshness_content_type,
        id,
        updated_at,
        EXTRACT(DAY FROM NOW() - updated_at)::INTEGER,
        calculate_freshness_status(EXTRACT(DAY FROM NOW() - updated_at)::INTEGER)
    FROM rental_shops
    ON CONFLICT (content_type, entity_id) 
    DO UPDATE SET 
        last_updated_at = EXCLUDED.last_updated_at,
        days_since_update = EXCLUDED.days_since_update,
        freshness_status = EXCLUDED.freshness_status,
        updated_at = NOW();

    -- Get counts
    SELECT COUNT(*) INTO _updated_count FROM data_freshness;
    SELECT COUNT(*) INTO _fresh_count FROM data_freshness WHERE freshness_status = 'fresh';
    SELECT COUNT(*) INTO _stale_count FROM data_freshness WHERE freshness_status = 'stale';
    SELECT COUNT(*) INTO _very_stale_count FROM data_freshness WHERE freshness_status = 'very_stale';

    RETURN QUERY SELECT _updated_count, _fresh_count, _stale_count, _very_stale_count;
END;
$$ LANGUAGE plpgsql;

-- Function to get data freshness statistics for admin dashboard
CREATE OR REPLACE FUNCTION get_data_freshness_stats()
RETURNS TABLE (
    total_entities INTEGER,
    fresh_entities INTEGER,
    stale_entities INTEGER,
    very_stale_entities INTEGER,
    fresh_percentage DECIMAL(5,2),
    stale_percentage DECIMAL(5,2),
    very_stale_percentage DECIMAL(5,2),
    motorcycle_fresh INTEGER,
    motorcycle_stale INTEGER,
    motorcycle_very_stale INTEGER,
    shop_fresh INTEGER,
    shop_stale INTEGER,
    shop_very_stale INTEGER,
    oldest_motorcycle_days INTEGER,
    oldest_shop_days INTEGER
) AS $$
DECLARE
    _total INTEGER;
    _fresh INTEGER;
    _stale INTEGER;
    _very_stale INTEGER;
BEGIN
    -- Get overall counts
    SELECT COUNT(*) INTO _total FROM data_freshness;
    SELECT COUNT(*) INTO _fresh FROM data_freshness WHERE freshness_status = 'fresh';
    SELECT COUNT(*) INTO _stale FROM data_freshness WHERE freshness_status = 'stale';
    SELECT COUNT(*) INTO _very_stale FROM data_freshness WHERE freshness_status = 'very_stale';

    RETURN QUERY
    SELECT 
        _total as total_entities,
        _fresh as fresh_entities,
        _stale as stale_entities,
        _very_stale as very_stale_entities,
        CASE WHEN _total > 0 THEN ROUND((_fresh::DECIMAL / _total) * 100, 2) ELSE 0 END as fresh_percentage,
        CASE WHEN _total > 0 THEN ROUND((_stale::DECIMAL / _total) * 100, 2) ELSE 0 END as stale_percentage,
        CASE WHEN _total > 0 THEN ROUND((_very_stale::DECIMAL / _total) * 100, 2) ELSE 0 END as very_stale_percentage,
        (SELECT COUNT(*) FROM data_freshness WHERE content_type = 'motorcycle' AND freshness_status = 'fresh')::INTEGER as motorcycle_fresh,
        (SELECT COUNT(*) FROM data_freshness WHERE content_type = 'motorcycle' AND freshness_status = 'stale')::INTEGER as motorcycle_stale,
        (SELECT COUNT(*) FROM data_freshness WHERE content_type = 'motorcycle' AND freshness_status = 'very_stale')::INTEGER as motorcycle_very_stale,
        (SELECT COUNT(*) FROM data_freshness WHERE content_type = 'rental_shop' AND freshness_status = 'fresh')::INTEGER as shop_fresh,
        (SELECT COUNT(*) FROM data_freshness WHERE content_type = 'rental_shop' AND freshness_status = 'stale')::INTEGER as shop_stale,
        (SELECT COUNT(*) FROM data_freshness WHERE content_type = 'rental_shop' AND freshness_status = 'very_stale')::INTEGER as shop_very_stale,
        COALESCE((SELECT MAX(days_since_update) FROM data_freshness WHERE content_type = 'motorcycle'), 0)::INTEGER as oldest_motorcycle_days,
        COALESCE((SELECT MAX(days_since_update) FROM data_freshness WHERE content_type = 'rental_shop'), 0)::INTEGER as oldest_shop_days;
END;
$$ LANGUAGE plpgsql;

-- Function to get entities by freshness status with pagination
CREATE OR REPLACE FUNCTION get_entities_by_freshness(
    p_content_type freshness_content_type DEFAULT NULL,
    p_freshness_status freshness_status DEFAULT NULL,
    p_limit INTEGER DEFAULT 50,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    id UUID,
    content_type freshness_content_type,
    entity_id UUID,
    entity_name TEXT,
    last_updated_at TIMESTAMP WITH TIME ZONE,
    days_since_update INTEGER,
    freshness_status freshness_status,
    location_info TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        df.id,
        df.content_type,
        df.entity_id,
        CASE 
            WHEN df.content_type = 'motorcycle' THEN 
                CONCAT(b.name, ' ', mr.model, ' (', mr.year, ')')
            WHEN df.content_type = 'rental_shop' THEN 
                rs2.provider_name
        END as entity_name,
        df.last_updated_at,
        df.days_since_update,
        df.freshness_status,
        CASE 
            WHEN df.content_type = 'motorcycle' THEN 
                CONCAT(c.name, ', ', p.name, ', ', co.name)
            WHEN df.content_type = 'rental_shop' THEN 
                CONCAT(c2.name, ', ', p2.name, ', ', co2.name)
        END as location_info
    FROM data_freshness df
    LEFT JOIN motorcycle_rentals mr ON df.content_type = 'motorcycle' AND df.entity_id = mr.id
    LEFT JOIN brands b ON mr.brand_id = b.id
    LEFT JOIN rental_shops rs ON mr.shop_id = rs.id
    LEFT JOIN cities c ON rs.city_id = c.id
    LEFT JOIN provinces p ON c.province_id = p.id
    LEFT JOIN countries co ON p.country_code = co.code
    LEFT JOIN rental_shops rs2 ON df.content_type = 'rental_shop' AND df.entity_id = rs2.id
    LEFT JOIN cities c2 ON rs2.city_id = c2.id
    LEFT JOIN provinces p2 ON c2.province_id = p2.id
    LEFT JOIN countries co2 ON p2.country_code = co2.code
    WHERE 
        (p_content_type IS NULL OR df.content_type = p_content_type)
        AND (p_freshness_status IS NULL OR df.freshness_status = p_freshness_status)
    ORDER BY df.days_since_update DESC, df.last_updated_at ASC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;

-- Trigger function to update freshness when entities are modified
CREATE OR REPLACE FUNCTION update_entity_freshness()
RETURNS TRIGGER AS $$
BEGIN
    -- Update or insert freshness record
    INSERT INTO data_freshness (
        content_type, 
        entity_id, 
        last_updated_at, 
        days_since_update, 
        freshness_status,
        data_source
    ) VALUES (
        CASE TG_TABLE_NAME 
            WHEN 'motorcycle_rentals' THEN 'motorcycle'::freshness_content_type
            WHEN 'rental_shops' THEN 'rental_shop'::freshness_content_type
        END,
        NEW.id,
        NEW.updated_at,
        0, -- Just updated, so 0 days
        'fresh'::freshness_status,
        'manual'
    )
    ON CONFLICT (content_type, entity_id) 
    DO UPDATE SET 
        last_updated_at = NEW.updated_at,
        days_since_update = 0,
        freshness_status = 'fresh'::freshness_status,
        data_source = 'manual',
        updated_at = NOW();
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers to update freshness on entity changes
CREATE TRIGGER motorcycle_freshness_trigger
    AFTER UPDATE ON motorcycle_rentals
    FOR EACH ROW
    EXECUTE FUNCTION update_entity_freshness();

CREATE TRIGGER shop_freshness_trigger
    AFTER UPDATE ON rental_shops
    FOR EACH ROW
    EXECUTE FUNCTION update_entity_freshness();

-- Enable RLS
ALTER TABLE data_freshness ENABLE ROW LEVEL SECURITY;

-- Admin policy for data freshness
CREATE POLICY "Admins can manage data freshness"
ON data_freshness FOR ALL
TO authenticated
USING (is_admin());

-- Grant permissions
GRANT EXECUTE ON FUNCTION calculate_freshness_status(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION refresh_data_freshness() TO authenticated;
GRANT EXECUTE ON FUNCTION get_data_freshness_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION get_entities_by_freshness(freshness_content_type, freshness_status, INTEGER, INTEGER) TO authenticated;

-- Initialize data freshness for existing entities
SELECT refresh_data_freshness();

-- Add comments for documentation
COMMENT ON TABLE data_freshness IS 'Tracks data freshness at entity level for admin monitoring';
COMMENT ON FUNCTION calculate_freshness_status(INTEGER) IS 'Calculates freshness status: fresh (0-90 days), stale (91-180 days), very_stale (181+ days)';
COMMENT ON FUNCTION refresh_data_freshness() IS 'Refreshes all data freshness records and returns summary statistics';
COMMENT ON FUNCTION get_data_freshness_stats() IS 'Returns comprehensive data freshness statistics for admin dashboard';
COMMENT ON FUNCTION get_entities_by_freshness(freshness_content_type, freshness_status, INTEGER, INTEGER) IS 'Returns paginated list of entities filtered by content type and freshness status'; 