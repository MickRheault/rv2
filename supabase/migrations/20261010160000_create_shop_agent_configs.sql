-- Migration: Create shop_agent_configs table for crawler agent settings and scheduling
-- Ticket #78: feat: shop crawl settings and task queue

CREATE TABLE IF NOT EXISTS public.shop_agent_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.rental_shops(id) ON DELETE CASCADE,
  tier INT NOT NULL DEFAULT 2 CHECK (tier IN (1, 2, 3)),
  source_url TEXT NOT NULL,
  extraction_hints TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_run_at TIMESTAMPTZ,
  last_error TEXT,
  consecutive_errors INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_shop_agent_configs_shop UNIQUE (shop_id)
);

-- Index for scheduler query (active configs by tier and last_run_at)
CREATE INDEX IF NOT EXISTS idx_shop_agent_configs_scheduler 
  ON public.shop_agent_configs (is_active, tier, last_run_at);

-- Updated_at trigger
CREATE TRIGGER set_timestamp_shop_agent_configs
  BEFORE UPDATE ON public.shop_agent_configs
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();

-- RLS
ALTER TABLE public.shop_agent_configs ENABLE ROW LEVEL SECURITY;

-- Allow authenticated admins full access
CREATE POLICY "Allow admins to read shop agent configs" ON public.shop_agent_configs
  FOR SELECT TO authenticated
  USING (is_admin());

CREATE POLICY "Allow admins to insert shop agent configs" ON public.shop_agent_configs
  FOR INSERT TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "Allow admins to update shop agent configs" ON public.shop_agent_configs
  FOR UPDATE TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Allow admins to delete shop agent configs" ON public.shop_agent_configs
  FOR DELETE TO authenticated
  USING (is_admin());
