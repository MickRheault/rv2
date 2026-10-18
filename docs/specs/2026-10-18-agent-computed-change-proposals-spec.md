## Problem Statement

When an external ingestion agent crawls a rental shop's website and submits a Change Proposal, the backend currently attempts to load the shop's database state and run a complex heuristic diff and identity-reconciliation engine (`services/diff-engine.ts`) over raw scraped snapshots. This server-side diffing and reconciliation introduces unnecessary complexity, brittle matching heuristics, multi-pass ambiguity workflows (`Identity Review`), and failure modes when comparing live website offerings against existing database records. Meanwhile, the ingestion agent already has the reasoning context to inspect both the live shop website and the shop's current database records and explicitly determine what needs to be added, updated, delisted, or confirmed unchanged.

## Solution

Shift inventory and shop-profile comparison responsibility completely to the ingestion agent and delete the server-side diff engine (`services/diff-engine.ts`) along with server-side `Identity Review` and `ZeroDropSafeguardError`:
1. Enrich the agent task endpoint (`GET /api/agent/tasks`, with optional `?shopId=<uuid>` filtering for targeted runs) so each task payload includes the rental shop's complete current database baseline: all active motorcycles (`id`, `brand`, `model`, `year`, `year_to`, `engine_capacity_cc`, `source_url`, and `rates`) and the current shop profile (`business_description`, `phone`, `website`, `inclusions`, and `conditions`).
2. Replace the raw-snapshot `POST /api/agent/change-proposals` contract with an explicit 1-to-1 `items` array where the agent directly specifies each Change Proposal Item (`entityType`, `action`, `entityId`, `brandName`, `modelName`, `originalData`, `proposedData`, `diffSummary`).
3. Make the backend a thin validation and staging layer that verifies basic item structure (`entityType`, `action`, required `entityId` on `update`/`delist`/`unchanged`, and geodata immutability), calculates `summary_counts` by counting item actions, and inserts the items directly into `change_proposals` and `change_proposal_items`.
4. Simplify Change Proposal application and the Admin UI diff viewer so approved items apply their `proposed_data` directly without depending on `services/diff-engine.ts` or `Identity Review`.

## User Stories

1. As an ingestion agent, I want `GET /api/agent/tasks` to include each due shop's full current active motorcycle inventory (`id`, `brand`, `model`, `year`, `year_to`, `engine_capacity_cc`, `source_url`, `rates`) and current shop profile (`business_description`, `phone`, `website`, `inclusions`, `conditions`), so that I have the complete database baseline in a single request to compare against the shop's website.
2. As an ingestion agent running an on-demand crawl for a specific shop, I want to filter `GET /api/agent/tasks?shopId=<uuid>` to retrieve the task and full database baseline for that specific shop even if its scheduled cadence is not yet due, so that I can prepare an accurate Change Proposal for any targeted shop.
3. As an ingestion agent, I want to submit an explicit `items` array to `POST /api/agent/change-proposals` containing `add`, `update`, `delist`, and `unchanged` Change Proposal Items, so that my exact decisions on which database records to mutate or preserve are staged 1-to-1 without server-side heuristic guessing.
4. As an ingestion agent, I want `POST /api/agent/change-proposals` to return a clear `400 Bad Request` error if an item has an invalid `entityType` or `action`, is missing `entityId` for an `update`, `delist`, or `unchanged` action, or attempts to mutate immutable geodata fields, so that malformed payloads are rejected immediately with actionable feedback.
5. As an ingestion agent, I want a Change Proposal containing only `unchanged` items to be recorded with status `applied` automatically and advance the shop's `last_run_at` timestamp, so that shops whose websites match the database do not clutter the administrator review queue.
6. As an administrator reviewing a Change Proposal in the Admin UI, I want to see the proposed additions, updates, soft-delistings, shop profile updates, and confirmed unchanged inventory clearly rendered from the staged items (using `diff_summary` when provided or comparing `original_data` and `proposed_data` directly) without any `Identity Review` blockers, so that I can approve or reject changes with one click.
7. As an administrator applying a Change Proposal, I want approved `add`, `update`, and `delist` motorcycle items and `rental_shop` updates to apply their `proposed_data` (including brand, model, Model Year Range `year`/`year_to`, engine capacity, `source_url`, rate tiers, shop description/phone/website, inclusions, and conditions) directly to the database, so that approved agent changes take effect reliably.

## Implementation Decisions

