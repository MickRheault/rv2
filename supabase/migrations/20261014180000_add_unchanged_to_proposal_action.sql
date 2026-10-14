-- Migration: Add 'unchanged' action to proposal_action enum
-- Ticket #108: feat(diff): capture unchanged fleet inventory in Change Proposals
-- Spec #111: Full fleet visibility and side-by-side change proposal diff system

ALTER TYPE public.proposal_action ADD VALUE IF NOT EXISTS 'unchanged';

-- Update summary_counts default to include unchanged counter
ALTER TABLE public.change_proposals 
  ALTER COLUMN summary_counts SET DEFAULT '{"add":0,"update":0,"delist":0,"unchanged":0}'::jsonb;
