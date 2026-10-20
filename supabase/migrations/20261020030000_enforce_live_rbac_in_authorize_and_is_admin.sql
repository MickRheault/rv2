-- Enforce live RBAC checks in public.authorize and public.is_admin (#176 / #174)
-- Eliminates reliance on stale JWT user_role claims and excludes soft-deleted or banned accounts.

CREATE OR REPLACE FUNCTION public.authorize(requested_permission public.app_permission)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  caller_id uuid;
  bind_permissions int;
BEGIN
  caller_id := auth.uid();

  IF caller_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT count(*)
  INTO bind_permissions
  FROM public.role_permissions rp
  INNER JOIN public.user_roles ur
    ON ur.role = rp.role
  INNER JOIN auth.users u
    ON u.id = ur.user_id
  WHERE ur.user_id = caller_id
    AND rp.permission = requested_permission
    AND COALESCE((u.raw_user_meta_data->>'deleted')::boolean, false) = false
    AND COALESCE((u.raw_app_meta_data->>'deleted')::boolean, false) = false
    AND (u.banned_until IS NULL OR u.banned_until <= NOW());

  RETURN bind_permissions > 0;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  caller_id uuid;
  admin_count int;
BEGIN
  caller_id := auth.uid();

  IF caller_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT count(*)
  INTO admin_count
  FROM public.user_roles ur
  INNER JOIN auth.users u
    ON u.id = ur.user_id
  WHERE ur.user_id = caller_id
    AND ur.role = 'admin'
    AND COALESCE((u.raw_user_meta_data->>'deleted')::boolean, false) = false
    AND COALESCE((u.raw_app_meta_data->>'deleted')::boolean, false) = false
    AND (u.banned_until IS NULL OR u.banned_until <= NOW());

  RETURN admin_count > 0;
END;
$$;

GRANT EXECUTE ON FUNCTION public.authorize(public.app_permission) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated, service_role;
