-- Migration: Create crawl_runs table for crawler audit logging
-- Ticket #86: feat: crawl run audit log table and attempt ingestion

CREATE TABLE IF NOT EXISTS public.crawl_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.rental_shops(id) ON DELETE CASCADE,
  proposal_id UUID REFERENCES public.change_proposals(id) ON DELETE SET NULL,
  agent_run_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('success', 'failed')),
  error_message TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_crawl_runs_shop_created 
  ON public.crawl_runs (shop_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_crawl_runs_status_created 
  ON public.crawl_runs (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_crawl_runs_proposal 
  ON public.crawl_runs (proposal_id);

-- RLS
ALTER TABLE public.crawl_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow admins to read crawl runs" ON public.crawl_runs
  FOR SELECT TO authenticated
  USING (is_admin());

CREATE POLICY "Allow admins to insert crawl runs" ON public.crawl_runs
  FOR INSERT TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "Allow admins to delete crawl runs" ON public.crawl_runs
  FOR DELETE TO authenticated
  USING (is_admin());
