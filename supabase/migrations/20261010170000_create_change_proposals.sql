-- Migration: Create change_proposals and change_proposal_items tables
-- Ticket #79: feat: save scraped changes and review list

-- Proposal Status Enum
DO $$ BEGIN
  CREATE TYPE public.proposal_status AS ENUM (
    'pending',
    'reviewing',
    'applied',
    'partially_applied',
    'rejected'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Proposal Action Enum
DO $$ BEGIN
  CREATE TYPE public.proposal_action AS ENUM (
    'add',
    'update',
    'delist'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Proposal Entity Type Enum
DO $$ BEGIN
  CREATE TYPE public.proposal_entity_type AS ENUM (
    'motorcycle',
    'rental_shop',
    'rental_rate_tier',
    'motorcycle_condition',
    'rental_shop_inclusion'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Proposal Item Status Enum
DO $$ BEGIN
  CREATE TYPE public.proposal_item_status AS ENUM (
    'pending',
    'approved',
    'rejected',
    'applied'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Parent Batch Table: change_proposals
CREATE TABLE IF NOT EXISTS public.change_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.rental_shops(id) ON DELETE CASCADE,
  agent_run_id TEXT,
  source_url TEXT NOT NULL,
  raw_snapshot JSONB NOT NULL,
  status public.proposal_status NOT NULL DEFAULT 'pending',
  summary_counts JSONB NOT NULL DEFAULT '{"add":0,"update":0,"delist":0}'::jsonb,
  notes TEXT,
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  applied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Child Items Table: change_proposal_items
CREATE TABLE IF NOT EXISTS public.change_proposal_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID NOT NULL REFERENCES public.change_proposals(id) ON DELETE CASCADE,
  entity_type public.proposal_entity_type NOT NULL,
  action public.proposal_action NOT NULL,
  entity_id UUID, -- References motorcycle_rentals(id) or rental_shops(id), null for add
  brand_name TEXT,
  model_name TEXT,
  original_data JSONB,
  proposed_data JSONB NOT NULL,
  diff_summary JSONB,
  status public.proposal_item_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_change_proposals_shop_status 
  ON public.change_proposals (shop_id, status);

CREATE INDEX IF NOT EXISTS idx_change_proposals_status_created 
  ON public.change_proposals (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_change_proposal_items_proposal 
  ON public.change_proposal_items (proposal_id, status);

-- Trigger for change_proposals updated_at
CREATE TRIGGER set_timestamp_change_proposals
  BEFORE UPDATE ON public.change_proposals
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();

-- RLS
ALTER TABLE public.change_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.change_proposal_items ENABLE ROW LEVEL SECURITY;

-- Allow authenticated admins full access to change_proposals
CREATE POLICY "Allow admins to read change proposals" ON public.change_proposals
  FOR SELECT TO authenticated
  USING (is_admin());

CREATE POLICY "Allow admins to insert change proposals" ON public.change_proposals
  FOR INSERT TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "Allow admins to update change proposals" ON public.change_proposals
  FOR UPDATE TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Allow admins to delete change proposals" ON public.change_proposals
  FOR DELETE TO authenticated
  USING (is_admin());

-- Allow authenticated admins full access to change_proposal_items
CREATE POLICY "Allow admins to read change proposal items" ON public.change_proposal_items
  FOR SELECT TO authenticated
  USING (is_admin());

CREATE POLICY "Allow admins to insert change proposal items" ON public.change_proposal_items
  FOR INSERT TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "Allow admins to update change proposal items" ON public.change_proposal_items
  FOR UPDATE TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Allow admins to delete change proposal items" ON public.change_proposal_items
  FOR DELETE TO authenticated
  USING (is_admin());
