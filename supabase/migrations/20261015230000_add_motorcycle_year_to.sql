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

ALTER FUNCTION public.get_entities_by_freshness(public.freshness_content_type, public.freshness_status, integer, integer) SET search_path = public, extensions;

COMMENT ON FUNCTION get_entities_by_freshness(freshness_content_type, freshness_status, INTEGER, INTEGER) IS 'Returns paginated list of entities filtered by content type and freshness status with Model Year Range formatting';

-- Update apply_flagged_content_changes to normalize motorcycle Model Year Ranges ("2015-2020" or single year) into year and year_to
CREATE OR REPLACE FUNCTION apply_flagged_content_changes(flagged_content_id UUID, admin_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  flag_record RECORD;
  update_query TEXT;
  field_name TEXT;
  field_value TEXT;
  table_name TEXT;
  range_matches TEXT[];
  parsed_start INTEGER;
  parsed_end INTEGER;
  success BOOLEAN DEFAULT false;
BEGIN
  -- Get the flagged content record
  SELECT * INTO flag_record FROM flagged_content
  WHERE id = flagged_content_id AND status = 'approved';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Flagged content not found or not approved';
  END IF;

  -- Determine target table based on content type
  table_name := CASE flag_record.content_type
    WHEN 'motorcycle' THEN 'motorcycle_rentals'
    WHEN 'rental_shop' THEN 'rental_shops'
    ELSE NULL
  END;

  IF table_name IS NULL THEN
    RAISE EXCEPTION 'Unsupported content type: %', flag_record.content_type;
  END IF;

  -- Build dynamic update query for top-level fields
  update_query := 'UPDATE ' || table_name || ' SET ';

  -- Add each field from proposed_data
  FOR field_name IN SELECT jsonb_object_keys(flag_record.proposed_data)
  LOOP
    field_value := flag_record.proposed_data ->> field_name;

    -- Skip certain fields that shouldn't be directly updated
    IF field_name NOT IN ('id', 'created_at', 'updated_at') THEN
      IF flag_record.content_type = 'motorcycle' AND field_name IN ('year', 'year_to') THEN
        -- Handled below as a normalized (year, year_to) pair
        CONTINUE;
      ELSIF field_value IS NULL THEN
        update_query := update_query || field_name || ' = NULL, ';
      ELSE
        update_query := update_query || field_name || ' = ' || quote_literal(field_value) || ', ';
      END IF;
    END IF;
  END LOOP;

  IF flag_record.content_type = 'motorcycle' AND (flag_record.proposed_data ? 'year' OR flag_record.proposed_data ? 'year_to') THEN
    parsed_start := NULL;
    parsed_end := NULL;
    field_value := flag_record.proposed_data ->> 'year';

    IF field_value IS NOT NULL AND btrim(field_value) <> '' THEN
      IF btrim(field_value) ~ '^\d{4}\s*[-–—]\s*\d{4}$' THEN
        range_matches := regexp_match(btrim(field_value), '^(\d{4})\s*[-–—]\s*(\d{4})$');
        parsed_start := range_matches[1]::INTEGER;
        parsed_end := range_matches[2]::INTEGER;
      ELSIF btrim(field_value) ~ '^\d+$' THEN
        parsed_start := btrim(field_value)::INTEGER;
      ELSE
        RAISE EXCEPTION 'Invalid motorcycle year format: %', field_value;
      END IF;
    END IF;

    IF flag_record.proposed_data ? 'year_to' THEN
      field_value := flag_record.proposed_data ->> 'year_to';
      IF field_value IS NOT NULL AND btrim(field_value) <> '' THEN
        parsed_end := btrim(field_value)::INTEGER;
      END IF;
    END IF;

    IF parsed_end IS NOT NULL AND (parsed_start IS NULL OR parsed_end < parsed_start) THEN
      RAISE EXCEPTION 'Invalid motorcycle year range: year_to (%) < year (%)', parsed_end, parsed_start;
    END IF;

    IF parsed_end IS NOT NULL AND parsed_end = parsed_start THEN
      parsed_end := NULL;
    END IF;

    update_query := update_query || 'year = ' || COALESCE(parsed_start::TEXT, 'NULL') || ', ';
    update_query := update_query || 'year_to = ' || COALESCE(parsed_end::TEXT, 'NULL') || ', ';
  END IF;

  -- Remove trailing comma and add WHERE clause
  update_query := rtrim(update_query, ', ');
  update_query := update_query || ', updated_at = NOW()';
  update_query := update_query || ' WHERE id = ' || quote_literal(flag_record.entity_id);

  -- Execute the update
  EXECUTE update_query;

  -- Update the flagged content status
  UPDATE flagged_content
  SET
    status = 'applied',
    applied_by_admin_id = admin_id,
    applied_at = NOW()
  WHERE id = flagged_content_id;

  success := true;
  RETURN success;

EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error applying flagged content changes: %', SQLERRM;
    RETURN false;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION apply_flagged_content_changes(UUID, UUID) TO authenticated;

ALTER FUNCTION public.apply_flagged_content_changes(uuid, uuid) SET search_path = public, extensions;

