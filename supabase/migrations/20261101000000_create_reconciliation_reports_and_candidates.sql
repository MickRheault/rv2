-- Migration: Complete Reconciliation Reports, Unresolved Candidates, and Independent Status Dimensions
-- Spec #201 / Ticket #202

-- 1. Extend proposal_status enum for report-only acknowledgment and run superseding
ALTER TYPE public.proposal_status ADD VALUE IF NOT EXISTS 'acknowledged';
ALTER TYPE public.proposal_status ADD VALUE IF NOT EXISTS 'superseded';

-- 2. Extend change_proposals with orthogonal status dimensions, payload_digest, and optimistic concurrency version
ALTER TABLE public.change_proposals
  ADD COLUMN IF NOT EXISTS coverage_status TEXT NOT NULL DEFAULT 'unknown'
    CHECK (coverage_status IN ('complete', 'partial', 'failed', 'unknown')),
  ADD COLUMN IF NOT EXISTS reconciliation_status TEXT NOT NULL DEFAULT 'unknown'
    CHECK (reconciliation_status IN ('complete', 'unresolved', 'unknown')),
  ADD COLUMN IF NOT EXISTS application_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (application_status IN ('pending', 'not_applicable', 'applied', 'partially_applied', 'failed', 'rejected')),
  ADD COLUMN IF NOT EXISTS payload_digest TEXT,
  ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 1
    CHECK (version >= 1);

-- Backfill application_status from existing status without fabricating historical coverage/reconciliation quality
UPDATE public.change_proposals
SET application_status = CASE
  WHEN status = 'applied' THEN 'applied'
  WHEN status = 'partially_applied' THEN 'partially_applied'
  WHEN status = 'rejected' THEN 'rejected'
  ELSE 'pending'
END
WHERE application_status = 'pending'
  AND status IN ('applied', 'partially_applied', 'rejected');

-- Enforce (shop_id, agent_run_id) uniqueness for new-format proposals (where payload_digest IS NOT NULL)
CREATE UNIQUE INDEX IF NOT EXISTS uq_change_proposals_shop_agent_run_new_format
  ON public.change_proposals (shop_id, agent_run_id)
  WHERE agent_run_id IS NOT NULL AND payload_digest IS NOT NULL;

-- 3. Extend change_proposal_items with optional client_item_id
ALTER TABLE public.change_proposal_items
  ADD COLUMN IF NOT EXISTS client_item_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS uq_change_proposal_items_client_item_id
  ON public.change_proposal_items (proposal_id, client_item_id)
  WHERE client_item_id IS NOT NULL;

-- 4. Extend crawl_runs and shop_agent_configs for separated run execution vs quality bookkeeping
ALTER TABLE public.crawl_runs
  DROP CONSTRAINT IF EXISTS crawl_runs_status_check;

ALTER TABLE public.crawl_runs
  ADD CONSTRAINT crawl_runs_status_check
    CHECK (status IN ('success', 'partial', 'failed')),
  ADD COLUMN IF NOT EXISTS coverage_status TEXT NOT NULL DEFAULT 'unknown'
    CHECK (coverage_status IN ('complete', 'partial', 'failed', 'unknown')),
  ADD COLUMN IF NOT EXISTS reconciliation_status TEXT NOT NULL DEFAULT 'unknown'
    CHECK (reconciliation_status IN ('complete', 'unresolved', 'unknown'));

CREATE UNIQUE INDEX IF NOT EXISTS uq_crawl_runs_shop_agent_run
  ON public.crawl_runs (shop_id, agent_run_id)
  WHERE agent_run_id IS NOT NULL;

ALTER TABLE public.shop_agent_configs
  ADD COLUMN IF NOT EXISTS last_coverage_status TEXT NOT NULL DEFAULT 'unknown'
    CHECK (last_coverage_status IN ('complete', 'partial', 'failed', 'unknown')),
  ADD COLUMN IF NOT EXISTS last_reconciliation_status TEXT NOT NULL DEFAULT 'unknown'
    CHECK (last_reconciliation_status IN ('complete', 'unresolved', 'unknown'));

