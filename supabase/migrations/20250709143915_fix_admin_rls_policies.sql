-- Fix RLS policies for admin authentication system
-- Allow authenticated users to read their roles and permissions

-- Update RLS policy for user_roles to allow authenticated users to read their own roles
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
CREATE POLICY "Users can view their own roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Update RLS policy for role_permissions to allow authenticated users to view permissions for their role
DROP POLICY IF EXISTS "Authenticated users can view role permissions" ON public.role_permissions;
CREATE POLICY "Authenticated users can view role permissions" ON public.role_permissions
  FOR SELECT TO authenticated
  USING (
    role IN (
      SELECT ur.role 
      FROM public.user_roles ur 
      WHERE ur.user_id = auth.uid()
    )
  );

-- Grant necessary permissions to authenticated users
GRANT SELECT ON public.user_roles TO authenticated;
GRANT SELECT ON public.role_permissions TO authenticated;

