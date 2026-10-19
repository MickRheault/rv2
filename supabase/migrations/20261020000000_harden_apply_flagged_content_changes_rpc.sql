-- Harden apply_flagged_content_changes against SQL injection and missing authorization (#165)
-- Also restrict flagged_content INSERT RLS so non-admin submissions must start as status = 'pending'.

CREATE OR REPLACE FUNCTION public.apply_flagged_content_changes(flagged_content_id UUID, admin_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  flag_record RECORD;
  acting_admin_id UUID;
  table_name TEXT;
  allowed_fields TEXT[];
  set_clauses TEXT[] := ARRAY[]::TEXT[];
  update_query TEXT;
  field_name TEXT;
  field_value TEXT;
  range_matches TEXT[];
  parsed_start INTEGER;
  parsed_end INTEGER;
BEGIN
  -- 1. Enforce caller authorization
  IF COALESCE(auth.role(), '') <> 'service_role'
     AND current_user NOT IN ('postgres', 'supabase_admin')
     AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: admin privileges required';
  END IF;

  -- 2. Bind audit identity to authenticated caller when available
  acting_admin_id := COALESCE(auth.uid(), admin_id);
  IF acting_admin_id IS NULL THEN
    RAISE EXCEPTION 'Access denied: acting admin identity is required';
  END IF;

  -- 3. Load approved flagged content record
  SELECT * INTO flag_record
  FROM public.flagged_content
  WHERE id = flagged_content_id AND status = 'approved';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Flagged content not found or not approved';
  END IF;

  IF flag_record.proposed_data IS NULL OR jsonb_typeof(flag_record.proposed_data) <> 'object' THEN
    RAISE EXCEPTION 'Invalid proposed_data: expected JSON object';
  END IF;

  -- 4. Determine target table and strict column allowlist based on content_type
  CASE flag_record.content_type
    WHEN 'motorcycle' THEN
      table_name := 'motorcycle_rentals';
      allowed_fields := ARRAY[
        'model',
        'year',
        'year_to',
        'engine_capacity_cc',
        'rental_rate_per_day',
        'rental_rate_currency',
        'availability_status',
        'brand_id',
        'category_id',
        'shop_id',
        'source_url',
        'specifications_details',
        'conditions_details'
      ];
    WHEN 'rental_shop' THEN
      table_name := 'rental_shops';
      allowed_fields := ARRAY[
        'provider_name',
        'full_address',
        'phone',
        'website',
        'business_description',
        'rating',
        'review_count',
        'google_maps_url',
        'latitude',
        'longitude',
        'location_name',
        'city_id',
        'business_status_id'
      ];
    ELSE
      RAISE EXCEPTION 'Unsupported content type: %', flag_record.content_type;
  END CASE;

  -- 5. Validate and quote each field from proposed_data
  FOR field_name IN SELECT jsonb_object_keys(flag_record.proposed_data)
  LOOP
    -- Skip immutable record metadata if present
    IF field_name IN ('id', 'created_at', 'updated_at') THEN
      CONTINUE;
    END IF;

    IF NOT (field_name = ANY(allowed_fields)) THEN
      RAISE EXCEPTION 'Disallowed field "%" for content_type "%"', field_name, flag_record.content_type;
    END IF;

    IF flag_record.content_type = 'motorcycle' AND field_name IN ('year', 'year_to') THEN
      -- Handled below as a normalized (year, year_to) pair
      CONTINUE;
    END IF;

    field_value := flag_record.proposed_data ->> field_name;

    IF field_value IS NULL THEN
      set_clauses := array_append(set_clauses, format('%I = NULL', field_name));
    ELSE
      set_clauses := array_append(set_clauses, format('%I = %L', field_name, field_value));
    END IF;
  END LOOP;

  -- 6. Normalize motorcycle Model Year Range ("YYYY-YYYY" or single year)
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
        IF btrim(field_value) ~ '^\d+$' THEN
          parsed_end := btrim(field_value)::INTEGER;
        ELSE
          RAISE EXCEPTION 'Invalid motorcycle year_to format: %', field_value;
        END IF;
      END IF;
    END IF;

    IF parsed_end IS NOT NULL AND (parsed_start IS NULL OR parsed_end < parsed_start) THEN
      RAISE EXCEPTION 'Invalid motorcycle year range: year_to (%) < year (%)', parsed_end, parsed_start;
    END IF;

    IF parsed_end IS NOT NULL AND parsed_end = parsed_start THEN
      parsed_end := NULL;
    END IF;

    IF parsed_start IS NULL THEN
      set_clauses := array_append(set_clauses, format('%I = NULL', 'year'));
    ELSE
      set_clauses := array_append(set_clauses, format('%I = %L::INTEGER', 'year', parsed_start));
    END IF;

    IF parsed_end IS NULL THEN
      set_clauses := array_append(set_clauses, format('%I = NULL', 'year_to'));
    ELSE
      set_clauses := array_append(set_clauses, format('%I = %L::INTEGER', 'year_to', parsed_end));
    END IF;
  END IF;

  set_clauses := array_append(set_clauses, 'updated_at = NOW()');

  update_query := format(
    'UPDATE public.%I SET %s WHERE id = %L',
    table_name,
    array_to_string(set_clauses, ', '),
    flag_record.entity_id
  );

  EXECUTE update_query;

  UPDATE public.flagged_content
  SET
    status = 'applied',
    applied_by_admin_id = acting_admin_id,
    applied_at = NOW()
  WHERE id = flagged_content_id;

  RETURN true;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.apply_flagged_content_changes(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_flagged_content_changes(UUID, UUID) TO authenticated, service_role;

DROP POLICY IF EXISTS "Allow insert for all users" ON public.flagged_content;
CREATE POLICY "Allow insert for all users" ON public.flagged_content
  FOR INSERT TO authenticated, anon
  WITH CHECK (
    status = 'pending'
    AND admin_notes IS NULL
    AND reviewed_by_admin_id IS NULL
    AND applied_by_admin_id IS NULL
    AND reviewed_at IS NULL
    AND applied_at IS NULL
    AND COALESCE(is_verified, false) = false
  );
