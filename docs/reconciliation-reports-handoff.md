# Reconciliation Reports & Unresolved Candidates — API & Operations Handoff

Related design artifacts:
- Spec: [2026-10-31-reconciliation-reports-change-proposals-spec.md](./specs/2026-10-31-reconciliation-reports-change-proposals-spec.md) (Issue [#201](https://github.com/MickRheault/rv2/issues/201))
- Architecture Decision Record: [ADR 0017: Reconciliation Reports, Unresolved Candidates, and Staged-vs-Completed Crawl Separation](./adr/0017-reconciliation-reports-and-unresolved-candidates.md)

---

## 1. Overview & Privacy Boundary

Complete Reconciliation Reports (`reconciliationReport.schemaVersion = 1`) let automated ingestion agents submit a shop's full inventory accounting inside a Change Proposal—even when `items` is empty (`[]`)—without fabricating placeholder rates or hiding unresolved motorcycles inside `shop_agent_configs.extraction_hints`.

**Strict Privacy Rule**: Reconciliation Reports, Reconciliation Entries, Unresolved Candidates, and audit events are private administrative records. Database tables enforce RLS (`public.is_admin()` only, zero `anon` policies), external source text is rendered strictly as escaped plain text, external URLs are restricted to `http:` / `https:` schemes without server-side fetching, and public shop/motorcycle pages, `/api/v1/*`, AI chat, and MCP tools expose zero report or candidate fields.

---

## 2. Supported Routes

### Agent Endpoints (`Authorization: Bearer <AGENT_API_KEY>`)

| Method & Path | Purpose |
| --- | --- |
| `POST /api/agent/change-proposals` | Stage a Change Proposal with actionable `items[]` (`add`, `update`, `delist`) and an optional `reconciliationReport` (`schemaVersion: 1`), or legacy reportless `items[]`. Returns `201` on creation, `200` on identical `(shopId, agentRunId)` replay, `409` on divergent replay, `413` if raw body exceeds `2 MB`, and `400` on validation errors. |
| `GET /api/agent/change-proposals/:id` | Read back a persisted Change Proposal, its `reconciliationReport`, server-derived counts, `reportDigest`, independent status dimensions, item links, shop `unresolvedCandidates`, and paginated `entries` (`?entriesLimit=1..200&entriesOffset=0..100000`, default `limit = 100`). |
| `GET /api/agent/tasks` | Fetch due shop crawl tasks enriched with baseline inventory, shop profile, and paginated prior `unresolvedCandidates` (`?candidatesLimit=1..200&candidatesOffset=0..100000`, default `limit = 50`; optional `?shopId=<uuid>&limit=1..50&minUrgency=<num>`). Excludes `resolved_applied` candidates and never writes candidate backlogs into `extractionHints`. |
| `POST /api/agent/tasks/:id/status` | Record crawl completion (`status: 'success' \| 'partial' \| 'failed'`), advance `shop_agent_configs.last_run_at` across all outcomes so partial/failed crawls consume their scheduled slot without infinite retries, and upsert a single `crawl_runs` row per `(shop_id, agent_run_id)` linked to any staged proposal's `proposal_id`, `coverage_status`, and `reconciliation_status`. Returns `409` if explicit `coverageStatus: 'complete'` or `reconciliationStatus: 'complete'` contradicts the linked report. |

### Admin Endpoints (Authenticated Admin Session)

| Method & Path | Purpose |
| --- | --- |
| `GET /api/admin/change-proposals` | List Change Proposals filtered by `status` (`all \| pending \| acknowledged \| applied \| partially_applied \| rejected \| superseded`), exposing `coverageStatus`, `reconciliationStatus`, `applicationStatus`, `version`, `summaryCounts`, and `serverCounts`. |
| `GET /api/admin/change-proposals/:id` | Fetch full Change Proposal detail: actionable/legacy items hydrated with live `baseline_data`, `report`, paginated `entries` (`?entriesLimit=1..200&entriesOffset=0..100000`) hydrated with live baseline specs/rates on `unchanged` entries, `itemLinks`, shop `unresolvedCandidates`, `candidateEvents`, and `decisionEvents`. |
| `POST /api/admin/change-proposals/:id/apply` | Approve/reject actionable `items[]` (`{ approvedItemIds, expectedVersion, notes? }`) or acknowledge a report-only proposal (`{ action: 'acknowledge', expectedVersion, notes? }`). Enforces positive-integer `expectedVersion` (`400` if missing/invalid, `409` on version conflict) and full apply-time revalidation (`shop_id` ownership, positive integer-day rate tiers + currency, category/condition catalogs, geodata immutability, and `original_data` concurrency). Never executes report entries. |
| `PATCH /api/admin/unresolved-candidates/:id` | Admin candidate decision (`{ action: 'dismiss' \| 'exclude' \| 'reopen', reason, expectedVersion }`). Requires non-empty `reason` for `dismiss`/`exclude` and positive-integer `expectedVersion` (`409` on conflict), records an append-only `unresolved_candidate_events` entry, and recomputes the shop's latest non-superseded report proposal `reconciliation_status` when applicable. |
| `GET /api/admin/crawler-logs` | List `crawl_runs` filtered by `?status=all\|success\|partial\|failed` and `?shopId=<uuid>`, returning `status`, `coverageStatus`, `reconciliationStatus`, `proposalId`, and `proposalSummaryCounts`. |

---

## 3. Orthogonal Status Dimensions & Candidate Lifecycle

### 3.1 Change Proposal Status Dimensions

1. **`status` (`proposal_status` — Review Queue Lifecycle)**:
   - `pending`: Needs reviewer action (actionable items awaiting approval, OR report-only submission with `partial`/`failed` coverage or `unresolved` reconciliation).
   - `reviewing`: Transient atomic CAS lock held while `apply` executes.
   - `applied`: All actionable items applied (`application_status = 'applied'`).
   - `partially_applied`: Subset of actionable items applied (`application_status = 'partially_applied'`).
   - `rejected`: Proposal rejected (`application_status = 'rejected'` or `'not_applicable'` for report-only).
   - `acknowledged`: Report-only proposal (`items: []`, `application_status = 'not_applicable'`) reviewed and acknowledged—or auto-acknowledged at staging when `coverage_status = 'complete'` and `reconciliation_status = 'complete'`. Never described as `"inventory updated"`.
   - `superseded`: Prior `pending` proposal automatically replaced when a newer `agentRunId` stages a report for the same `(shopId, scope.branch, scope.catalogType, scope.services)`.
2. **`coverage_status`**: `'complete' | 'partial' | 'failed' | 'unknown'` (`'unknown'` only for legacy reportless proposals).
   - `coverage.status = 'complete'` is rejected (`400`) if `coverage.discoveryComplete !== true` or any required page (`role` in `'catalog' | 'pricing'` defaults `required: true`) has `status !== 'processed'`.
3. **`reconciliation_status`**: `'complete' | 'unresolved' | 'unknown'`.
   - `'complete'` iff `coverage_status === 'complete'`, `discoveryComplete === true`, zero report entries have `disposition === 'unresolved'`, zero shop `unresolved_candidates` remain in `open` or unapplied `ready_for_proposal` state, zero mutable items on the proposal were rejected, and every active GMR baseline motorcycle for the shop is accounted for.
4. **`application_status`**: `'pending' | 'not_applicable' | 'applied' | 'partially_applied' | 'failed' | 'rejected'`.

### 3.2 Unresolved Candidate State Machine

- **`open`**: Active unresolved blocker returned in `GET /api/agent/tasks`. Remains `open` across proposal acknowledgments, rejections, supersedings, partial-crawl absences, and mixed-proposal approvals. On a `complete` catalog run where a prior `open` candidate is absent from `entries[]`, the server records a `complete_catalog_absence` audit event and keeps the candidate `open` until explicitly dispositioned.
- **`ready_for_proposal`**: Set when a follow-up run stages a `ready_change` `add` item linked to the candidate (by explicit `candidateId` or unambiguous `(shop_id, normalized_brand, normalized_model, year, year_to, normalized_variant)` key). Reverts to `open` if the proposal is superseded, the item is rejected, or `apply` fails.
- **`resolved_applied`**: Terminal resolved state reached when the linked `add` item is applied in `POST /api/admin/change-proposals/:id/apply`, recording `resolved_motorcycle_id`. Omitted from future `GET /api/agent/tasks` candidate backlogs.
- **`dismissed`**: Set by an admin with mandatory `reason`. Agents cannot overwrite `dismissed` back to `open`; if a later crawl observes divergent issues or evidence on a `dismissed` candidate, `state` stays `'dismissed'` and `flagged_for_review` becomes `true`.
- **`excluded`**: Set by an admin with mandatory `reason` (or re-observed without silent overwrite). Can be reopened by an admin via `action: 'reopen'`.

---

## 4. Canonical Digest & Idempotency Rules

- **Canonical JSON Serialization (RFC-8785 Compatible)**:
  - Objects serialize keys in deterministic UTF-8 code-unit lexicographical order recursively; arrays preserve element order; strings use standard JSON escaping.
  - `reportDigest` = `'sha256:' + hex(SHA-256(canonicalJson(normalizedReconciliationReport)))`.
  - `payloadDigest` = `'sha256:' + hex(SHA-256(canonicalJson({ shopId, sourceUrl, items, reportDigest, learnedConfig })))`.
- **Semantic Idempotency on `(shopId, agentRunId)`**:
  - Staging a new-format proposal with the same `(shopId, agentRunId)` and identical `payloadDigest` returns HTTP `200` (`replayed: true`) with the original `proposalId`, `reportId`, `reportDigest`, `serverCounts`, and statuses without duplicating items, candidates, or events.
  - Staging a different payload under an existing `(shopId, agentRunId)` returns HTTP `409 Conflict`.

---

## 5. Payload, Field, URL & Pagination Limits

| Bound | Limit | Failure Response |
| --- | --- | --- |
| Raw request body (`POST /api/agent/change-proposals`) | `<= 2,097,152` bytes (`2 MB`) | `413 Payload Too Large` (never silently truncated) |
| `items[]` length | `<= 500` | `400 Bad Request` |
| `reconciliationReport.entries[]` length | `<= 1,000` | `400 Bad Request` |
| `reconciliationReport.coverage.pages[]` length | `<= 500` | `400 Bad Request` |
| `entry.evidence[]` length | `<= 20` per entry (`>= 1` required) | `400 Bad Request` |
| `entry.issues[]` length | `<= 20` per `unresolved` entry (`>= 1` required) | `400 Bad Request` |
| Text fields (`snippet`, `observation`, `detail`, `reason`, `nextAction`, `limitations[]`, `extractionHints`) | `<= 4,000` chars | `400 Bad Request` |
| URLs (`sourceUrl`, `page.url`, `evidence.sourceUrl`, `evidence.linkedUrl`, `discoveredSourceUrl`) | `<= 2,048` chars, strictly `http:` or `https:` | `400 Bad Request` |
| `entriesLimit` (`GET .../change-proposals/:id`) | `1..200` (default `100`), `entriesOffset` `0..100000` | `400 Bad Request` |
| `candidatesLimit` (`GET /api/agent/tasks`) | `1..200` (default `50`), `candidatesOffset` `0..100000` | `400 Bad Request` |

Supported `schemaVersion: 1` issue codes (unknown codes fail with `400`):
`PRICE_UNVERIFIED`, `BRANCH_CONFLICT`, `SOURCE_ACCESS_FAILED`, `PRICING_NOT_REPRESENTABLE`, `IDENTITY_UNRESOLVED`, `TAXONOMY_UNRESOLVED`, `REQUIRED_FIELD_UNVERIFIED`, `OTHER`.

---

## 6. Legacy Compatibility & Known Limitations

- **Legacy Callers (`reconciliationReport` omitted)**:
  - Continue working unchanged: non-empty `items[]` (including legacy `action: 'unchanged'`) stage with `coverage_status = 'unknown'` and `reconciliation_status = 'unknown'`, and preserve legacy `last_run_at` / `crawl_runs` side effects. Empty `items: []` without a valid `reconciliationReport` remains invalid (`400`).
- **New-Format Callers (`reconciliationReport.schemaVersion = 1`)**:
  - Must provide non-empty `agentRunId`.
  - `items[]` may be `[]` (report-only) or contain actionable mutations (`add`, `update`, `delist`) only; `action: 'unchanged'` inside `items[]` is rejected (`400`) in favor of `reconciliationReport.entries[]` with `disposition: 'unchanged'`.
  - Source-absence `delist` items require `coverage.status = 'complete'` and `coverage.discoveryComplete = true` plus a `ready_change` entry with `source_absence` evidence.
  - Agents must call `POST /api/agent/tasks/:id/status` when the crawl finishes so `last_run_at` and `crawl_runs` are updated for the `(shopId, agentRunId)` run.
- **Known Limitations**:
  - `"Price on request"` listings are intentionally never published as public motorcycles; every motorcycle `add` (and any `update` supplying `rates`) requires verified positive integer-day rate tiers (`ratePerDay > 0`) and explicit `currency`.
  - `availabilityBasis` in `schemaVersion: 1` is strictly `'supplier_catalog_not_live_stock'`; catalog reconciliation never represents date-specific booking stock.

---

## 7. Concrete Examples: Ride On Barcelona (`53529565-40d9-41f5-98e4-d2ed1f1d7ffd`)

### 7.1 Stage Report-Only Crawl With Unresolved BMW R 1250 GS

`POST /api/agent/change-proposals`

```json
{
  "shopId": "53529565-40d9-41f5-98e4-d2ed1f1d7ffd",
  "sourceUrl": "https://rideon.es/flota/",
  "agentRunId": "rideon-bcn-2026-11-01-r1",
  "items": [],
  "reconciliationReport": {
    "schemaVersion": 1,
    "scope": {
      "branch": "Barcelona",
      "catalogType": "branch",
      "services": ["daily_rental"],
      "availabilityBasis": "supplier_catalog_not_live_stock"
    },
    "coverage": {
      "status": "partial",
      "discoveryComplete": false,
      "limitations": [
        "BMW R 1250 GS card displays BARCELONA badge but links to https://rideon.es/madrid/ without verified Barcelona daily rates."
      ],
      "pages": [
        {
          "url": "https://rideon.es/flota/",
          "role": "catalog",
          "required": true,
          "status": "processed"
        },
        {
          "url": "https://rideon.es/madrid/",
          "role": "pricing",
          "required": true,
          "status": "not_processed",
          "reason": "Cross-branch Madrid URL conflicts with Barcelona label"
        }
      ]
    },
    "entries": [
      {
        "entryKey": "honda-pcx-125",
        "brand": "Honda",
        "model": "PCX 125",
        "existingMotorcycleId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        "disposition": "unchanged",
        "proposalItemRefs": [],
        "comparedAttributes": ["rates", "year", "engineCapacityCc", "conditions"],
        "evidence": [
          {
            "sourceUrl": "https://rideon.es/flota/",
            "kind": "structured_observation",
            "observation": "Honda PCX 125cc: 1-3d EUR 35/day, 4+d EUR 29/day, EUR 300 deposit"
          }
        ]
      },
      {
        "entryKey": "bmw-r-1250-gs",
        "brand": "BMW",
        "model": "R 1250 GS",
        "existingMotorcycleId": null,
        "disposition": "unresolved",
        "proposalItemRefs": [],
        "issues": [
          {
            "code": "PRICE_UNVERIFIED",
            "detail": "Rental price not verified."
          },
          {
            "code": "BRANCH_CONFLICT",
            "detail": "Displayed Barcelona label links to Madrid."
          }
        ],
        "nextAction": "Resolve branch conflict and obtain verified pricing before proposing an addition.",
        "evidence": [
          {
            "sourceUrl": "https://rideon.es/flota/",
            "linkedUrl": "https://rideon.es/madrid/",
            "kind": "card_text",
            "snippet": "BMW R 1250 GS — BARCELONA"
          }
        ]
      }
    ]
  }
}
```

Response (`201 Created`):

```json
{
  "success": true,
  "replayed": false,
  "proposalId": "d92f8b14-6c10-4b4f-9f0c-54a83d2e1101",
  "proposalVersion": 1,
  "status": "pending",
  "coverageStatus": "partial",
  "reconciliationStatus": "unresolved",
  "applicationStatus": "not_applicable",
  "reportId": "7a811e0c-2299-4d40-98a0-1c82b6f10002",
  "reportVersion": 1,
  "reportDigest": "sha256:6b8c4e...",
  "itemsCount": 0,
  "summaryCounts": {
    "add": 0,
    "update": 0,
    "delist": 0,
    "unchanged": 1,
    "unresolved": 1,
    "excluded": 0,
    "duplicate": 0
  },
  "serverCounts": {
    "readyActionableItems": 0,
    "accountedDiscoveredModels": 2,
    "unresolvedModels": 1,
    "unchangedModels": 1,
    "excludedModels": 0,
    "duplicateModels": 0,
    "pagesProcessed": 1,
    "pagesFailed": 0,
    "pagesNotProcessed": 1,
    "add": 0,
    "update": 0,
    "delist": 0
  }
}
```

### 7.2 Complete Crawl Slot Bookkeeping

`POST /api/agent/tasks/task-rideon-1/status`

```json
{
  "status": "partial",
  "agentRunId": "rideon-bcn-2026-11-01-r1",
  "metadata": {
    "pagesVisited": 1
  }
}
```

Response (`200 OK`):

```json
{
  "success": true,
  "status": "partial",
  "coverageStatus": "partial",
  "reconciliationStatus": "unresolved",
  "crawlRun": {
    "id": "b1920c31-9e12-4331-81a9-7a0091ee0012",
    "shop_id": "53529565-40d9-41f5-98e4-d2ed1f1d7ffd",
    "proposal_id": "d92f8b14-6c10-4b4f-9f0c-54a83d2e1101",
    "agent_run_id": "rideon-bcn-2026-11-01-r1",
    "status": "partial",
    "coverage_status": "partial",
    "reconciliation_status": "unresolved"
  }
}
```

### 7.3 Subsequent Agent Task Readback (`GET /api/agent/tasks?shopId=53529565-40d9-41f5-98e4-d2ed1f1d7ffd`)

```json
{
  "success": true,
  "count": 1,
  "tasks": [
    {
      "taskId": "task-rideon-1",
      "shopId": "53529565-40d9-41f5-98e4-d2ed1f1d7ffd",
      "providerName": "Ride On - Alquiler moto Barcelona",
      "targetUrl": "https://rideon.es/flota/",
      "extractionHints": "Initial hints",
      "unresolvedCandidates": {
        "items": [
          {
            "candidateId": "3f41a9e0-88d1-4a7b-92c4-0b1e2d3c4f5a",
            "identityKey": "bmw|r 1250 gs|||",
            "brand": "BMW",
            "model": "R 1250 GS",
            "year": null,
            "year_to": null,
            "variantLabel": null,
            "state": "open",
            "flaggedForReview": false,
            "currentIssues": [
              { "code": "PRICE_UNVERIFIED", "detail": "Rental price not verified." },
              { "code": "BRANCH_CONFLICT", "detail": "Displayed Barcelona label links to Madrid." }
            ],
            "nextAction": "Resolve branch conflict and obtain verified pricing before proposing an addition.",
            "resolutionReason": null,
            "originatingRunId": "rideon-bcn-2026-11-01-r1",
            "latestRunId": "rideon-bcn-2026-11-01-r1"
          }
        ],
        "total": 1,
        "limit": 50,
        "offset": 0,
        "hasMore": false,
        "nextOffset": null
      }
    }
  ]
}
```
