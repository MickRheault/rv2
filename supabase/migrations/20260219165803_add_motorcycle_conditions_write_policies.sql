
-- Add INSERT policy for motorcycle_conditions (mirrors motorcycle_features pattern)
CREATE POLICY "Allow admins to create motorcycle conditions"
  ON public.motorcycle_conditions
  FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

-- Add DELETE policy for motorcycle_conditions (mirrors motorcycle_features pattern)
CREATE POLICY "Allow admins to delete motorcycle conditions"
  ON public.motorcycle_conditions
  FOR DELETE
  TO authenticated
  USING (is_admin());

-- Add UPDATE policy for motorcycle_conditions
CREATE POLICY "Allow admins to update motorcycle conditions"
  ON public.motorcycle_conditions
  FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());
;
