# Spec: Automated Shop Crawler Ingestion and Change Proposal Review System

## Problem Statement

RideVault aggregates motorcycle rental shops across global locations, but rental inventories, seasonal rate tiers, and rental conditions change frequently on provider websites. Manually updating hundreds of shops is unsustainable. Currently, there is no automated mechanism for external crawler agents (such as Hermes) to discover due shops, submit scraped data, calculate differences against live inventory, or stage updates for review. Without safety guardrails, automated crawling risks wiping out valid listings during site blocks, polluting customer bug moderation queues, or corrupting verified Google Maps geodata.

## Solution

An automated ingestion and staging system that decouples external scraping agents from direct database writes. External agents poll due shops based on a multi-tier Urgency Score algorithm that prevents priority starvation under daily crawl budgets. When an agent crawls a shop, it posts a raw, verbatim snapshot to a dedicated REST API. The RideVault backend computes a structured diff against canonical manufacturer model names, marks unobserved bikes as soft-delisted (`availability_status = 'unavailable'`), and aborts mass-deletions if zero inventory is detected. The resulting Change Proposal is staged in a two-table queue for admin inspection. Admins review visual diffs in the dashboard, cherry-pick approved mutations via checkboxes, and trigger an atomic server-side mutation engine that updates live production tables while strictly preserving immutable geodata.

## User Stories

1. As an admin, I want each rental shop to have a configurable crawl cadence tier (Weekly, Monthly, Bi-monthly), so that high-activity partner shops are checked frequently while low-activity shops do not consume unnecessary crawler resources.
2. As an admin, I want to store custom extraction hints for a shop (e.g. currency, pricing page URLs), so that the external crawler agent knows where to locate fleet pricing.
3. As an external crawler agent, I want to fetch a list of due crawl tasks via `GET /api/agent/tasks` using an API secret key, so that I know which shops require scraping without needing public webhooks or manual coordination.
4. As an external crawler agent, I want tasks to be prioritized by an Urgency Score (`days_since_last_crawl / tier_cadence_days`), so that lower-cadence shops are not permanently starved under a fixed daily crawl budget.
5. As an external crawler agent, I want the task response to include canonical brand designations and known model names, so that I can align scraped listings with official manufacturer naming.
6. As an external crawler agent, I want to report crawl errors (such as Cloudflare blocks or site downtime) via `POST /api/agent/tasks/:id/status`, so that the platform records the error and advances the crawl timestamp to prevent infinite retry loops.
7. As an external crawler agent, I want to post verbatim inventory snapshots (model, year, specs, published rates) to `POST /api/agent/change-proposals`, so that my agent logic remains thin and diff calculations happen centrally on the server.
8. As the RideVault backend, I want to calculate inventory diffs against live database state using exact canonical model matching, so that existing listings are updated and new models are recognized without heuristic guessing.
9. As the RideVault backend, I want to refuse creating a mass-delist proposal if an incoming crawl returns zero inventory for a shop that has active bikes, so that anti-bot blocks or site redesigns do not wipe out production listings.
10. As an admin, I want to view a queue of pending Change Proposals at `/admin/change-proposals` showing shop names, crawl dates, and summary badges (`+N new`, `~N updated`, `-N delisted`), so that I can easily spot which shops have pending updates.
11. As an admin, I want to inspect a Change Proposal in a structured diff viewer showing new motorcycles, modified rates/specifications, delisted inventory, and updated shop descriptions, so that I have full context before approving.
12. As an admin, I want binary checkboxes beside every proposed item (checked by default), so that I can reject flawed or inaccurate items by simply unchecking them.
13. As an admin, I want to click "Approve Selected" to commit approved mutations atomically to live production tables (`motorcycle_rentals`, `rental_rate_tiers`, `rental_shops`, inclusions, conditions), so that the catalog is updated without partial failures.
14. As an admin, I want unapproved missing inventory to be soft-deactivated (`availability_status = 'unavailable'`) instead of permanently deleted, so that historical bookings, reviews, and SEO URLs remain intact.
15. As the system, I want shop geodata (`provider_name`, `full_address`, `latitude`, `longitude`, `place_id`) to be strictly immutable during proposal execution, so that crawler suggestions cannot break verified Google Maps location integrity.
16. As an admin, I want to trigger proposal application programmatically via an authenticated API endpoint (`POST /api/admin/change-proposals/:id/apply`), so that future Telegram bots or trusted auto-approval policies can apply proposals without an open browser tab.

