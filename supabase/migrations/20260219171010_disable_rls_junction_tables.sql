
-- Disable RLS on junction tables that are only written through the admin MCP server.
-- Read access is public (anon/authenticated SELECT = true already).
-- Write access is enforced by the MCP admin API key at the application layer.
-- The MCP server does not authenticate with a Supabase Auth JWT for these 
-- junction table operations, so auth.uid()-based RLS policies cannot work.

ALTER TABLE public.motorcycle_conditions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.rental_shop_conditions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.rental_shop_inclusions DISABLE ROW LEVEL SECURITY;
;
