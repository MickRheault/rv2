-- Remediate High-Severity Flagged Content RLS Exposure (#175 / #174)
-- 1. Drop the permissive anonymous SELECT policy on public.flagged_content and revoke SELECT from anon.
-- 2. Restrict flagged_content_changes SELECT policy to authenticated users only and revoke SELECT from anon.
-- 3. Bind flagged_by_user_id to auth.uid() in the flagged_content INSERT policy so submitters cannot spoof another user's ID.
-- 4. Make parse_flagged_content_changes() SECURITY DEFINER with a pinned search_path and revoke direct client INSERT on flagged_content_changes.

DROP POLICY IF EXISTS "Allow anonymous users to read flagged content" ON public.flagged_content;
REVOKE SELECT ON public.flagged_content FROM anon;

DROP POLICY IF EXISTS "Allow reading flagged content changes" ON public.flagged_content_changes;
CREATE POLICY "Allow reading flagged content changes" ON public.flagged_content_changes
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.flagged_content fc
      WHERE fc.id = flagged_content_changes.flagged_content_id
      AND (
        fc.flagged_by_user_id = auth.uid()
        OR public.is_admin()
      )
    )
  );
REVOKE SELECT ON public.flagged_content_changes FROM anon;

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
    AND (
      (auth.uid() IS NULL AND flagged_by_user_id IS NULL)
      OR (auth.uid() IS NOT NULL AND (flagged_by_user_id IS NULL OR flagged_by_user_id = auth.uid()))
    )
  );

CREATE OR REPLACE FUNCTION public.parse_flagged_content_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  key TEXT;
  original_val TEXT;
  proposed_val TEXT;
BEGIN
  FOR key IN SELECT jsonb_object_keys(NEW.proposed_data)
  LOOP
    original_val := COALESCE((NEW.original_data ->> key), '');
    proposed_val := NEW.proposed_data ->> key;

    IF original_val != proposed_val THEN
      INSERT INTO public.flagged_content_changes (
        flagged_content_id,
        field_name,
        original_value,
        proposed_value,
        change_type,
        is_critical
      ) VALUES (
        NEW.id,
        key,
        original_val,
        proposed_val,
        CASE
          WHEN original_val = '' THEN 'add'
          WHEN proposed_val = '' THEN 'remove'
          ELSE 'update'
        END,
        key IN ('rental_rate_per_day', 'phone', 'website', 'full_address', 'provider_name')
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP POLICY IF EXISTS "Allow system to insert flagged content changes" ON public.flagged_content_changes;
REVOKE INSERT ON public.flagged_content_changes FROM anon, authenticated;
