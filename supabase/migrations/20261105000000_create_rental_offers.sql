-- Migration: Canonical Rental Offers with Attached Extensions and Legacy Daily Projection
-- Spec #209 / Ticket #210 (ADR 0018)

-- 1. Create canonical rental_offers table
CREATE TABLE IF NOT EXISTS public.rental_offers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  motorcycle_id UUID NOT NULL REFERENCES public.motorcycle_rentals(id) ON DELETE CASCADE,
  parent_offer_id UUID NULL REFERENCES public.rental_offers(id) ON DELETE CASCADE,
  offer_type TEXT NOT NULL
    CHECK (offer_type IN ('daily', 'package', 'hourly', 'monthly', 'extension')),
  amount NUMERIC(10, 2) NOT NULL
    CHECK (amount > 0),
  currency CHAR(3) NOT NULL
    CHECK (char_length(btrim(currency)) = 3),
  billing_basis TEXT NOT NULL
    CHECK (billing_basis IN ('per_hour', 'per_day', 'per_calendar_month', 'package_total')),
  duration_unit TEXT NOT NULL
    CHECK (duration_unit IN ('hour', 'day', 'calendar_month')),
  min_duration NUMERIC(10, 4) NOT NULL
    CHECK (min_duration > 0),
  max_duration NUMERIC(10, 4) NULL
    CHECK (max_duration IS NULL OR max_duration >= min_duration),
  min_commitment_value NUMERIC(10, 4) NULL
    CHECK (min_commitment_value IS NULL OR min_commitment_value > 0),
  min_commitment_unit TEXT NULL
    CHECK (min_commitment_unit IS NULL OR min_commitment_unit IN ('hour', 'day', 'calendar_month')),
  billing_increment_value NUMERIC(10, 4) NULL
    CHECK (billing_increment_value IS NULL OR billing_increment_value > 0),
  billing_increment_unit TEXT NULL
    CHECK (billing_increment_unit IS NULL OR billing_increment_unit IN ('minute', 'hour', 'day', 'calendar_month')),
  supplier_label TEXT NULL,
  is_from BOOLEAN NOT NULL DEFAULT false,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT rental_offers_extension_parent_check
    CHECK ((parent_offer_id IS NOT NULL) = (offer_type = 'extension')),
  CONSTRAINT rental_offers_commitment_pair_check
    CHECK ((min_commitment_value IS NULL) = (min_commitment_unit IS NULL)),
  CONSTRAINT rental_offers_increment_pair_check
    CHECK ((billing_increment_value IS NULL) = (billing_increment_unit IS NULL)),
  CONSTRAINT rental_offers_type_basis_unit_check
    CHECK (
      (
        offer_type = 'daily'
        AND billing_basis = 'per_day'
        AND duration_unit = 'day'
        AND min_duration >= 1
        AND min_duration = trunc(min_duration)
        AND (max_duration IS NULL OR max_duration = trunc(max_duration))
      )
      OR (
        offer_type = 'package'
        AND billing_basis = 'package_total'
        AND max_duration IS NOT NULL
        AND max_duration = min_duration
        AND (
          duration_unit = 'hour'
          OR (min_duration >= 1 AND min_duration = trunc(min_duration))
        )
      )
      OR (
        offer_type = 'hourly'
        AND duration_unit = 'hour'
        AND (
          billing_basis = 'per_hour'
          OR (billing_basis = 'package_total' AND max_duration IS NOT NULL AND max_duration = min_duration)
        )
      )
      OR (
        offer_type = 'monthly'
        AND (
          (
            billing_basis = 'per_calendar_month'
            AND duration_unit = 'calendar_month'
            AND min_duration >= 1
            AND min_duration = trunc(min_duration)
            AND (max_duration IS NULL OR max_duration = trunc(max_duration))
          )
          OR (
            billing_basis = 'package_total'
            AND duration_unit = 'calendar_month'
            AND max_duration IS NOT NULL
            AND max_duration = min_duration
            AND min_duration >= 1
            AND min_duration = trunc(min_duration)
          )
          OR (
            billing_basis = 'package_total'
            AND duration_unit = 'day'
            AND max_duration IS NOT NULL
            AND max_duration = min_duration
            AND min_duration >= 28
            AND min_duration = trunc(min_duration)
          )
        )
      )
      OR (
        offer_type = 'extension'
        AND (
          (billing_basis = 'per_day' AND duration_unit = 'day')
          OR (billing_basis = 'per_hour' AND duration_unit = 'hour')
        )
      )
    )
);