-- 5. Durable Unresolved Candidates table
CREATE TABLE IF NOT EXISTS public.unresolved_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.rental_shops(id) ON DELETE CASCADE,
  identity_key TEXT,
  brand_name TEXT NOT NULL,
  model_name TEXT NOT NULL,
  year INT,
  year_to INT,
  variant_label TEXT,
  source_identity JSONB NOT NULL DEFAULT '{}'::jsonb,
  state TEXT NOT NULL DEFAULT 'open'
    CHECK (state IN ('open', 'ready_for_proposal', 'resolved_applied', 'excluded', 'dismissed')),
  flagged_for_review BOOLEAN NOT NULL DEFAULT false,
  current_issues JSONB NOT NULL DEFAULT '[]'::jsonb,
  next_action TEXT,
  latest_evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
  originating_run_id TEXT NOT NULL,
  originating_proposal_id UUID REFERENCES public.change_proposals(id) ON DELETE SET NULL,
  latest_run_id TEXT NOT NULL,
  latest_proposal_id UUID REFERENCES public.change_proposals(id) ON DELETE SET NULL,
  linked_proposal_item_id UUID REFERENCES public.change_proposal_items(id) ON DELETE SET NULL,
  resolved_motorcycle_id UUID REFERENCES public.motorcycle_rentals(id) ON DELETE SET NULL,
  resolution_reason TEXT,
  version INT NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_unresolved_candidates_shop_state
  ON public.unresolved_candidates (shop_id, state, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_unresolved_candidates_shop_identity
  ON public.unresolved_candidates (shop_id, identity_key)
  WHERE identity_key IS NOT NULL;

DROP TRIGGER IF EXISTS set_timestamp_unresolved_candidates ON public.unresolved_candidates;
CREATE TRIGGER set_timestamp_unresolved_candidates
  BEFORE UPDATE ON public.unresolved_candidates
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();

-- 6. Immutable Reconciliation Reports table
CREATE TABLE IF NOT EXISTS public.reconciliation_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID NOT NULL UNIQUE REFERENCES public.change_proposals(id) ON DELETE CASCADE,
  shop_id UUID NOT NULL REFERENCES public.rental_shops(id) ON DELETE CASCADE,
  agent_run_id TEXT NOT NULL,
  schema_version INT NOT NULL CHECK (schema_version = 1),
  report_version INT NOT NULL DEFAULT 1 CHECK (report_version >= 1),
  report_digest TEXT NOT NULL,
  scope JSONB NOT NULL,
  coverage JSONB NOT NULL,
  server_counts JSONB NOT NULL,
  raw_report JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reconciliation_reports_shop_run
  ON public.reconciliation_reports (shop_id, agent_run_id);

-- 7. Reconciliation Report Entries table
CREATE TABLE IF NOT EXISTS public.reconciliation_report_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES public.reconciliation_reports(id) ON DELETE CASCADE,
  proposal_id UUID NOT NULL REFERENCES public.change_proposals(id) ON DELETE CASCADE,
  entry_index INT NOT NULL CHECK (entry_index >= 0),
  entry_key TEXT NOT NULL,
  brand_name TEXT NOT NULL,
  model_name TEXT NOT NULL,
  existing_motorcycle_id UUID REFERENCES public.motorcycle_rentals(id) ON DELETE SET NULL,
  candidate_id UUID REFERENCES public.unresolved_candidates(id) ON DELETE SET NULL,
  disposition TEXT NOT NULL
    CHECK (disposition IN ('ready_change', 'unchanged', 'unresolved', 'excluded', 'duplicate')),
  compared_attributes JSONB,
  issues JSONB,
  next_action TEXT,
  reason TEXT,
  duplicate_of_entry_key TEXT,
  duplicate_of_motorcycle_id UUID REFERENCES public.motorcycle_rentals(id) ON DELETE SET NULL,
  evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_reconciliation_report_entries_key UNIQUE (report_id, entry_key)
);

CREATE INDEX IF NOT EXISTS idx_reconciliation_report_entries_report_idx
  ON public.reconciliation_report_entries (report_id, entry_index ASC);

-- 8. Reconciliation Entry <-> Change Proposal Item Links
CREATE TABLE IF NOT EXISTS public.reconciliation_entry_item_links (
  entry_id UUID NOT NULL REFERENCES public.reconciliation_report_entries(id) ON DELETE CASCADE,
  proposal_item_id UUID NOT NULL REFERENCES public.change_proposal_items(id) ON DELETE CASCADE,
  client_item_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (entry_id, proposal_item_id)
);

CREATE INDEX IF NOT EXISTS idx_reconciliation_entry_item_links_item
  ON public.reconciliation_entry_item_links (proposal_item_id);

