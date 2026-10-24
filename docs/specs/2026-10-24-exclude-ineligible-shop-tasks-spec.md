# Spec: Exclude Non-Eligible Business Status Shops from Agent Task Scheduling (#194)

## Problem Statement

`GET /api/agent/tasks` currently returns due ingestion tasks for rental shops that are hidden from public Global Moto Rentals (GMR) and MCP read endpoints because of their business status. For example, **Mr. Scooter Rentals Bangkok** (`cca7fb21-743c-4ba8-beaa-be07ae92ef07`) has business status `Inactive` and is excluded from public and MCP shop reads, yet `GET /api/agent/tasks?shopId=cca7fb21-743c-4ba8-beaa-be07ae92ef07` still returns one task. This causes external ingestion agents to spend crawl budget and propose updates for inactive or closed businesses, and allows excluded shops to consume queue `limit` slots and inflate response counts.

## Solution

Enforce a read-time shop business status eligibility filter on `GET /api/agent/tasks` (`TaskSchedulerService.getDueTasks`) that reuses a shared public shop visibility helper (`Operational` or `Active`, including supported case variants). Exclude shops with `Inactive`, `Temporarily Closed`, `Permanently Closed`, missing, or any other non-eligible business status across the normal task queue, explicit `shopId` requests, and all tier, priority, and Urgency Score scheduling paths before pagination, limits, and response counts are calculated, while preserving existing Shop Agent Config records and crawl history so tasks automatically become eligible again if a shop's status is restored to `Operational` or `Active`.

## User Stories

1. As an external ingestion agent polling `GET /api/agent/tasks`, I want only tasks for rental shops with an eligible public business status (`Operational` or `Active`, including case variants) to be returned, so that I do not waste crawl budget on hidden or closed shops.
2. As an external ingestion agent requesting a specific shop via `GET /api/agent/tasks?shopId=<uuid>`, I want a request for an `Inactive`, `Temporarily Closed`, `Permanently Closed`, or missing-status shop (such as Mr. Scooter Rentals Bangkok `cca7fb21-743c-4ba8-beaa-be07ae92ef07`) to return HTTP `200` with `{ success: true, count: 0, tasks: [] }`, so that targeted runs respect the same eligibility rule without breaking the API contract.
3. As an external ingestion agent polling the task queue with a `limit` parameter, I want non-eligible shops to be filtered out before Urgency Score sorting and limit slicing, so that excluded shops never consume queue capacity or inflate `count`.
4. As a platform administrator temporarily disabling or closing a rental shop, I want the shop's Shop Agent Config (`tier`, `source_url`, `extraction_hints`, `is_active`, `last_run_at`, `consecutive_errors`) and crawl history to remain intact, so that no learned extraction hints or scheduling metadata are lost.
5. As a platform administrator restoring a rental shop's business status back to `Operational` or `Active`, I want its ingestion task to automatically become eligible again on subsequent `GET /api/agent/tasks` reads without needing to recreate or reconfigure its Shop Agent Config.
6. As a maintainer of the GMR platform, I want public shop visibility and agent task scheduling to share a single business status eligibility helper rather than duplicating status code lists across services.

## Implementation Decisions

- **Shared Business Status Eligibility Helper**:
  - Expand `ACTIVE_BUSINESS_STATUSES` in the shop service module to include `'Operational'` and `'Active'` alongside `'OPERATIONAL'`, `'operational'`, `'active'`, and `'ACTIVE'`.
  - Export shared helpers (`isActiveBusinessStatusCode`, `extractShopBusinessStatusCode`, `isShopBusinessStatusActive`) that evaluate a status code string or a shop record (with joined `business_statuses` or `business_status_id`) case-insensitively against the active business status set (`operational` / `active`), returning `false` for `Inactive`, `Temporarily Closed`, `Permanently Closed`, missing/null statuses, or any other non-eligible status.
  - Reuse `isShopBusinessStatusActive` in public shop and motorcycle read checks as well as in the task scheduler.
- **Read-Time Eligibility Filtering in Task Scheduler**:
  - Join `business_status_id` and `business_statuses (id, status_code)` inside the `rental_shops!inner` projection when loading enabled `shop_agent_configs` in `TaskSchedulerService.getDueTasks`.
  - Filter out configs whose associated shop fails `isShopBusinessStatusActive` (and apply optional `shopId` filtering) before computing Urgency Scores, applying `minUrgency` thresholds, sorting, and slicing to `limit`.
  - Return `[]` immediately when no eligible configs remain, preserving the existing `{ success: true, count: tasks.length, tasks }` HTTP `200` response shape in `GET /api/agent/tasks`.
- **Non-Destructive Read-Time Filter & Domain Glossary**:
  - Do not mutate or deactivate `shop_agent_configs` rows or alter `crawl_runs` history when a shop's business status is non-eligible. Restoring a shop's status to `Operational` or `Active` makes its existing task eligible on the next read.
  - Clarify `Shop Agent Config` in `CONTEXT.md` so agent scheduling enablement (`is_active`) and the rental shop's public business status (`Operational` or `Active`) are clearly distinguished.

## Testing Decisions

- **Good Tests Verify External Behavior at Public Seams**:
  - Tests assert observable inputs and outputs at the service and route handler boundaries rather than internal implementation details.
- **Seam 1 — Task Scheduler & Shared Eligibility Helper (`TaskSchedulerService.getDueTasks` & `isShopBusinessStatusActive`)**:
  - Verify `Operational` and `Active` case variants (`OPERATIONAL`, `operational`, `Operational`, `ACTIVE`, `active`, `Active`) are eligible.
  - Verify `Inactive` (including Mr. Scooter Rentals Bangkok `cca7fb21-743c-4ba8-beaa-be07ae92ef07`), `Temporarily Closed`, `Permanently Closed`, and missing-status (`null`/`undefined`) shops are excluded in both queue selection and explicit `shopId` lookups.
  - Verify excluded shops with higher Urgency Scores do not consume `limit` slots or inflate results when eligible shops exist behind them in the queue.
  - Verify restoring a shop's business status from `Inactive` to `Operational` or `Active` makes its task eligible again with its existing Shop Agent Config preserved.
- **Seam 2 — Agent Tasks HTTP Endpoint (`GET /api/agent/tasks`)**:
  - Verify `GET /api/agent/tasks?shopId=cca7fb21-743c-4ba8-beaa-be07ae92ef07` for an `Inactive` shop returns HTTP `200` with `{ success: true, count: 0, tasks: [] }`.
  - Verify `GET /api/agent/tasks` queue requests exclude non-eligible statuses before `limit` and `count` calculation and reflect restored eligibility when a shop becomes `Operational` or `Active`.
- **Prior Art**:
  - Service-level scheduler tests in `__tests__/services/task-scheduler.test.ts` and route-level tests in `__tests__/api/agent-tasks-route.test.ts`.

## Out of Scope

- Modifying `POST /api/agent/tasks/[id]/status` or `POST /api/agent/change-proposals` ingestion behavior for in-flight runs.
- Mutating, deleting, or permanently deactivating `shop_agent_configs` rows or historical `crawl_runs` records when a shop's business status changes.

## Implementation Tickets

- [ ] [#195: fix(agent-tasks): exclude non-eligible business status shops from GET /api/agent/tasks](https://github.com/MickRheault/rv2/issues/195)
