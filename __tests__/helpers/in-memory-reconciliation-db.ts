import crypto from 'crypto';

export interface InMemoryReconciliationState {
  rental_shops: any[];
  shop_agent_configs: any[];
  categories: any[];
  condition_types: any[];
  brands: any[];
  motorcycle_rentals: any[];
  rental_rate_tiers: any[];
  motorcycle_conditions: any[];
  rental_shop_inclusions: any[];
  rental_shop_conditions: any[];
  change_proposals: any[];
  change_proposal_items: any[];
  reconciliation_reports: any[];
  reconciliation_report_entries: any[];
  reconciliation_entry_item_links: any[];
  unresolved_candidates: any[];
  unresolved_candidate_events: any[];
  proposal_decision_events: any[];
  crawl_runs: any[];
}

export function createRideOnSeedState(): InMemoryReconciliationState {
  return {
    rental_shops: [
      {
        id: '53529565-40d9-41f5-98e4-d2ed1f1d7ffd',
        provider_name: 'Ride On - Alquiler moto Barcelona',
        slug: 'ride-on-alquiler-moto-barcelona',
        website: 'https://rideon.es/flota/',
        phone: '+34 931 000 000',
        business_description: 'Barcelona motorcycle rentals',
        business_statuses: { name: 'Operational' },
        cities: {
          name: 'Barcelona',
          slug: 'barcelona',
          provinces: {
            countries: {
              name: 'Spain',
              slug: 'spain',
            },
          },
        },
      },
      {
        id: 'other-shop-9999-41f5-98e4-d2ed1f1d7ffd',
        provider_name: 'Other Madrid Shop',
        slug: 'other-madrid-shop',
        website: 'https://othermadrid.es',
        business_statuses: { name: 'Operational' },
      },
    ],
    shop_agent_configs: [
      {
        id: 'task-rideon-1',
        shop_id: '53529565-40d9-41f5-98e4-d2ed1f1d7ffd',
        tier: 1,
        source_url: 'https://rideon.es/flota/',
        extraction_hints: 'Initial hints',
        is_active: true,
        last_run_at: '2026-10-01T00:00:00.000Z',
        last_error: null,
        consecutive_errors: 0,
        last_coverage_status: 'unknown',
        last_reconciliation_status: 'unknown',
        created_at: '2026-09-01T00:00:00.000Z',
        updated_at: '2026-10-01T00:00:00.000Z',
      },
    ],
    categories: [
      { id: '77dd1ffd-a4e4-49ac-91fc-59d7d0a35737', name: 'Scooter' },
      { id: 'c375e3d9-e4df-4e09-8688-e7b26e78861c', name: 'Adventure' },
    ],
    condition_types: [
      { id: '11111111-1111-4111-8111-111111111111', name: 'Deposit' },
    ],
    brands: [
      { id: 'brand-honda', name: 'Honda' },
      { id: 'brand-yamaha', name: 'Yamaha' },
      { id: 'brand-bmw', name: 'BMW' },
    ],
    motorcycle_rentals: [
      {
        id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        shop_id: '53529565-40d9-41f5-98e4-d2ed1f1d7ffd',
        brand_id: 'brand-honda',
        category_id: '77dd1ffd-a4e4-49ac-91fc-59d7d0a35737',
        model: 'PCX 125',
        year: 2024,
        year_to: null,
        engine_capacity_cc: 125,
        availability_status: 'available',
        rental_rate_per_day: 35,
        rental_rate_currency: 'EUR',
        source_url: 'https://rideon.es/flota/honda-pcx-125/',
        specifications_details: null,
      },
      {
        id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        shop_id: 'other-shop-9999-41f5-98e4-d2ed1f1d7ffd',
        brand_id: 'brand-yamaha',
        category_id: '77dd1ffd-a4e4-49ac-91fc-59d7d0a35737',
        model: 'NMAX 125',
        year: 2024,
        year_to: null,
        engine_capacity_cc: 125,
        availability_status: 'available',
        rental_rate_per_day: 32,
        rental_rate_currency: 'EUR',
        source_url: 'https://othermadrid.es/nmax/',
        specifications_details: null,
      },
    ],
    rental_rate_tiers: [
      {
        id: 'tier-pcx-1',
        motorcycle_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        min_days: 1,
        max_days: 3,
        rate_per_day: 35,
        currency: 'EUR',
      },
      {
        id: 'tier-pcx-4',
        motorcycle_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        min_days: 4,
        max_days: null,
        rate_per_day: 29,
        currency: 'EUR',
      },
    ],
    motorcycle_conditions: [
      {
        id: 'mc-pcx-1',
        motorcycle_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        condition_type_id: '11111111-1111-4111-8111-111111111111',
        notes: 'EUR 300 refundable deposit',
      },
    ],
    rental_shop_inclusions: [],
    rental_shop_conditions: [],
    change_proposals: [],
    change_proposal_items: [],
    reconciliation_reports: [],
    reconciliation_report_entries: [],
    reconciliation_entry_item_links: [],
    unresolved_candidates: [],
    unresolved_candidate_events: [],
    proposal_decision_events: [],
    crawl_runs: [],
  };
}