-- 9. Append-Only Unresolved Candidate Audit & Observation Events
CREATE TABLE IF NOT EXISTS public.unresolved_candidate_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES public.unresolved_candidates(id) ON DELETE CASCADE,
  shop_id UUID NOT NULL REFERENCES public.rental_shops(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('agent', 'admin', 'system')),
  actor_id UUID,
  agent_run_id TEXT,
  proposal_id UUID REFERENCES public.change_proposals(id) ON DELETE SET NULL,
  previous_state TEXT,
  new_state TEXT NOT NULL,
  reason TEXT,
  issues_snapshot JSONB,
  evidence_snapshot JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_unresolved_candidate_events_candidate
  ON public.unresolved_candidate_events (candidate_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_unresolved_candidate_events_shop
  ON public.unresolved_candidate_events (shop_id, created_at DESC);

-- 10. Append-Only Proposal Decision Audit Events
CREATE TABLE IF NOT EXISTS public.proposal_decision_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID NOT NULL REFERENCES public.change_proposals(id) ON DELETE CASCADE,
  shop_id UUID NOT NULL REFERENCES public.rental_shops(id) ON DELETE CASCADE,
  decision TEXT NOT NULL
    CHECK (decision IN ('apply', 'partially_apply', 'reject', 'acknowledge', 'supersede')),
  actor_id UUID,
  proposal_version INT NOT NULL,
  notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_proposal_decision_events_proposal
  ON public.proposal_decision_events (proposal_id, created_at ASC);

-- 11. Row Level Security (Admin-only via authenticated + is_admin(); zero anon policies)
ALTER TABLE public.unresolved_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reconciliation_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reconciliation_report_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reconciliation_entry_item_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unresolved_candidate_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposal_decision_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow admins to read unresolved candidates" ON public.unresolved_candidates
  FOR SELECT TO authenticated USING (is_admin());
CREATE POLICY "Allow admins to insert unresolved candidates" ON public.unresolved_candidates
  FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY "Allow admins to update unresolved candidates" ON public.unresolved_candidates
  FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "Allow admins to read reconciliation reports" ON public.reconciliation_reports
  FOR SELECT TO authenticated USING (is_admin());
CREATE POLICY "Allow admins to insert reconciliation reports" ON public.reconciliation_reports
  FOR INSERT TO authenticated WITH CHECK (is_admin());

CREATE POLICY "Allow admins to read reconciliation report entries" ON public.reconciliation_report_entries
  FOR SELECT TO authenticated USING (is_admin());
CREATE POLICY "Allow admins to insert reconciliation report entries" ON public.reconciliation_report_entries
  FOR INSERT TO authenticated WITH CHECK (is_admin());

CREATE POLICY "Allow admins to read reconciliation entry item links" ON public.reconciliation_entry_item_links
  FOR SELECT TO authenticated USING (is_admin());
CREATE POLICY "Allow admins to insert reconciliation entry item links" ON public.reconciliation_entry_item_links
  FOR INSERT TO authenticated WITH CHECK (is_admin());

CREATE POLICY "Allow admins to read unresolved candidate events" ON public.unresolved_candidate_events
  FOR SELECT TO authenticated USING (is_admin());
CREATE POLICY "Allow admins to insert unresolved candidate events" ON public.unresolved_candidate_events
  FOR INSERT TO authenticated WITH CHECK (is_admin());

CREATE POLICY "Allow admins to read proposal decision events" ON public.proposal_decision_events
  FOR SELECT TO authenticated USING (is_admin());
CREATE POLICY "Allow admins to insert proposal decision events" ON public.proposal_decision_events
  FOR INSERT TO authenticated WITH CHECK (is_admin());

-- 12. Atomic Staging RPC for New-Format Change Proposals + Reconciliation Reports
CREATE OR REPLACE FUNCTION public.stage_change_proposal_with_report(p_payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_shop_id UUID := (p_payload->>'shopId')::UUID;
  v_agent_run_id TEXT := p_payload->>'agentRunId';
  v_payload_digest TEXT := p_payload->>'payloadDigest';
  v_existing_proposal RECORD;
  v_existing_report RECORD;
  v_proposal_id UUID;
  v_report_id UUID;
  v_item JSONB;
  v_inserted_item_id UUID;
  v_item_map JSONB := '{}'::jsonb;
  v_cand_op JSONB;
  v_cand_id UUID;
  v_cand_map JSONB := '{}'::jsonb;
  v_entry JSONB;
  v_entry_id UUID;
  v_ref_client_id TEXT;
  v_superseded_id UUID;
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role'
     AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: admin or service_role required';
  END IF;

  -- Check (shop_id, agent_run_id) idempotency
  SELECT id, payload_digest, status, coverage_status, reconciliation_status, application_status, version
  INTO v_existing_proposal
  FROM public.change_proposals
  WHERE shop_id = v_shop_id
    AND agent_run_id = v_agent_run_id
    AND payload_digest IS NOT NULL
  FOR UPDATE;

  IF FOUND THEN
    IF v_existing_proposal.payload_digest = v_payload_digest THEN
      SELECT id, report_version, report_digest, server_counts
      INTO v_existing_report
      FROM public.reconciliation_reports
      WHERE proposal_id = v_existing_proposal.id;

      RETURN jsonb_build_object(
        'replayed', true,
        'proposalId', v_existing_proposal.id,
        'proposalVersion', v_existing_proposal.version,
        'proposalStatus', v_existing_proposal.status,
        'coverageStatus', v_existing_proposal.coverage_status,
        'reconciliationStatus', v_existing_proposal.reconciliation_status,
        'applicationStatus', v_existing_proposal.application_status,
        'reportId', v_existing_report.id,
        'reportVersion', v_existing_report.report_version,
        'reportDigest', v_existing_report.report_digest,
        'serverCounts', v_existing_report.server_counts
      );
    ELSE
      RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT: Different payload already staged for shop % and agentRunId %', v_shop_id, v_agent_run_id
        USING ERRCODE = '23505';
    END IF;
  END IF;

  -- Supersede prior pending proposals for the same shop + scope
  IF jsonb_typeof(p_payload->'supersededProposalIds') = 'array' THEN
    FOR v_superseded_id IN
      SELECT (val #>> '{}')::UUID
      FROM jsonb_array_elements(p_payload->'supersededProposalIds') AS val
    LOOP
      UPDATE public.change_proposals
      SET status = 'superseded',
          version = version + 1
      WHERE id = v_superseded_id
        AND shop_id = v_shop_id
        AND status = 'pending';

      IF FOUND THEN
        INSERT INTO public.proposal_decision_events (
          proposal_id, shop_id, decision, proposal_version, notes
        )
        SELECT id, shop_id, 'supersede', version, 'Superseded by newer agentRunId ' || v_agent_run_id
        FROM public.change_proposals
        WHERE id = v_superseded_id;

        -- Revert any ready_for_proposal candidates linked to the superseded proposal back to open
        INSERT INTO public.unresolved_candidate_events (
          candidate_id, shop_id, event_type, actor_type, agent_run_id, proposal_id, previous_state, new_state, reason
        )
        SELECT id, shop_id, 'proposal_superseded', 'system', v_agent_run_id, v_superseded_id, 'ready_for_proposal', 'open',
               'Linked pending proposal superseded before application'
        FROM public.unresolved_candidates
        WHERE shop_id = v_shop_id
          AND state = 'ready_for_proposal'
          AND latest_proposal_id = v_superseded_id;

        UPDATE public.unresolved_candidates
        SET state = 'open',
            linked_proposal_item_id = NULL,
            version = version + 1
        WHERE shop_id = v_shop_id
          AND state = 'ready_for_proposal'
          AND latest_proposal_id = v_superseded_id;
      END IF;
    END LOOP;
  END IF;

  -- 1. Insert parent change_proposals row
  INSERT INTO public.change_proposals (
    shop_id,
    agent_run_id,
    source_url,
    raw_snapshot,
    status,
    coverage_status,
    reconciliation_status,
    application_status,
    payload_digest,
    summary_counts
  )
  VALUES (
    v_shop_id,
    v_agent_run_id,
    p_payload->>'sourceUrl',
    COALESCE(p_payload->'rawSnapshot', '{}'::jsonb),
    (p_payload->>'initialProposalStatus')::public.proposal_status,
    p_payload->>'coverageStatus',
    p_payload->>'reconciliationStatus',
    p_payload->>'applicationStatus',
    v_payload_digest,
    COALESCE(p_payload->'summaryCounts', '{"add":0,"update":0,"delist":0,"unchanged":0}'::jsonb)
  )
  RETURNING id INTO v_proposal_id;

  -- 2. Insert actionable change_proposal_items and map client_item_id -> id
  IF jsonb_typeof(p_payload->'items') = 'array' THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_payload->'items')
    LOOP
      INSERT INTO public.change_proposal_items (
        proposal_id,
        client_item_id,
        entity_type,
        action,
        entity_id,
        brand_name,
        model_name,
        original_data,
        proposed_data,
        diff_summary,
        status
      )
      VALUES (
        v_proposal_id,
        NULLIF(v_item->>'client_item_id', ''),
        (v_item->>'entity_type')::public.proposal_entity_type,
        (v_item->>'action')::public.proposal_action,
        NULLIF(v_item->>'entity_id', '')::UUID,
        v_item->>'brand_name',
        v_item->>'model_name',
        v_item->'original_data',
        COALESCE(v_item->'proposed_data', '{}'::jsonb),
        v_item->'diff_summary',
        (v_item->>'status')::public.proposal_item_status
      )
      RETURNING id INTO v_inserted_item_id;

      IF NULLIF(v_item->>'client_item_id', '') IS NOT NULL THEN
        v_item_map := v_item_map || jsonb_build_object(v_item->>'client_item_id', v_inserted_item_id);
      END IF;
    END LOOP;
  END IF;

  -- 3. Apply candidate operations and record immutable candidate events
  IF jsonb_typeof(p_payload->'candidateOps') = 'array' THEN
    FOR v_cand_op IN SELECT * FROM jsonb_array_elements(p_payload->'candidateOps')
    LOOP
      IF (v_cand_op->>'mode') = 'insert' THEN
        INSERT INTO public.unresolved_candidates (
          shop_id,
          identity_key,
          brand_name,
          model_name,
          year,
          year_to,
          variant_label,
          source_identity,
          state,
          flagged_for_review,
          current_issues,
          next_action,
          latest_evidence,
          originating_run_id,
          originating_proposal_id,
          latest_run_id,
          latest_proposal_id,
          linked_proposal_item_id
        )
        VALUES (
          v_shop_id,
          NULLIF(v_cand_op->>'identityKey', ''),
          v_cand_op->>'brandName',
          v_cand_op->>'modelName',
          (v_cand_op->>'year')::INT,
          (v_cand_op->>'yearTo')::INT,
          NULLIF(v_cand_op->>'variantLabel', ''),
          COALESCE(v_cand_op->'sourceIdentity', '{}'::jsonb),
          v_cand_op->>'newState',
          COALESCE((v_cand_op->>'flaggedForReview')::BOOLEAN, false),
          COALESCE(v_cand_op->'issues', '[]'::jsonb),
          v_cand_op->>'nextAction',
          COALESCE(v_cand_op->'evidence', '[]'::jsonb),
          v_agent_run_id,
          v_proposal_id,
          v_agent_run_id,
          v_proposal_id,
          CASE
            WHEN NULLIF(v_cand_op->>'linkedClientItemId', '') IS NOT NULL
              THEN (v_item_map->>(v_cand_op->>'linkedClientItemId'))::UUID
            ELSE NULL
          END
        )
        RETURNING id INTO v_cand_id;
      ELSE
        v_cand_id := (v_cand_op->>'candidateId')::UUID;
        UPDATE public.unresolved_candidates
        SET state = v_cand_op->>'newState',
            flagged_for_review = COALESCE((v_cand_op->>'flaggedForReview')::BOOLEAN, flagged_for_review),
            current_issues = COALESCE(v_cand_op->'issues', current_issues),
            next_action = COALESCE(v_cand_op->>'nextAction', next_action),
            latest_evidence = COALESCE(v_cand_op->'evidence', latest_evidence),
            latest_run_id = v_agent_run_id,
            latest_proposal_id = v_proposal_id,
            linked_proposal_item_id = CASE
              WHEN NULLIF(v_cand_op->>'linkedClientItemId', '') IS NOT NULL
                THEN (v_item_map->>(v_cand_op->>'linkedClientItemId'))::UUID
              WHEN (v_cand_op->>'clearLinkedItem')::BOOLEAN IS TRUE
                THEN NULL
              ELSE linked_proposal_item_id
            END,
            version = version + 1
        WHERE id = v_cand_id
          AND shop_id = v_shop_id;
      END IF;

      IF NULLIF(v_cand_op->>'entryKey', '') IS NOT NULL THEN
        v_cand_map := v_cand_map || jsonb_build_object(v_cand_op->>'entryKey', v_cand_id);
      END IF;

      INSERT INTO public.unresolved_candidate_events (
        candidate_id,
        shop_id,
        event_type,
        actor_type,
        agent_run_id,
        proposal_id,
        previous_state,
        new_state,
        reason,
        issues_snapshot,
        evidence_snapshot
      )
      VALUES (
        v_cand_id,
        v_shop_id,
        v_cand_op->>'eventType',
        'agent',
        v_agent_run_id,
        v_proposal_id,
        NULLIF(v_cand_op->>'previousState', ''),
        v_cand_op->>'newState',
        NULLIF(v_cand_op->>'reason', ''),
        v_cand_op->'issues',
        v_cand_op->'evidence'
      );
    END LOOP;
  END IF;

  -- 4. Insert immutable reconciliation_reports snapshot
  INSERT INTO public.reconciliation_reports (
    proposal_id,
    shop_id,
    agent_run_id,
    schema_version,
    report_version,
    report_digest,
    scope,
    coverage,
    server_counts,
    raw_report
  )
  VALUES (
    v_proposal_id,
    v_shop_id,
    v_agent_run_id,
    1,
    1,
    p_payload->>'reportDigest',
    p_payload->'scope',
    p_payload->'coverage',
    p_payload->'serverCounts',
    p_payload->'rawReport'
  )
  RETURNING id INTO v_report_id;

  -- 5. Insert reconciliation_report_entries and reconciliation_entry_item_links
  IF jsonb_typeof(p_payload->'entries') = 'array' THEN
    FOR v_entry IN SELECT * FROM jsonb_array_elements(p_payload->'entries')
    LOOP
      INSERT INTO public.reconciliation_report_entries (
        report_id,
        proposal_id,
        entry_index,
        entry_key,
        brand_name,
        model_name,
        existing_motorcycle_id,
        candidate_id,
        disposition,
        compared_attributes,
        issues,
        next_action,
        reason,
        duplicate_of_entry_key,
        duplicate_of_motorcycle_id,
        evidence
      )
      VALUES (
        v_report_id,
        v_proposal_id,
        (v_entry->>'entryIndex')::INT,
        v_entry->>'entryKey',
        v_entry->>'brandName',
        v_entry->>'modelName',
        NULLIF(v_entry->>'existingMotorcycleId', '')::UUID,
        COALESCE(
          NULLIF(v_entry->>'candidateId', '')::UUID,
          (v_cand_map->>(v_entry->>'entryKey'))::UUID
        ),
        v_entry->>'disposition',
        v_entry->'comparedAttributes',
        v_entry->'issues',
        NULLIF(v_entry->>'nextAction', ''),
        NULLIF(v_entry->>'reason', ''),
        NULLIF(v_entry->>'duplicateOfEntryKey', ''),
        NULLIF(v_entry->>'duplicateOfMotorcycleId', '')::UUID,
        COALESCE(v_entry->'evidence', '[]'::jsonb)
      )
      RETURNING id INTO v_entry_id;

      IF jsonb_typeof(v_entry->'proposalItemRefs') = 'array' THEN
        FOR v_ref_client_id IN
          SELECT val #>> '{}'
          FROM jsonb_array_elements(v_entry->'proposalItemRefs') AS val
        LOOP
          INSERT INTO public.reconciliation_entry_item_links (
            entry_id,
            proposal_item_id,
            client_item_id
          )
          VALUES (
            v_entry_id,
            (v_item_map->>v_ref_client_id)::UUID,
            v_ref_client_id
          );
        END LOOP;
      END IF;
    END LOOP;
  END IF;

  -- 6. Persist learned extraction hints atomically ONLY after full validation & staging succeed
  IF jsonb_typeof(p_payload->'learnedConfig') = 'object' THEN
    UPDATE public.shop_agent_configs
    SET extraction_hints = COALESCE(p_payload->'learnedConfig'->>'extractionHints', extraction_hints),
        source_url = COALESCE(p_payload->'learnedConfig'->>'discoveredSourceUrl', source_url)
    WHERE shop_id = v_shop_id;
  END IF;

  RETURN jsonb_build_object(
    'replayed', false,
    'proposalId', v_proposal_id,
    'proposalVersion', 1,
    'proposalStatus', p_payload->>'initialProposalStatus',
    'coverageStatus', p_payload->>'coverageStatus',
    'reconciliationStatus', p_payload->>'reconciliationStatus',
    'applicationStatus', p_payload->>'applicationStatus',
    'reportId', v_report_id,
    'reportVersion', 1,
    'reportDigest', p_payload->>'reportDigest',
    'serverCounts', p_payload->'serverCounts'
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.stage_change_proposal_with_report(JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.stage_change_proposal_with_report(JSONB) TO service_role;