- **Delete Server-Side Diff Engine**: Completely delete the server-side diff engine module and its dedicated unit test suite, removing all heuristic matching, token normalization, `ZeroDropSafeguardError`, `ExistingMotorcycleValidationError`, and `Identity Review` logic.
- **Enriched Agent Task Baseline (`GET /api/agent/tasks`)**:
  - Support an optional `shopId` query parameter on `GET /api/agent/tasks` to fetch a specific shop's task and baseline directly.
  - Include `currentShop` (`id`, `providerName`, `businessDescription`, `phone`, `website`, `inclusions`, `conditions`) and `existingInventory` (array of active motorcycles with `id`, `brand`, `model`, `year`, `year_to`, `engineCapacityCc`, `availabilityStatus`, `sourceUrl`, and `rates`) on each returned `AgentTask` alongside `canonicalBrands` and `knownModels`.
- **Explicit 1-to-1 Change Proposal Ingestion Contract (`POST /api/agent/change-proposals`)**:
  - Accept `{ shopId, sourceUrl, agentRunId?, extractedHints?, discoveredSourceUrl?, items }` where `items` is a non-empty or empty array of explicit Change Proposal Items:
    ```ts
    interface SubmittedProposalItem {
      entityType?: 'motorcycle' | 'rental_shop'; // defaults to 'motorcycle'
      action: 'add' | 'update' | 'delist' | 'unchanged';
      entityId?: string | null;
      brandName?: string | null;
      modelName?: string | null;
      originalData?: Record<string, any> | null;
      proposedData?: Record<string, any> | null;
      diffSummary?: Record<string, any> | null;
    }
    ```
  - Validate that `items` is an array, every item has a valid `entityType` (`motorcycle` | `rental_shop`) and `action` (`add` | `update` | `delist` | `unchanged`), `entityId` is a non-empty string whenever `action` is `update`, `delist`, or `unchanged` (defaulting `entityId` to `shopId` for `entityType === 'rental_shop'`), and `proposedData` does not contain immutable geodata fields (`GeodataImmutabilityError` -> HTTP 400).
  - Compute `summary_counts` (`{ add, update, delist, unchanged }`) directly by counting `items` per action, store `{ items }` in `change_proposals.raw_snapshot`, and insert the mapped rows into `change_proposal_items`.
- **Remove Identity Review Resolution Workflow**:
  - Remove `resolveIdentityReview` from the Change Proposal service, remove the `PATCH /api/admin/change-proposals/[id]` handler, and remove the `Identity Review` resolution controls and gating from the Admin UI diff viewer.
- **Direct Application of Approved Change Proposal Items**:
  - In Change Proposal application, normalize motorcycle `proposed_data` (brand, model, Model Year Range `year`/`year_to`, `engineCapacityCc`/`engine_capacity_cc`, `sourceUrl`/`source_url`, `rates`, `currency`) directly within the Change Proposal service.
  - On `motorcycle` `update`, apply any provided `brandName`/`proposed.brand`, `modelName`/`proposed.model`, `year`/`year_to`, `engineCapacityCc`/`engine_capacity_cc`, `sourceUrl`/`source_url`, and `rates` directly to the target `entity_id` record without requiring specific keys in `diff_summary`.
  - On `rental_shop` `update`, apply `business_description`/`businessDescription`, `phone`, and `website` from `proposed_data`, and apply `inclusions` / `conditions` changes from either `diff_summary` (`added` / `removed`) or `proposed_data`.

## Testing Decisions

- **Good tests verify external behavior through public seams**: Tests assert HTTP status codes, response payloads, and persisted database records rather than internal helper functions.
- **Modules and Seams under test**:
  1. `GET /api/agent/tasks` route and TaskSchedulerService tests: Verify enriched `existingInventory` and `currentShop` baseline fields and `?shopId=` filtering.
  2. `POST /api/agent/change-proposals` route and ChangeProposalService tests: Verify staging of explicit `items` (`add`, `update`, `delist`, `unchanged`), structural and geodata validation errors (HTTP 400), atomic rollback if item insertion fails, `agentRunId` pending proposal replacement, and direct application of approved items via `ChangeProposalService.apply`.
  3. `ChangeProposalDiffViewer` component tests: Verify rendering of `add`, `update`, `delist`, `rental_shop`, and `unchanged` items (both with explicit `diff_summary` and fallback comparison of `original_data` vs `proposed_data`) and verify `Identity Review` controls are gone.

## Out of Scope

- Changing how the external agent crawls HTML pages or prompts its LLM.
- Modifying public-facing shop or motorcycle catalog pages.

## Further Notes

- Supersedes ADR 0003 (`0003-server-side-diff-calculation.md`) and ADR 0015 (`0015-motorcycle-identity-reconciliation-priority.md`) via ADR 0016 (`0016-agent-computed-change-proposals.md`).
