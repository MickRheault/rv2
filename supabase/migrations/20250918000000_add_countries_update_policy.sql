-- Migration: Add UPDATE policy for countries table to allow admins to update content_sections

BEGIN;

-- Add UPDATE policy for countries table (for admin content management)
DROP POLICY IF EXISTS "Allow admins to update countries" ON public.countries;
CREATE POLICY "Allow admins to update countries" ON public.countries
  FOR UPDATE TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

COMMIT;