CREATE INDEX IF NOT EXISTS idx_rental_offers_motorcycle_id
  ON public.rental_offers (motorcycle_id, sort_order, min_duration);

CREATE INDEX IF NOT EXISTS idx_rental_offers_parent_offer_id
  ON public.rental_offers (parent_offer_id)
  WHERE parent_offer_id IS NOT NULL;

DROP TRIGGER IF EXISTS set_timestamp_rental_offers ON public.rental_offers;
CREATE TRIGGER set_timestamp_rental_offers
  BEFORE UPDATE ON public.rental_offers
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_set_timestamp();

-- 2. Enforce parent_offer_id same-motorcycle and single-level nesting integrity
CREATE OR REPLACE FUNCTION public.enforce_rental_offer_parent_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_parent_motorcycle_id UUID;
  v_parent_offer_type TEXT;
BEGIN
  IF NEW.parent_offer_id IS NOT NULL THEN
    IF NEW.id IS NOT NULL AND NEW.parent_offer_id = NEW.id THEN
      RAISE EXCEPTION 'Extension offer cannot reference itself as parent_offer_id';
    END IF;

    SELECT motorcycle_id, offer_type
      INTO v_parent_motorcycle_id, v_parent_offer_type
      FROM public.rental_offers
     WHERE id = NEW.parent_offer_id;

    IF v_parent_motorcycle_id IS NULL THEN
      RAISE EXCEPTION 'Referenced parent_offer_id % does not exist', NEW.parent_offer_id;
    END IF;

    IF v_parent_motorcycle_id <> NEW.motorcycle_id THEN
      RAISE EXCEPTION 'Extension offer motorcycle_id (%) must match parent offer motorcycle_id (%)',
        NEW.motorcycle_id, v_parent_motorcycle_id;
    END IF;

    IF v_parent_offer_type = 'extension' THEN
      RAISE EXCEPTION 'Extension offer cannot be nested under another extension offer';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.enforce_rental_offer_parent_integrity() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_enforce_rental_offer_parent_integrity ON public.rental_offers;
CREATE TRIGGER trg_enforce_rental_offer_parent_integrity
  BEFORE INSERT OR UPDATE ON public.rental_offers
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_rental_offer_parent_integrity();

-- 3. Row-Level Security (public read, admin writes matching rental_rate_tiers)
ALTER TABLE public.rental_offers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rental_offers_public_read" ON public.rental_offers;
CREATE POLICY "rental_offers_public_read"
  ON public.rental_offers
  FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "rental_offers_admin_insert" ON public.rental_offers;
CREATE POLICY "rental_offers_admin_insert"
  ON public.rental_offers
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "rental_offers_admin_update" ON public.rental_offers;
CREATE POLICY "rental_offers_admin_update"
  ON public.rental_offers
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "rental_offers_admin_delete" ON public.rental_offers;
CREATE POLICY "rental_offers_admin_delete"
  ON public.rental_offers
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

GRANT SELECT ON public.rental_offers TO anon, authenticated, service_role;
GRANT INSERT, UPDATE, DELETE ON public.rental_offers TO authenticated, service_role;

