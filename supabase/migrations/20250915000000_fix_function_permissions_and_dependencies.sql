-- Fix function permissions and dependencies after schema rebuild
-- This migration addresses issues that occurred after the database teardown and rebuild

-- Grant execute permissions on all functions to necessary roles
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;

-- Set default privileges for future functions
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;

-- Fix sequence permissions that were missing after teardown
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT UPDATE ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;

-- Set default privileges for future sequences
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT UPDATE ON SEQUENCES TO authenticated, service_role;

-- Recreate generate_slug function with robust implementation
-- The original function had dependency issues with unaccent extension
-- Must use exact signature generate_slug(text) that scripts expect
DROP FUNCTION IF EXISTS generate_slug(input_text text);
DROP FUNCTION IF EXISTS generate_slug(text);

CREATE OR REPLACE FUNCTION generate_slug(text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  -- Simple slug generation without external dependencies
  -- Convert to lowercase, replace non-alphanumeric with hyphens, clean up
  -- Use $1 to reference the unnamed parameter
  RETURN lower(
    regexp_replace(
      regexp_replace(
        regexp_replace($1, '[^a-zA-Z0-9\s]', '', 'g'),
        '\s+', '-', 'g'
      ),
      '-+', '-', 'g'
    )
  );
END;
$$;

-- Grant permissions on the recreated function
GRANT EXECUTE ON FUNCTION generate_slug(text) TO anon, authenticated, service_role;

-- Log completion
SELECT 'Function permissions and dependencies fixed successfully' as status;
