-- Add nullable year_to column to motorcycle_rentals for Model Year Range support (#137)

ALTER TABLE public.motorcycle_rentals
  ADD COLUMN IF NOT EXISTS year_to integer;

-- Normalize any rows where year_to = year to year_to = NULL
UPDATE public.motorcycle_rentals
SET year_to = NULL
WHERE year_to IS NOT NULL AND year_to = year;

-- Enforce valid Model Year Range bounds
ALTER TABLE public.motorcycle_rentals
  DROP CONSTRAINT IF EXISTS motorcycle_rentals_year_range_check;

ALTER TABLE public.motorcycle_rentals
  ADD CONSTRAINT motorcycle_rentals_year_range_check
  CHECK (year_to IS NULL OR (year IS NOT NULL AND year_to > year));

-- Update get_entities_by_freshness RPC to format Model Year Ranges cleanly
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
                CASE
                    WHEN mr.year IS NOT NULL AND mr.year_to IS NOT NULL THEN
                        CONCAT(b.name, ' ', mr.model, ' (', mr.year, '-', mr.year_to, ')')
                    WHEN mr.year IS NOT NULL AND mr.year_to IS NULL THEN
                        CONCAT(b.name, ' ', mr.model, ' (', mr.year, ')')
                    ELSE
                        CONCAT(b.name, ' ', mr.model)
                END
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

GRANT EXECUTE ON FUNCTION get_entities_by_freshness(freshness_content_type, freshness_status, INTEGER, INTEGER) TO authenticated;

COMMENT ON FUNCTION get_entities_by_freshness(freshness_content_type, freshness_status, INTEGER, INTEGER) IS 'Returns paginated list of entities filtered by content type and freshness status with Model Year Range formatting';