-- 4. Backfill existing rental_rate_tiers and scalar motorcycle_rentals daily rates into rental_offers
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
  sort_order
)
SELECT
  rrt.motorcycle_id,
  NULL,
  CASE
    WHEN rrt.min_days >= 1
      AND rrt.min_days = trunc(rrt.min_days)
      AND (rrt.max_days IS NULL OR rrt.max_days = trunc(rrt.max_days))
    THEN 'daily'
    ELSE 'hourly'
  END AS offer_type,
  rrt.rate_per_day,
  UPPER(BTRIM(rrt.currency)),
  CASE
    WHEN rrt.min_days >= 1
      AND rrt.min_days = trunc(rrt.min_days)
      AND (rrt.max_days IS NULL OR rrt.max_days = trunc(rrt.max_days))
    THEN 'per_day'
    ELSE 'per_hour'
  END AS billing_basis,
  CASE
    WHEN rrt.min_days >= 1
      AND rrt.min_days = trunc(rrt.min_days)
      AND (rrt.max_days IS NULL OR rrt.max_days = trunc(rrt.max_days))
    THEN 'day'
    ELSE 'hour'
  END AS duration_unit,
  CASE
    WHEN rrt.min_days >= 1
      AND rrt.min_days = trunc(rrt.min_days)
      AND (rrt.max_days IS NULL OR rrt.max_days = trunc(rrt.max_days))
    THEN rrt.min_days
    ELSE GREATEST(ROUND(rrt.min_days * 24, 2), 0.25)
  END AS min_duration,
  CASE
    WHEN rrt.max_days IS NULL THEN NULL
    WHEN rrt.min_days >= 1
      AND rrt.min_days = trunc(rrt.min_days)
      AND rrt.max_days = trunc(rrt.max_days)
    THEN rrt.max_days
    ELSE GREATEST(ROUND(rrt.max_days * 24, 2), GREATEST(ROUND(rrt.min_days * 24, 2), 0.25))
  END AS max_duration,
  ROW_NUMBER() OVER (PARTITION BY rrt.motorcycle_id ORDER BY rrt.min_days ASC, rrt.id ASC) - 1 AS sort_order
FROM public.rental_rate_tiers rrt
WHERE rrt.rate_per_day > 0
  AND char_length(btrim(rrt.currency)) = 3
  AND NOT EXISTS (
    SELECT 1 FROM public.rental_offers ro WHERE ro.motorcycle_id = rrt.motorcycle_id
  );

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
  sort_order
)
SELECT
  mr.id,
  NULL,
  'daily',
  mr.rental_rate_per_day,
  UPPER(BTRIM(mr.rental_rate_currency)),
  'per_day',
  'day',
  1,
  NULL,
  0
FROM public.motorcycle_rentals mr
WHERE mr.rental_rate_per_day IS NOT NULL
  AND mr.rental_rate_per_day > 0
  AND mr.rental_rate_currency IS NOT NULL
  AND char_length(btrim(mr.rental_rate_currency)) = 3
  AND NOT EXISTS (
    SELECT 1 FROM public.rental_offers ro WHERE ro.motorcycle_id = mr.id
  );

-- Retire legacy fractional-day workaround rows from rental_rate_tiers now that they live as hourly rental_offers
DELETE FROM public.rental_rate_tiers
WHERE min_days < 1
   OR min_days <> trunc(min_days)
   OR (max_days IS NOT NULL AND max_days <> trunc(max_days));

-- Ensure motorcycles whose backfilled rental_offers contain only non-daily offers have NULL summary rental_rate_per_day
UPDATE public.motorcycle_rentals mr
SET rental_rate_per_day = NULL
WHERE mr.rental_rate_per_day IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.rental_offers ro WHERE ro.motorcycle_id = mr.id
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.rental_offers ro
    WHERE ro.motorcycle_id = mr.id
      AND ro.offer_type = 'daily'
  );

-- 5. Transactional RPC to replace a motorcycle's rental_offers + project legacy daily tiers and summary columns
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
