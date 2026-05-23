
-- The MCP server authenticates with the anon key + admin API key.
-- The existing write policies only target "authenticated" role.
-- These junction tables need write policies for the "anon" role as well,
-- still guarded by is_admin() to maintain security.

-- rental_shop_inclusions: add anon INSERT/DELETE/UPDATE
CREATE POLICY "Allow anon admins to create rental shop inclusions"
  ON public.rental_shop_inclusions
  FOR INSERT
  TO anon
  WITH CHECK (is_admin());

CREATE POLICY "Allow anon admins to delete rental shop inclusions"
  ON public.rental_shop_inclusions
  FOR DELETE
  TO anon
  USING (is_admin());

CREATE POLICY "Allow anon admins to update rental shop inclusions"
  ON public.rental_shop_inclusions
  FOR UPDATE
  TO anon
  USING (is_admin())
  WITH CHECK (is_admin());

-- rental_shop_conditions: add anon INSERT/DELETE/UPDATE
CREATE POLICY "Allow anon admins to create rental shop conditions"
  ON public.rental_shop_conditions
  FOR INSERT
  TO anon
  WITH CHECK (is_admin());

CREATE POLICY "Allow anon admins to delete rental shop conditions"
  ON public.rental_shop_conditions
  FOR DELETE
  TO anon
  USING (is_admin());

CREATE POLICY "Allow anon admins to update rental shop conditions"
  ON public.rental_shop_conditions
  FOR UPDATE
  TO anon
  USING (is_admin())
  WITH CHECK (is_admin());

-- motorcycle_conditions: add anon INSERT/DELETE/UPDATE
CREATE POLICY "Allow anon admins to create motorcycle conditions"
  ON public.motorcycle_conditions
  FOR INSERT
  TO anon
  WITH CHECK (is_admin());

CREATE POLICY "Allow anon admins to delete motorcycle conditions"
  ON public.motorcycle_conditions
  FOR DELETE
  TO anon
  USING (is_admin());

CREATE POLICY "Allow anon admins to update motorcycle conditions"
  ON public.motorcycle_conditions
  FOR UPDATE
  TO anon
  USING (is_admin())
  WITH CHECK (is_admin());
;
