# Spec: Agent API Proposal Enumeration & Narrow Pending Proposal Rejection (`#217`)

- **Issue**: [#217](https://github.com/MickRheault/rv2/issues/217)
- **ADR**: `docs/adr/0019-narrow-agent-proposal-listing-and-rejection.md`
- **Date**: 2026-11-11

---

## 1. Objective & Scope Boundary

Enable an ingestion agent authenticated via `Authorization: Bearer <AGENT_API_KEY>` to:
1. Enumerate all pending (or status-filtered) Change Proposals with deterministic pagination and exact total counts (`GET /api/agent/change-proposals`).
2. Reject a specified `pending` Change Proposal with optimistic `expectedVersion` checking and a mandatory recorded reason (`POST /api/agent/change-proposals/[id]/reject`).
3. Read back the resulting `rejected` status, incremented `version`, recorded `notes`/`reviewedAt`, item statuses, and audited `decisionEvents[]` (`GET /api/agent/change-proposals/[id]`).

### Non-Goals & Security Boundaries
- **Do NOT** weaken `/api/admin/*` session/RBAC checks (`isAuthorizedAdmin`).
- **Do NOT** expose `ChangeProposalService.apply` or any inventory approval/mutation capability on `/api/agent/*`.
- **Do NOT** mutate `motorcycle_rentals`, `rental_offers`, `rental_rate_tiers`, `motorcycle_conditions`, `rental_shops`, `rental_shop_inclusions`, `rental_shop_conditions`, `shop_agent_configs`, or `crawl_runs` during rejection.
- **Do NOT** delete proposal history, roll back already-applied proposals, or alter admin `unresolved_candidates` decisions (`dismissed`, `excluded`, `resolved_applied`).
- **Do NOT** persist API keys, bearer tokens, or secret material in database rows, `metadata`, or logs.

---

## 2. API Contracts

### 2.1 `GET /api/agent/change-proposals` — Paginated Proposal Listing

- **Authentication**: `Authorization: Bearer <AGENT_API_KEY>` (`validateAgentApiKey`). Missing or invalid header returns `401 Unauthorized`.
- **Query Parameters**:
  - `status` (optional string, default `'pending'`): one of `'pending' | 'reviewing' | 'applied' | 'partially_applied' | 'rejected' | 'acknowledged' | 'superseded' | 'all'`. Invalid values return `400 Bad Request`.
  - `shopId` (optional UUID string): filters proposals to a single shop. Malformed UUID returns `400 Bad Request`.
  - `limit` (optional integer string, default `50`): integer in `1..100`. Non-integer or out-of-range returns `400 Bad Request`.
  - `offset` (optional integer string, default `0`): integer in `0..100000`. Non-integer or out-of-range returns `400 Bad Request`.
- **Ordering**: Deterministic `created_at DESC, id ASC` so ties in `created_at` never skip or duplicate rows across pages.
- **Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "proposals": [
      {
        "id": "eb7f9890-98bf-4d3e-9837-59b7749de130",
        "shopId": "53529565-40d9-41f5-98e4-d2ed1f1d7ffd",
        "shopName": "Ride On - Alquiler moto Barcelona",
        "shopSlug": "ride-on-alquiler-moto-barcelona",
        "shopUrl": "/shop/spain/barcelona/ride-on-alquiler-moto-barcelona",
        "agentRunId": "rideon-bcn-2026-11-02-r1",
        "sourceUrl": "https://rideon.es/flota/",
        "status": "pending",
        "coverageStatus": "complete",
        "reconciliationStatus": "complete",
        "applicationStatus": "pending",
        "version": 1,
        "summaryCounts": { "add": 1, "update": 2, "delist": 0 },
        "serverCounts": null,
        "hasReconciliationReport": true,
        "createdAt": "2026-11-02T10:00:00.000Z",
        "reviewedAt": null
      }
    ],
    "totalCount": 1,
    "limit": 50,
    "offset": 0,
    "hasMore": false,
    "nextOffset": null
  }
  ```
  Where `hasMore = offset + proposals.length < totalCount` and `nextOffset = hasMore ? offset + proposals.length : null`.

---

### 2.2 `POST /api/agent/change-proposals/[id]/reject` — Narrow Pending Proposal Rejection

- **Authentication**: `Authorization: Bearer <AGENT_API_KEY>` (`validateAgentApiKey`). Missing or invalid header returns `401 Unauthorized`.
- **Payload Bound**: Raw UTF-8 body exceeding `MAX_STATUS_PAYLOAD_BYTES` (`65,536` bytes / `64 KB`) returns `413 Payload Too Large`. Malformed JSON or non-object body returns `400 Bad Request`.
- **Path Parameter**:
  - `id`: required valid UUID (`400 Bad Request` if malformed UUID; `404 Not Found` if proposal does not exist).
- **Request Body**:
  ```json
  {
    "expectedVersion": 1,
    "reason": "Owner requested cancellation of outstanding proposals; rebuild with native rental pricing."
  }
  ```
  - `expectedVersion` (**required**): positive integer (`>= 1`). Missing, non-integer, or `< 1` returns `400 Bad Request`.
  - `reason` (**required**, or `notes` as an alias): non-empty string after trimming, `<= 4000` characters (`MAX_TEXT_FIELD_LENGTH`). If both `reason` and `notes` are supplied and differ after trimming, returns `400 Bad Request`.
  - `approvedItemIds` / approval fields: if `approvedItemIds` is present in the body, reject with `400 Bad Request` (`"The agent rejection endpoint cannot approve or select items; omit approvedItemIds."`).
- **State & Version Semantics (`409 Conflict` on Stale / Non-Pending / Repeated Retry)**:
  - Only proposals currently in `status === 'pending'` may be rejected.
  - If `proposal.status !== 'pending'` (e.g., `'applied'`, `'partially_applied'`, `'acknowledged'`, `'superseded'`, `'reviewing'`, or already `'rejected'` on a repeated call), return **`409 Conflict`** with `{ error, currentStatus, currentVersion }` without mutating any row or appending duplicate decision events.
  - If `(proposal.version ?? 1) !== expectedVersion`, return **`409 Conflict`** with `{ error, currentStatus, currentVersion }`.
  - Acquire optimistic CAS claim (`UPDATE change_proposals SET status = 'reviewing' WHERE id = :id AND status = 'pending' AND version = :expectedVersion`) before mutating child items so concurrent admin `apply` / `acknowledge` calls and agent `reject` calls are mutually exclusive. If the CAS claim matches 0 rows, return **`409 Conflict`**.
- **Rejection Mutation & Audit Semantics**:
  1. Mark pending actionable `change_proposal_items` (`add`, `update`, `delist` with `!status || status === 'pending'`) as `status = 'rejected'`. Informational `unchanged` items are left untouched.
  2. For any `unresolved_candidates` in `state === 'ready_for_proposal'` linked to a rejected item of this proposal (or `latest_proposal_id === proposalId`), transition back to `state = 'open'` (`linked_proposal_item_id = null`, `version = version + 1`) and append an `unresolved_candidate_events` record with `event_type = 'proposal_rejected'`, `actor_type = 'agent'`, `actor_id = null`, `previous_state = 'ready_for_proposal'`, `new_state = 'open'`, and `reason`. Candidates in `'dismissed'`, `'excluded'`, `'resolved_applied'`, or `'open'` are untouched.
  3. Recompute `reconciliation_status` for reconciliation-backed proposals (`'unresolved'` if rejected actionable items or open candidates remain; `'complete'` otherwise when coverage was complete).
  4. Finalize `change_proposals` via CAS (`status = 'reviewing' AND version = currentVersion`):
     - `status = 'rejected'`
     - `application_status = isReportOnly ? 'not_applicable' : 'rejected'`
     - `reviewed_at = nowIso`
     - `reviewed_by = null`
     - `notes = normalizedReason`
     - `version = currentVersion + 1`
     *(Does not set `applied_at`.)*
  5. Append an auditable row to `proposal_decision_events`:
     - `proposal_id = proposalId`
     - `shop_id = proposal.shop_id`
     - `decision = 'reject'`
     - `actor_id = null`
     - `proposal_version = nextVersion`
     - `notes = normalizedReason`
     - `metadata = { actorType: 'agent', authMethod: 'agent_api_key', rejectedItemCount }`
  6. If an unexpected database error occurs mid-rejection after claiming `'reviewing'`, roll back item/candidate status changes best-effort and restore `change_proposals.status = 'pending'` so the proposal is not stranded in `'reviewing'`.
- **Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "proposalId": "eb7f9890-98bf-4d3e-9837-59b7749de130",
    "status": "rejected",
    "version": 2,
    "coverageStatus": "complete",
    "reconciliationStatus": "unresolved",
    "applicationStatus": "rejected",
    "rejectedItemCount": 3,
    "reviewedAt": "2026-11-11T10:30:00.000Z",
    "notes": "Owner requested cancellation of outstanding proposals; rebuild with native rental pricing."
  }
  ```

