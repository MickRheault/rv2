-- This migration adds an INSERT policy to the analytics_snapshots table
-- to allow administrators to manually trigger a snapshot.

-- Grant INSERT access to admins
CREATE POLICY "Allow insert access for admins"
  ON public.analytics_snapshots
  FOR INSERT
  WITH CHECK (auth.jwt() ->> 'is_admin' = 'true'); 