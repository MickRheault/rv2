-- Admin account setup utility
-- Creates a function to easily assign admin role to users

-- Function to make a user an admin by email
CREATE OR REPLACE FUNCTION public.make_user_admin(user_email TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  target_user_id uuid;
  admin_exists boolean;
BEGIN
  -- Find the user by email
  SELECT auth.users.id INTO target_user_id
  FROM auth.users
  WHERE auth.users.email = user_email;
  
  -- Check if user exists
  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'User with email % not found', user_email;
  END IF;
  
  -- Check if user is already an admin
  SELECT EXISTS(
    SELECT 1 FROM public.user_roles 
    WHERE user_id = target_user_id AND role = 'admin'
  ) INTO admin_exists;
  
  IF admin_exists THEN
    RAISE NOTICE 'User % is already an admin', user_email;
    RETURN TRUE;
  END IF;
  
  -- Add admin role
  INSERT INTO public.user_roles (user_id, role, created_at, updated_at)
  VALUES (target_user_id, 'admin', NOW(), NOW());
  
  RAISE NOTICE 'User % has been granted admin privileges', user_email;
  RETURN TRUE;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error making user admin: %', SQLERRM;
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to service role
GRANT EXECUTE ON FUNCTION public.make_user_admin(TEXT) TO service_role;

-- Function to remove admin role from a user
CREATE OR REPLACE FUNCTION public.remove_user_admin(user_email TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  target_user_id uuid;
BEGIN
  -- Find the user by email
  SELECT auth.users.id INTO target_user_id
  FROM auth.users
  WHERE auth.users.email = user_email;
  
  -- Check if user exists
  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'User with email % not found', user_email;
  END IF;
  
  -- Remove admin role
  DELETE FROM public.user_roles 
  WHERE user_id = target_user_id AND role = 'admin';
  
  RAISE NOTICE 'Admin privileges removed from user %', user_email;
  RETURN TRUE;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error removing admin privileges: %', SQLERRM;
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to service role
GRANT EXECUTE ON FUNCTION public.remove_user_admin(TEXT) TO service_role; 