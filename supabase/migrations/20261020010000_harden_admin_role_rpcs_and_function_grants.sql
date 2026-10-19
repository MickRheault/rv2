-- Harden make_user_admin and remove_user_admin RPCs against unauthenticated privilege escalation (#166)
-- Also revoke blanket default EXECUTE privileges on future functions in schema public from PUBLIC, anon, and authenticated.

CREATE OR REPLACE FUNCTION public.make_user_admin(user_email TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  target_user_id UUID;
  admin_exists BOOLEAN;
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role'
     AND current_user NOT IN ('postgres', 'supabase_admin')
     AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: admin or service_role required';
  END IF;

  SELECT auth.users.id INTO target_user_id
  FROM auth.users
  WHERE auth.users.email = user_email;

  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'User with email % not found', user_email;
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.user_roles
    WHERE user_id = target_user_id AND role = 'admin'
  ) INTO admin_exists;

  IF admin_exists THEN
    RAISE NOTICE 'User % is already an admin', user_email;
    RETURN TRUE;
  END IF;

  INSERT INTO public.user_roles (user_id, role, created_at, updated_at)
  VALUES (target_user_id, 'admin', NOW(), NOW());

  RAISE NOTICE 'User % has been granted admin privileges', user_email;
  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.remove_user_admin(user_email TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  target_user_id UUID;
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role'
     AND current_user NOT IN ('postgres', 'supabase_admin')
     AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: admin or service_role required';
  END IF;

  SELECT auth.users.id INTO target_user_id
  FROM auth.users
  WHERE auth.users.email = user_email;

  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'User with email % not found', user_email;
  END IF;

  DELETE FROM public.user_roles
  WHERE user_id = target_user_id AND role = 'admin';

  RAISE NOTICE 'Admin privileges removed from user %', user_email;
  RETURN TRUE;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.make_user_admin(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.make_user_admin(TEXT) TO service_role;

REVOKE EXECUTE ON FUNCTION public.remove_user_admin(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.remove_user_admin(TEXT) TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;