---

### 2.3 `GET /api/agent/change-proposals/[id]` — Proposal & Decision History Readback

- Extends `ChangeProposalService.getAgentProposalReadback` to also expose top-level `reviewedAt` (`string | null`) and `notes` (`string | null`) alongside `status`, `version`, `coverageStatus`, `reconciliationStatus`, `applicationStatus`, `items[].status`, and `decisionEvents[]`.

---

## 3. Acceptance Criteria Verification Mapping

1. Agent auth enumerates complete pending set across pages with `totalCount`, `limit`, `offset`, `hasMore`, `nextOffset`, and deterministic ordering.
2. Agent auth rejects a pending proposal; it disappears from `status=pending` (Pending Review) and appears in `status=rejected` history.
3. Missing or invalid `Bearer <AGENT_API_KEY>` returns `401 Unauthorized` on both routes.
4. Rejection route cannot approve/apply items (`approvedItemIds` rejected with `400`; live `motorcycle_rentals`, `rental_offers`, `rental_shops` never touched).
5. Stale `expectedVersion` or non-`pending` status (`applied`, `partially_applied`, `acknowledged`, `superseded`, `reviewing`) returns `409 Conflict` with `currentStatus` and `currentVersion`.
6. Repeated rejection retry returns `409 Conflict` (`currentStatus: 'rejected'`, `currentVersion`) without duplicating `proposal_decision_events` or mutating items.
7. Rejection reason and `{ actorType: 'agent', authMethod: 'agent_api_key', rejectedItemCount }` audit metadata are persisted without storing any secret/token values.
8. `GET /api/agent/change-proposals/[id]` readback confirms `status: 'rejected'`, incremented `version`, `notes`, `reviewedAt`, rejected `items[].status`, and `decisionEvents[]`.
9. Applied proposals, historical proposals, `dismissed`/`excluded`/`resolved_applied` unresolved-candidate decisions, `shop_agent_configs`, and `crawl_runs` remain completely untouched.