## Implementation Decisions

- **Dedicated REST API Transport**: Integration runs over dedicated Next.js API routes with bearer token authentication (`AGENT_API_KEY`), keeping database service role keys private (ADR 0001).
- **Batch per Shop Run**: Each Change Proposal represents an entire single shop crawl snapshot to preserve holistic review context, rather than fragmenting into dozens of isolated entity flags (ADR 0002).
- **Server-Side Diffing**: The server computes additions, updates, and removals against live database records, keeping external agents lean and standardizing business rules across all future ingestion sources (ADR 0003).
- **Strict Canonical Model Naming**: Inventory matching strictly compares canonical manufacturer names. No automated fuzzy guessing or arbitrary scraper title aliasing is permitted (ADR 0004).
- **Soft Deactivation**: Missing inventory transitions to `availability_status = 'unavailable'`, matching existing database partial indexes and public search filters while preserving database referential integrity (ADR 0005).
- **Two-Table Proposal Storage**: Proposals use `change_proposals` (batch metadata, status, raw snapshot) and `change_proposal_items` (entity type, action, original/proposed values, item status), enabling granular cherry-picking and clean relational querying (ADR 0006).
- **Separation from User Moderation**: Ingestion uses dedicated tables rather than overloading `flagged_content`, avoiding mandatory contact email constraints, enabling entity creation, and handling multi-table child rate tiers cleanly (ADR 0007).
- **Three-Tier Cadence**: Crawl frequency is categorized into Tier 1 (7 days), Tier 2 (30 days), and Tier 3 (60 days) (ADR 0008).
- **Starvation-Free Urgency Scheduling**: The task queue orders candidates by Relative Overdue Ratio (`days_since_last_crawl / tier_cadence_days`), guaranteeing that lower-cadence tiers make steady progress under a fixed daily LLM crawl budget (ADR 0009).
- **Verbatim Pricing**: Rates are captured exactly as advertised on the website, preserving explicit tier ranges without synthetic daily mathematical conversions (ADR 0010).
- **Protected Geodata Boundaries**: Core Google Places attributes (`provider_name`, `full_address`, coordinates, `place_id`) are immutable. Crawlers may only update descriptions, contact info, inclusions, conditions, and motorcycle inventory (ADR 0011).
- **Binary Review Interaction**: The review UI uses binary item-level checkboxes (approve/reject) for Phase 1 to maximize review speed and prevent complex dirty-state form overhead (ADR 0012).

## Testing Decisions

- **Test External Behavior, Not Implementation**: Tests will interact exclusively through API route boundaries and UI review action handlers, verifying resulting database states and response contracts.
- **Seam 1 (Ingestion & Scheduling API)**:
  - Verify task queue ordering across mixed tiers with different last-run dates to confirm Urgency Score calculations.
  - Verify diff calculations on mock snapshots (new bike insertions, rate updates, soft-delisting).
  - Verify zero-drop guardrail refuses mass delisting when empty inventory is submitted for active shops.
  - Verify unauthorized requests lacking valid `AGENT_API_KEY` are rejected with 401.
- **Seam 2 (Admin Review & Application Engine)**:
  - Verify `ChangeProposalService.apply()` commits approved items in a single transaction.
  - Verify partial approvals apply only selected item IDs and mark the proposal `partially_applied`.
  - Verify attempts to mutate `place_id`, address, or coordinates throw a validation error and abort.
- **Prior Art**: Existing service tests in `__tests__/` and API route integration tests in `app/api/`.

## Out of Scope

- Inline mutable input editing inside the diff viewer (deferred to Phase 2; Phase 1 uses binary checkboxes).
- Automated approval policies without human review (deferred to Phase 2 once confidence metrics stabilize).
- Real-time Telegram bot webhook interaction (deferred to Phase 2; Phase 1 prepares the headless apply API).
- Residential proxy rotation and headless browser automation (managed externally within the Hermes agent environment).

## Further Notes

- Once published, this specification will be decomposed into tracer-bullet vertical slice tickets using the `to-tickets` skill.
- All database migrations will follow Supabase CLI conventions and reside in `supabase/migrations/`.