function enrichRow(table: string, row: any, state: InMemoryReconciliationState) {
  const clone = structuredClone(row);
  if (table === 'change_proposals' || table === 'crawl_runs' || table === 'shop_agent_configs') {
    const shop = state.rental_shops.find((s) => s.id === row.shop_id) || null;
    clone.rental_shops = shop ? structuredClone(shop) : null;
  }
  if (table === 'crawl_runs' && row.proposal_id) {
    const prop = state.change_proposals.find((p) => p.id === row.proposal_id) || null;
    clone.change_proposals = prop ? structuredClone(prop) : null;
  }
  if (table === 'motorcycle_rentals') {
    const brand = state.brands.find((b) => b.id === row.brand_id) || null;
    const cat = state.categories.find((c) => c.id === row.category_id) || null;
    clone.brands = brand ? { name: brand.name } : null;
    clone.categories = cat ? { id: cat.id, name: cat.name } : null;
    clone.rental_rate_tiers = state.rental_rate_tiers
      .filter((t) => t.motorcycle_id === row.id)
      .map((t) => structuredClone(t));
    clone.motorcycle_conditions = state.motorcycle_conditions
      .filter((mc) => mc.motorcycle_id === row.id)
      .map((mc) => {
        const ct = state.condition_types.find((c) => c.id === mc.condition_type_id);
        return {
          ...structuredClone(mc),
          condition_types: ct ? { id: ct.id, name: ct.name } : null,
        };
      });
  }
  return clone;
}

