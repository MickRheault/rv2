-- Migration: Add Calendar Eligibility and Overlap Policy to Rental Offers
-- Spec #245 / Ticket #246 (ADR 0021, extends ADR 0018)

-- 1. Add nullable calendar_eligibility and overlap_policy columns (NULL = unrestricted)
ALTER TABLE public.rental_offers
  ADD COLUMN IF NOT EXISTS calendar_eligibility JSONB NULL,
  ADD COLUMN IF NOT EXISTS overlap_policy TEXT NULL;

-- 2. Enforce structural validity of v1 weekend calendar_eligibility and explicit overlap_policy
ALTER TABLE public.rental_offers
  DROP CONSTRAINT IF EXISTS rental_offers_calendar_eligibility_check,
  DROP CONSTRAINT IF EXISTS rental_offers_overlap_policy_check,
  DROP CONSTRAINT IF EXISTS rental_offers_extension_no_calendar_check;

ALTER TABLE public.rental_offers
  ADD CONSTRAINT rental_offers_calendar_eligibility_check
    CHECK (
      calendar_eligibility IS NULL
      OR (
        jsonb_typeof(calendar_eligibility) = 'object'
        AND calendar_eligibility->>'kind' = 'weekend'
        AND calendar_eligibility->>'startDay' = 'saturday'
        AND calendar_eligibility->>'endDay' = 'sunday'
        AND calendar_eligibility->>'timezoneBasis' = 'shop_local'
        AND (
          calendar_eligibility->'startTime' IS NULL
          OR jsonb_typeof(calendar_eligibility->'startTime') = 'null'
          OR (
            jsonb_typeof(calendar_eligibility->'startTime') = 'string'
            AND (calendar_eligibility->>'startTime') ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
          )
        )
        AND (
          calendar_eligibility->'endTime' IS NULL
          OR jsonb_typeof(calendar_eligibility->'endTime') = 'null'
          OR (
            jsonb_typeof(calendar_eligibility->'endTime') = 'string'
            AND (calendar_eligibility->>'endTime') ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
          )
        )
      )
    ),
  ADD CONSTRAINT rental_offers_overlap_policy_check
    CHECK (
      (calendar_eligibility IS NULL AND overlap_policy IS NULL)
      OR (
        calendar_eligibility IS NOT NULL
        AND overlap_policy IN ('unknown', 'alternative', 'replaces_standard')
      )
    ),
  ADD CONSTRAINT rental_offers_extension_no_calendar_check
    CHECK (
      offer_type <> 'extension'
      OR (calendar_eligibility IS NULL AND overlap_policy IS NULL)
    );

