-- Seed file for development data
-- Creates admin account for michael.rheault@gmail.com

-- Create admin user account
INSERT INTO auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
) VALUES (
  'a0000000-0000-0000-0000-000000000001'::uuid,
  '00000000-0000-0000-0000-000000000000'::uuid,
  'authenticated',
  'authenticated',
  'michael.rheault@gmail.com',
  crypt('admin123', gen_salt('bf')), -- Default password: admin123
  NOW(),
  NOW(),
  NOW(),
  '{"provider": "email", "providers": ["email"]}',
  '{"name": "Michael Rheault", "email": "michael.rheault@gmail.com"}',
  '',
  '',
  '',
  ''
);

-- Create identity for email authentication
INSERT INTO auth.identities (
  id,
  user_id,
  identity_data,
  provider,
  provider_id,
  created_at,
  updated_at
) VALUES (
  'a0000000-0000-0000-0000-000000000002'::uuid,
  'a0000000-0000-0000-0000-000000000001'::uuid,
  jsonb_build_object(
    'sub', 'a0000000-0000-0000-0000-000000000001',
    'email', 'michael.rheault@gmail.com'
  ),
  'email',
  'a0000000-0000-0000-0000-000000000001',
  NOW(),
  NOW()
);

-- Assign admin role
INSERT INTO public.user_roles (user_id, role, created_at, updated_at) 
VALUES (
  'a0000000-0000-0000-0000-000000000001'::uuid,
  'admin',
  NOW(),
  NOW()
); 