export function createInMemorySupabaseClient(
  state: InMemoryReconciliationState,
  options: { failRpcMessage?: string; failBikeInsertForModel?: string } = {}
) {
  const makeUuid = () => crypto.randomUUID();

  function createQueryBuilder(table: keyof InMemoryReconciliationState) {
    let op: 'select' | 'insert' | 'update' | 'delete' = 'select';
    let countMode: string | undefined;
    let payloadData: any = null;
    const filters: Array<(row: any) => boolean> = [];
    let orderSpec: { col: string; ascending: boolean } | null = null;
    let rangeSpec: { from: number; to: number } | null = null;
    let limitCount: number | null = null;
    let expectSingle = false;
    let expectMaybeSingle = false;

    const execute = async () => {
      const tableRows = state[table] as any[];

      if (op === 'insert') {
        const items = Array.isArray(payloadData) ? payloadData : [payloadData];
        const inserted: any[] = [];
        for (const raw of items) {
          if (
            table === 'motorcycle_rentals' &&
            options.failBikeInsertForModel &&
            raw.model === options.failBikeInsertForModel
          ) {
            return { data: null, error: { message: `Simulated DB failure inserting ${raw.model}` } };
          }
          const now = new Date().toISOString();
          const record = {
            id: raw.id || makeUuid(),
            created_at: raw.created_at || now,
            updated_at: raw.updated_at || now,
            ...(table === 'change_proposals'
              ? {
                  version: 1,
                  coverage_status: 'unknown',
                  reconciliation_status: 'unknown',
                  application_status: 'pending',
                }
              : {}),
            ...(table === 'unresolved_candidates' ? { version: 1, flagged_for_review: false } : {}),
            ...(table === 'crawl_runs'
              ? { coverage_status: 'unknown', reconciliation_status: 'unknown', metadata: {} }
              : {}),
            ...structuredClone(raw),
          };
          tableRows.push(record);
          inserted.push(enrichRow(table, record, state));
        }
        const data = expectSingle || expectMaybeSingle ? inserted[0] ?? null : inserted;
        return { data, error: null, count: inserted.length };
      }

      const matched = tableRows.filter((row) => filters.every((fn) => fn(row)));

      if (op === 'delete') {
        const toRemove = new Set(matched.map((r) => r.id ?? r));
        state[table] = tableRows.filter((r) => !toRemove.has(r.id ?? r)) as any;
        return { data: matched, error: null, count: matched.length };
      }

      if (op === 'update') {
        const now = new Date().toISOString();
        const updated: any[] = [];
        for (const row of matched) {
          Object.assign(row, structuredClone(payloadData), { updated_at: now });
          updated.push(enrichRow(table, row, state));
        }
        if (expectSingle && updated.length === 0) {
          return { data: null, error: { message: 'No rows matched update', code: 'PGRST116' }, count: 0 };
        }
        const data = expectSingle || expectMaybeSingle ? updated[0] ?? null : updated;
        return { data, error: null, count: updated.length };
      }

      // select
      let rows = matched.map((r) => enrichRow(table, r, state));
      const totalCount = rows.length;
      if (orderSpec) {
        const { col, ascending } = orderSpec;
        rows.sort((a, b) => {
          const av = a[col] ?? '';
          const bv = b[col] ?? '';
          if (av < bv) return ascending ? -1 : 1;
          if (av > bv) return ascending ? 1 : -1;
          return 0;
        });
      }
      if (rangeSpec) {
        rows = rows.slice(rangeSpec.from, rangeSpec.to + 1);
      } else if (limitCount !== null) {
        rows = rows.slice(0, limitCount);
      }

      if (expectSingle) {
        if (rows.length === 0) {
          return { data: null, error: { message: 'Row not found', code: 'PGRST116' }, count: 0 };
        }
        return { data: rows[0], error: null, count: 1 };
      }
      if (expectMaybeSingle) {
        return { data: rows[0] ?? null, error: null, count: rows.length };
      }
      return {
        data: rows,
        error: null,
        count: countMode ? totalCount : undefined,
      };
    };

    const builder: any = {
      select(_cols?: string, opts?: { count?: string }) {
        if (op === 'select') {
          countMode = opts?.count;
        }
        return builder;
      },
      insert(data: any) {
        op = 'insert';
        payloadData = data;
        return builder;
      },
      update(data: any) {
        op = 'update';
        payloadData = data;
        return builder;
      },
      delete() {
        op = 'delete';
        return builder;
      },
      eq(col: string, val: any) {
        filters.push((r) => r[col] === val);
        return builder;
      },
      neq(col: string, val: any) {
        filters.push((r) => r[col] !== val);
        return builder;
      },
      in(col: string, vals: any[]) {
        const set = new Set(vals);
        filters.push((r) => set.has(r[col]));
        return builder;
      },
      ilike(col: string, pattern: string) {
        const norm = pattern.toLowerCase();
        filters.push((r) => String(r[col] ?? '').toLowerCase() === norm);
        return builder;
      },
      is(col: string, val: any) {
        filters.push((r) => (val === null ? r[col] === null || r[col] === undefined : r[col] === val));
        return builder;
      },
      not(col: string, operator: string, val: any) {
        if (operator === 'is' && val === null) {
          filters.push((r) => r[col] !== null && r[col] !== undefined);
        }
        return builder;
      },
      or(expr: string) {
        if (expr.includes('availability_status.neq.unavailable')) {
          filters.push((r) => !r.availability_status || r.availability_status !== 'unavailable');
        }
        return builder;
      },
      order(col: string, opts?: { ascending?: boolean }) {
        orderSpec = { col, ascending: opts?.ascending !== false };
        return builder;
      },
      range(from: number, to: number) {
        rangeSpec = { from, to };
        return builder;
      },
      limit(n: number) {
        limitCount = n;
        return builder;
      },
      single() {
        expectSingle = true;
        return execute();
      },
      maybeSingle() {
        expectMaybeSingle = true;
        return execute();
      },
      then(onFulfilled: any, onRejected: any) {
        return execute().then(onFulfilled, onRejected);
      },
    };

    return builder;
  }

  return {
    from(table: keyof InMemoryReconciliationState) {
      return createQueryBuilder(table);
    },
    async rpc(fnName: string, args: { p_payload: any }) {
      if (fnName !== 'stage_change_proposal_with_report') {
        return { data: null, error: { message: `Unknown RPC ${fnName}` } };
      }
      if (options.failRpcMessage) {
        return { data: null, error: { message: options.failRpcMessage } };
      }

      const snapshot = structuredClone(state);
      try {
        const p = args.p_payload;
        const existingProposal = state.change_proposals.find(
          (row) =>
            row.shop_id === p.shopId &&
            row.agent_run_id === p.agentRunId &&
            row.payload_digest !== null &&
            row.payload_digest !== undefined
        );

        if (existingProposal) {
          if (existingProposal.payload_digest === p.payloadDigest) {
            const existingReport = state.reconciliation_reports.find(
              (r) => r.proposal_id === existingProposal.id
            )!;
            return {
              data: {
                replayed: true,
                proposalId: existingProposal.id,
                proposalVersion: existingProposal.version,
                proposalStatus: existingProposal.status,
                coverageStatus: existingProposal.coverage_status,
                reconciliationStatus: existingProposal.reconciliation_status,
                applicationStatus: existingProposal.application_status,
                reportId: existingReport.id,
                reportVersion: existingReport.report_version,
                reportDigest: existingReport.report_digest,
                serverCounts: existingReport.server_counts,
              },
              error: null,
            };
          }
          return {
            data: null,
            error: {
              code: '23505',
              message: `IDEMPOTENCY_CONFLICT: Different payload already staged for shop ${p.shopId} and agentRunId ${p.agentRunId}`,
            },
          };
        }

        const now = new Date().toISOString();

        for (const supId of p.supersededProposalIds || []) {
          const oldProp = state.change_proposals.find(
            (row) => row.id === supId && row.shop_id === p.shopId && row.status === 'pending'
          );
          if (oldProp) {
            oldProp.status = 'superseded';
            oldProp.version = (oldProp.version || 1) + 1;
            oldProp.updated_at = now;
            state.proposal_decision_events.push({
              id: makeUuid(),
              proposal_id: oldProp.id,
              shop_id: oldProp.shop_id,
              decision: 'supersede',
              actor_id: null,
              proposal_version: oldProp.version,
              notes: `Superseded by newer agentRunId ${p.agentRunId}`,
              metadata: {},
              created_at: now,
            });
            for (const cand of state.unresolved_candidates) {
              if (
                cand.shop_id === p.shopId &&
                cand.state === 'ready_for_proposal' &&
                cand.latest_proposal_id === supId
              ) {
                cand.state = 'open';
                cand.linked_proposal_item_id = null;
                cand.version = (cand.version || 1) + 1;
                cand.updated_at = now;
                state.unresolved_candidate_events.push({
                  id: makeUuid(),
                  candidate_id: cand.id,
                  shop_id: p.shopId,
                  event_type: 'proposal_superseded',
                  actor_type: 'system',
                  actor_id: null,
                  agent_run_id: p.agentRunId,
                  proposal_id: supId,
                  previous_state: 'ready_for_proposal',
                  new_state: 'open',
                  reason: 'Linked pending proposal superseded before application',
                  issues_snapshot: null,
                  evidence_snapshot: null,
                  created_at: now,
                });
              }
            }
          }
        }

        const proposalId = makeUuid();
        state.change_proposals.push({
          id: proposalId,
          shop_id: p.shopId,
          agent_run_id: p.agentRunId,
          source_url: p.sourceUrl,
          raw_snapshot: structuredClone(p.rawSnapshot || {}),
          status: p.initialProposalStatus,
          coverage_status: p.coverageStatus,
          reconciliation_status: p.reconciliationStatus,
          application_status: p.applicationStatus,
          payload_digest: p.payloadDigest,
          summary_counts: structuredClone(p.summaryCounts),
          notes: null,
          reviewed_by: null,
          reviewed_at: null,
          applied_at: null,
          version: 1,
          created_at: now,
          updated_at: now,
        });

        const itemMap = new Map<string, string>();
        for (const item of p.items || []) {
          const itemId = makeUuid();
          state.change_proposal_items.push({
            id: itemId,
            proposal_id: proposalId,
            client_item_id: item.client_item_id || null,
            entity_type: item.entity_type,
            action: item.action,
            entity_id: item.entity_id || null,
            brand_name: item.brand_name || null,
            model_name: item.model_name || null,
            original_data: structuredClone(item.original_data ?? null),
            proposed_data: structuredClone(item.proposed_data ?? {}),
            diff_summary: structuredClone(item.diff_summary ?? null),
            status: item.status,
            created_at: now,
          });
          if (item.client_item_id) {
            itemMap.set(item.client_item_id, itemId);
          }
        }

        const candMap = new Map<string, string>();
        for (const op of p.candidateOps || []) {
          let candId: string;
          if (op.mode === 'insert') {
            candId = makeUuid();
            state.unresolved_candidates.push({
              id: candId,
              shop_id: p.shopId,
              identity_key: op.identityKey || null,
              brand_name: op.brandName,
              model_name: op.modelName,
              year: op.year ?? null,
              year_to: op.yearTo ?? null,
              variant_label: op.variantLabel || null,
              source_identity: structuredClone(op.sourceIdentity || {}),
              state: op.newState,
              flagged_for_review: Boolean(op.flaggedForReview),
              current_issues: structuredClone(op.issues || []),
              next_action: op.nextAction ?? null,
              latest_evidence: structuredClone(op.evidence || []),
              originating_run_id: p.agentRunId,
              originating_proposal_id: proposalId,
              latest_run_id: p.agentRunId,
              latest_proposal_id: proposalId,
              linked_proposal_item_id: op.linkedClientItemId
                ? itemMap.get(op.linkedClientItemId) || null
                : null,
              resolved_motorcycle_id: null,
              resolution_reason: null,
              version: 1,
              created_at: now,
              updated_at: now,
            });
          } else {
            candId = op.candidateId;
            const target = state.unresolved_candidates.find(
              (c) => c.id === candId && c.shop_id === p.shopId
            );
            if (!target) {
              throw new Error(`Candidate ${candId} not found for shop ${p.shopId}`);
            }
            target.state = op.newState;
            if (op.flaggedForReview !== undefined) {
              target.flagged_for_review = Boolean(op.flaggedForReview);
            }
            if (op.issues !== undefined && op.issues !== null) {
              target.current_issues = structuredClone(op.issues);
            }
            if (op.nextAction !== undefined && op.nextAction !== null) {
              target.next_action = op.nextAction;
            }
            if (op.evidence !== undefined && op.evidence !== null) {
              target.latest_evidence = structuredClone(op.evidence);
            }
            target.latest_run_id = p.agentRunId;
            target.latest_proposal_id = proposalId;
            if (op.linkedClientItemId) {
              target.linked_proposal_item_id = itemMap.get(op.linkedClientItemId) || null;
            } else if (op.clearLinkedItem) {
              target.linked_proposal_item_id = null;
            }
            target.version = (target.version || 1) + 1;
            target.updated_at = now;
          }

          if (op.entryKey) {
            candMap.set(op.entryKey, candId);
          }

          state.unresolved_candidate_events.push({
            id: makeUuid(),
            candidate_id: candId,
            shop_id: p.shopId,
            event_type: op.eventType,
            actor_type: 'agent',
            actor_id: null,
            agent_run_id: p.agentRunId,
            proposal_id: proposalId,
            previous_state: op.previousState || null,
            new_state: op.newState,
            reason: op.reason || null,
            issues_snapshot: structuredClone(op.issues ?? null),
            evidence_snapshot: structuredClone(op.evidence ?? null),
            created_at: now,
          });
        }

        const reportId = makeUuid();
        state.reconciliation_reports.push({
          id: reportId,
          proposal_id: proposalId,
          shop_id: p.shopId,
          agent_run_id: p.agentRunId,
          schema_version: 1,
          report_version: 1,
          report_digest: p.reportDigest,
          scope: structuredClone(p.scope),
          coverage: structuredClone(p.coverage),
          server_counts: structuredClone(p.serverCounts),
          raw_report: structuredClone(p.rawReport),
          created_at: now,
        });

        for (const entry of p.entries || []) {
          const entryId = makeUuid();
          state.reconciliation_report_entries.push({
            id: entryId,
            report_id: reportId,
            proposal_id: proposalId,
            entry_index: entry.entryIndex,
            entry_key: entry.entryKey,
            brand_name: entry.brandName,
            model_name: entry.modelName,
            existing_motorcycle_id: entry.existingMotorcycleId || null,
            candidate_id: entry.candidateId || candMap.get(entry.entryKey) || null,
            disposition: entry.disposition,
            compared_attributes: structuredClone(entry.comparedAttributes ?? null),
            issues: structuredClone(entry.issues ?? null),
            next_action: entry.nextAction || null,
            reason: entry.reason || null,
            duplicate_of_entry_key: entry.duplicateOfEntryKey || null,
            duplicate_of_motorcycle_id: entry.duplicateOfMotorcycleId || null,
            evidence: structuredClone(entry.evidence || []),
            created_at: now,
          });

          for (const refClientId of entry.proposalItemRefs || []) {
            const targetItemId = itemMap.get(refClientId);
            if (!targetItemId) {
              throw new Error(`Missing item link for clientItemId ${refClientId}`);
            }
            state.reconciliation_entry_item_links.push({
              entry_id: entryId,
              proposal_item_id: targetItemId,
              client_item_id: refClientId,
              created_at: now,
            });
          }
        }

        if (p.learnedConfig && typeof p.learnedConfig === 'object') {
          const cfg = state.shop_agent_configs.find((c) => c.shop_id === p.shopId);
          if (cfg) {
            if (p.learnedConfig.extractionHints) {
              cfg.extraction_hints = p.learnedConfig.extractionHints;
            }
            if (p.learnedConfig.discoveredSourceUrl) {
              cfg.source_url = p.learnedConfig.discoveredSourceUrl;
            }
          }
        }

        return {
          data: {
            replayed: false,
            proposalId,
            proposalVersion: 1,
            proposalStatus: p.initialProposalStatus,
            coverageStatus: p.coverageStatus,
            reconciliationStatus: p.reconciliationStatus,
            applicationStatus: p.applicationStatus,
            reportId,
            reportVersion: 1,
            reportDigest: p.reportDigest,
            serverCounts: p.serverCounts,
          },
          error: null,
        };
      } catch (err: any) {
        Object.assign(state, snapshot);
        return { data: null, error: { message: err.message } };
      }
    },
  };
}