-- 3. Update transactional replace_motorcycle_rental_offers RPC to persist calendar_eligibility and overlap_policy
CREATE OR REPLACE FUNCTION public.replace_motorcycle_rental_offers(
  p_motorcycle_id UUID,
  p_payload JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_offer JSONB;
  v_ext JSONB;
  v_parent_id UUID;
  v_idx INT := 0;
  v_ext_idx INT;
  v_summary_rate NUMERIC(10, 2);
  v_summary_currency CHAR(3);
  v_calendar_eligibility JSONB;
  v_overlap_policy TEXT;
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role'
     AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: admin or service_role required';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.motorcycle_rentals WHERE id = p_motorcycle_id) THEN
    RAISE EXCEPTION 'Motorcycle % not found', p_motorcycle_id;
  END IF;

  DELETE FROM public.rental_offers WHERE motorcycle_id = p_motorcycle_id;
  DELETE FROM public.rental_rate_tiers WHERE motorcycle_id = p_motorcycle_id;

  IF jsonb_typeof(p_payload->'offers') = 'array' THEN
    FOR v_offer IN SELECT * FROM jsonb_array_elements(p_payload->'offers')
    LOOP
      v_calendar_eligibility := CASE
        WHEN v_offer->'calendar_eligibility' IS NULL OR jsonb_typeof(v_offer->'calendar_eligibility') = 'null'
          THEN NULL
        ELSE v_offer->'calendar_eligibility'
      END;

      v_overlap_policy := CASE
        WHEN v_calendar_eligibility IS NULL THEN NULL
        ELSE COALESCE(NULLIF(v_offer->>'overlap_policy', ''), 'unknown')
      END;

      INSERT INTO public.rental_offers (
        motorcycle_id,
        parent_offer_id,
        offer_type,
        amount,
        currency,
        billing_basis,
        duration_unit,
        min_duration,
        max_duration,
        min_commitment_value,
        min_commitment_unit,
        billing_increment_value,
        billing_increment_unit,
        supplier_label,
        is_from,
        calendar_eligibility,
        overlap_policy,
        sort_order
      )
      VALUES (
        p_motorcycle_id,
        NULL,
        v_offer->>'offer_type',
        (v_offer->>'amount')::NUMERIC(10, 2),
        UPPER(BTRIM(v_offer->>'currency')),
        v_offer->>'billing_basis',
        v_offer->>'duration_unit',
        (v_offer->>'min_duration')::NUMERIC(10, 4),
        CASE WHEN v_offer->'max_duration' IS NULL OR jsonb_typeof(v_offer->'max_duration') = 'null'
          THEN NULL ELSE (v_offer->>'max_duration')::NUMERIC(10, 4) END,
        CASE WHEN v_offer->'min_commitment_value' IS NULL OR jsonb_typeof(v_offer->'min_commitment_value') = 'null'
          THEN NULL ELSE (v_offer->>'min_commitment_value')::NUMERIC(10, 4) END,
        NULLIF(v_offer->>'min_commitment_unit', ''),
        CASE WHEN v_offer->'billing_increment_value' IS NULL OR jsonb_typeof(v_offer->'billing_increment_value') = 'null'
          THEN NULL ELSE (v_offer->>'billing_increment_value')::NUMERIC(10, 4) END,
        NULLIF(v_offer->>'billing_increment_unit', ''),
        NULLIF(v_offer->>'supplier_label', ''),
        COALESCE((v_offer->>'is_from')::BOOLEAN, false),
        v_calendar_eligibility,
        v_overlap_policy,
        COALESCE((v_offer->>'sort_order')::INT, v_idx)
      )
      RETURNING id INTO v_parent_id;

      v_ext_idx := 0;
      IF jsonb_typeof(v_offer->'extensions') = 'array' THEN
        FOR v_ext IN SELECT * FROM jsonb_array_elements(v_offer->'extensions')
        LOOP
          INSERT INTO public.rental_offers (
            motorcycle_id,
            parent_offer_id,
            offer_type,
            amount,
            currency,
            billing_basis,
            duration_unit,
            min_duration,
            max_duration,
            billing_increment_value,
            billing_increment_unit,
            supplier_label,
            is_from,
            sort_order
          )
          VALUES (
            p_motorcycle_id,
            v_parent_id,
            'extension',
            (v_ext->>'amount')::NUMERIC(10, 2),
            UPPER(BTRIM(v_ext->>'currency')),
            v_ext->>'billing_basis',
            v_ext->>'duration_unit',
            (v_ext->>'min_duration')::NUMERIC(10, 4),
            CASE WHEN v_ext->'max_duration' IS NULL OR jsonb_typeof(v_ext->'max_duration') = 'null'
              THEN NULL ELSE (v_ext->>'max_duration')::NUMERIC(10, 4) END,
            CASE WHEN v_ext->'billing_increment_value' IS NULL OR jsonb_typeof(v_ext->'billing_increment_value') = 'null'
              THEN NULL ELSE (v_ext->>'billing_increment_value')::NUMERIC(10, 4) END,
            NULLIF(v_ext->>'billing_increment_unit', ''),
            NULLIF(v_ext->>'supplier_label', ''),
            COALESCE((v_ext->>'is_from')::BOOLEAN, false),
            COALESCE((v_ext->>'sort_order')::INT, v_ext_idx)
          );
          v_ext_idx := v_ext_idx + 1;
        END LOOP;
      END IF;

      v_idx := v_idx + 1;
    END LOOP;
  END IF;

  IF jsonb_typeof(p_payload->'legacy_rate_tiers') = 'array' THEN
    INSERT INTO public.rental_rate_tiers (
      motorcycle_id,
      min_days,
      max_days,
      rate_per_day,
      currency
    )
    SELECT
      p_motorcycle_id,
      (t->>'min_days')::NUMERIC(10, 4),
      CASE WHEN t->'max_days' IS NULL OR jsonb_typeof(t->'max_days') = 'null'
        THEN NULL ELSE (t->>'max_days')::NUMERIC(10, 4) END,
      (t->>'rate_per_day')::NUMERIC(10, 2),
      UPPER(BTRIM(t->>'currency'))
    FROM jsonb_array_elements(p_payload->'legacy_rate_tiers') AS t;
  END IF;

  v_summary_rate := CASE
    WHEN p_payload->'summary_rate_per_day' IS NULL OR jsonb_typeof(p_payload->'summary_rate_per_day') = 'null'
      THEN NULL
    ELSE (p_payload->>'summary_rate_per_day')::NUMERIC(10, 2)
  END;

  v_summary_currency := CASE
    WHEN p_payload->'summary_currency' IS NULL OR jsonb_typeof(p_payload->'summary_currency') = 'null'
      THEN NULL
    ELSE UPPER(BTRIM(p_payload->>'summary_currency'))::CHAR(3)
  END;

  UPDATE public.motorcycle_rentals
     SET rental_rate_per_day = v_summary_rate,
         rental_rate_currency = v_summary_currency
   WHERE id = p_motorcycle_id;

  RETURN jsonb_build_object(
    'motorcycleId', p_motorcycle_id,
    'summaryRatePerDay', v_summary_rate,
    'summaryCurrency', v_summary_currency
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.replace_motorcycle_rental_offers(UUID, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.replace_motorcycle_rental_offers(UUID, JSONB) TO authenticated, service_role;
