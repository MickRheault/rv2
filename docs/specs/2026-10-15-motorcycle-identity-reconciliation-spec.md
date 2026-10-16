# Spec: Motorcycle Identity Reconciliation and SEO Preservation in Change Proposals

## Problem Statement

When external crawler agents submit a Change Proposal for a rental shop, the inventory diffing process currently treats a motorcycle's brand and model name as its primary identity key. As a result:
- Correcting a motorcycle's brand (for example, `Honda QBIX` to `Yamaha QBIX`), model spelling, or model year produces a false delist-and-add pair instead of updating the existing motorcycle listing in place, which breaks its existing database identity and public SEO URL.
- Crawled offers lack a way to explicitly target an existing motorcycle record by ID (`existingMotorcycleId`), and per-motorcycle source URLs (`sourceUrl`) and historical URL aliases are not used to anchor **Source Offer Identity** prior to model-name matching.
- Harmless alphanumeric spacing and punctuation differences (such as `PG1`, `PG 1`, and `PG-1`) fail to normalize to the same token because letter-digit boundaries are not normalized.
- When a shop has multiple existing listings that could match an incoming offer (such as two `Yamaha PG-1` listings) or when an unmatched addition and an unmatched existing listing form a likely replacement pair, the system lacks an explicit **Identity Review** workflow to prevent silent first-match guessing or accidental replacements.

## Solution

Decouple a motorcycle listing's **Source Offer Identity** from its editable attributes (`brand`, `model`, `year`, `engineCapacityCc`, `rates`, `sourceUrl`) across Change Proposal ingestion, diff calculation, admin review, and proposal application:
1. **Explicit Existing-Record Targeting**: Allow each incoming bike in the Change Proposal ingestion contract to optionally specify `existingMotorcycleId` and per-bike `sourceUrl`. Validate that every `existingMotorcycleId` exists within the target shop and is targeted by at most one incoming bike in the request; reject invalid, cross-shop, or duplicate target IDs with a `400` validation error rather than falling back to an addition.
2. **Four-Tier Identity Reconciliation Priority**: Reconcile incoming bikes against active shop inventory in strict priority order before calculating additions and soft-delistings:
   - **Priority A**: Explicit `existingMotorcycleId`.
   - **Priority B**: Exact per-bike `sourceUrl` match against an existing listing's stored `source_url` within the same shop.
   - **Priority C**: Match against known historical `source_url_aliases` stored on an existing listing within the same shop.
   - **Priority D**: Normalized **Canonical Model Name** matching (including alphanumeric letter-digit boundary normalization so `PG1`, `PG 1`, and `PG-1` normalize to the same comparison token while keeping curated display names authoritative and keeping distinct variant qualifiers separate).
3. **Explicit Identity Review & Replacement Protection**: Flag any Change Proposal Item with multiple candidate matches (for example, two existing `PG-1` records when matched only by normalized model) or any unmatched addition paired with a likely replacement candidate among unmatched existing records (such as `Honda QBIX` to `Yamaha QBIX` when no explicit ID or source URL matched) as needing **Identity Review**. Block applying a Change Proposal while any selected item has an unresolved **Identity Review**, and provide interactive resolution controls in the Change Proposal review UI to:
   - Update a selected existing motorcycle (recomputing the diff into an in-place `update` and removing the corresponding `delist` item).
   - Confirm and create a genuinely new listing.
   - Merge confirmed duplicate existing records into a selected surviving motorcycle record.
4. **SEO Identity Preservation & Permanent Redirects**: When applying an in-place `update`, preserve the motorcycle's database ID and public URL while updating editable attributes (`brand`, `model`, `year`, `engine_capacity_cc`, `source_url`, `source_url_aliases`, and `rental_rate_tiers`). When duplicate records are merged into a surviving record, soft-retire the duplicate listing (`unavailable`) and record the surviving listing's ID on the retired listing so requests to the retired listing's public URL issue a permanent redirect (`HTTP 308`) to the surviving listing.

## User Stories

1. As an ingestion agent, I want to optionally provide an `existingMotorcycleId` on any bike in a Change Proposal payload, so that I can explicitly target a known motorcycle listing for an in-place update even when correcting its brand, model name, or year.
2. As an ingestion agent, I want the Change Proposal ingestion endpoint to reject a payload with HTTP `400` if an `existingMotorcycleId` does not exist or belongs to a different rental shop, so that invalid target IDs never silently create duplicate additions.
3. As an ingestion agent, I want the Change Proposal ingestion endpoint to reject a payload with HTTP `400` if two or more incoming bikes in the same snapshot target the same `existingMotorcycleId`, so that conflicting updates cannot overwrite each other.
4. As an ingestion agent, I want to include a per-bike `sourceUrl` in the Change Proposal payload, so that each motorcycle offer's canonical detail page URL is persisted and used to anchor **Source Offer Identity** on subsequent crawls.
5. As a catalog administrator, I want incoming motorcycles to reconcile against existing shop listings by explicit `existingMotorcycleId` first, exact per-bike `sourceUrl` second, known `source_url_aliases` third, and normalized **Canonical Model Name** fourth, so that strong identity matches are never overridden by brand, model spelling, or year corrections.
6. As a catalog administrator, I want harmless alphanumeric spacing and hyphenation differences (`PG1`, `PG 1`, `PG-1`) to normalize to the same matching token during Priority D matching while keeping distinct trims and variant qualifiers separate, so that minor formatting differences do not trigger false replacements.
7. As a catalog administrator, I want Priority D normalized model matches to keep the existing curated display model name in RideVault authoritative, while Priority A (`existingMotorcycleId`), Priority B/C (`sourceUrl` / alias), and explicit reviewer reconciliations stage and apply intentional `brand` and `model` corrections in place.
8. As a catalog administrator, I want an incoming bike that matches multiple existing shop listings under Priority D (such as two `Yamaha PG-1` listings without disambiguating source URLs) to be flagged for **Identity Review** with all candidate existing records attached, so that the system never silently guesses the first match.
9. As a catalog administrator, I want unmatched additions to be compared against unmatched existing listings before finalizing a Change Proposal diff so that likely replacement pairs (such as `Honda QBIX` to `Yamaha QBIX` or a model year correction on an unlinked offer) are flagged for **Identity Review** rather than left as an unlinked add-and-delist pair.
10. As a catalog administrator reviewing a Change Proposal, I want items flagged for **Identity Review** to display an interactive resolution banner where I can choose to update a specific existing motorcycle, create a genuinely new listing, or merge duplicate existing records into a surviving listing.
11. As a catalog administrator reviewing a Change Proposal, I want the Apply button to be blocked while any selected Change Proposal Item has an unresolved **Identity Review**, so that ambiguous or replacement items cannot be accidentally applied as duplicate additions and delistings.
12. As a catalog administrator, when I resolve an **Identity Review** item by selecting an existing motorcycle to update (or merging duplicates into a surviving record), I want the Change Proposal Item to immediately recompute its diff as an in-place `update` against the chosen record and remove any superseded `delist` item from the proposal.
13. As a catalog administrator, when I approve an in-place `update` Change Proposal Item that includes a brand correction (`Honda` to `Yamaha`), model correction, year correction, price update, or `sourceUrl` update, I want the existing motorcycle record updated in place with the same database ID and public URL preserved.
14. As a catalog administrator, when an existing motorcycle's `source_url` changes during an in-place update or when a duplicate motorcycle is merged into a surviving record, I want the previous `source_url` retained in the surviving record's `source_url_aliases`, so that future crawls referencing either URL still resolve to the surviving listing.
15. As a rider or search engine crawler visiting a retired duplicate motorcycle's public URL after it has been merged into a surviving listing, I want to receive a permanent redirect (`HTTP 308`) to the surviving motorcycle's public URL rather than a `404` or unavailable page.

## Implementation Decisions

- **Agent Ingestion Contract & Validation**:
  - Extend the per-bike snapshot contract in Change Proposal ingestion to accept optional `existingMotorcycleId` (UUID string) and `sourceUrl` (URL string).
  - Before computing or staging a diff, validate every supplied `existingMotorcycleId`:
    - No two incoming bikes in the same request may specify the same `existingMotorcycleId`.
    - Every specified `existingMotorcycleId` must exist in the shop's inventory for the submitted `shopId`.
    - Any violation raises a dedicated validation error that returns HTTP `400` from the Change Proposal ingestion endpoint without staging partial records or falling back to an addition.
- **Four-Tier Identity Reconciliation in the Diff Engine**:
  - **Priority A (Explicit ID)**: Match incoming bikes with `existingMotorcycleId` directly to the corresponding existing shop record.
  - **Priority B (Exact Source Offer URL)**: For remaining unmatched incoming bikes with a non-empty `sourceUrl`, normalize the URL (trimming whitespace and normalizing trailing slashes while preserving path and query identity) and match against existing shop motorcycles with an identical normalized `source_url`. If exactly one unmatched existing record shares that `source_url`, match it directly; if multiple existing records share that `source_url`, flag for **Identity Review** with those candidates.
  - **Priority C (Known Source URL Aliases)**: Match remaining incoming bikes with a `sourceUrl` against `source_url_aliases` stored in `specifications_details` on existing shop motorcycles.
  - **Priority D (Normalized Model & Composite Displacement Matching)**:
    - Enhance model token normalization to insert a space at letter-digit and digit-letter boundaries (after stripping `cc` suffixes from numbers) so `PG1`, `PG 1`, and `PG-1` normalize to the identical token `pg 1`, while keeping distinct variant qualifiers (`Click 125 Gen 5th`) separate.
    - When an incoming bike matches exactly one remaining existing bike by normalized brand + model (or composite model + displacement) and compatible year/generation, pair them as an `update` or `unchanged` item and keep the existing curated display `model` name authoritative.
    - When an incoming bike matches **multiple** remaining existing bikes by normalized brand + model (or differs only by model year across candidate records), emit the item with `diff_summary.identity_review` populated (`needsReview: true`, `reason: 'ambiguous_candidates'`, and the list of candidate existing records) and withhold the candidate existing records from automatic `delist` generation until resolved.
- **Replacement-Pair Protection**:
  - After Priority A–D matching, compare remaining unmatched `add` items against remaining unmatched existing motorcycles in the same shop.
  - If an unmatched `add` item shares the same normalized model token (or composite model + displacement token) as one or more unmatched existing motorcycles (for example, `Honda QBIX` vs. `Yamaha QBIX` where the brand was corrected, or a single existing motorcycle of the same normalized model whose year was corrected), flag the item with `diff_summary.identity_review` (`needsReview: true`, `reason: 'likely_replacement'`, `candidates: [...]`) and link the candidate `delist` item IDs so the reviewer can reconcile them in the UI rather than executing an accidental add-and-delist replacement.
- **Diff Summary for In-Place Brand, Model, and Source URL Updates**:
  - When a motorcycle is matched via Priority A (`existingMotorcycleId`), Priority B/C (`sourceUrl` / alias), or explicit reviewer reconciliation, differences in `brand` (`diff_summary.brand = { old, new }`), `model` (`diff_summary.model = { old, new }`), `year`, `engine_capacity_cc`, `source_url`, and `rates` are recorded on the `update` Change Proposal Item.
- **Interactive Identity Review Resolution API & UI**:
  - Provide an admin resolution action on a Change Proposal that allows resolving a flagged Change Proposal Item in one of three ways:
    1. **Update Existing Motorcycle**: Targets a selected candidate `existingMotorcycleId`, converts the item into an in-place `update` (or `unchanged` if no attributes differ) against that existing record, marks `identity_review.needsReview = false`, and removes/rejects the corresponding superseded `delist` item for that candidate.
    2. **Create New Listing**: Marks `identity_review.needsReview = false` and `resolution = 'create_new'` on the `add` item so it can be applied as a genuinely new motorcycle listing while leaving any separate unmatched existing records untouched.
    3. **Merge Duplicates into Surviving Record**: Targets a `survivingMotorcycleId` and one or more `duplicateMotorcycleIds` from the shop's candidate records, converts the incoming item into an `update` on `survivingMotorcycleId` (recording `merge_duplicate_ids` in `proposed_data`), and removes superseded `delist` items.
  - In the Change Proposal detail viewer, display an amber **Needs Identity Review** banner and candidate selector on any item where `diff_summary?.identity_review?.needsReview === true`, and disable the **Apply Selected** button whenever any selected item still has `needsReview === true`.
- **Applying In-Place Updates, Alias Retention, and Duplicate Merges**:
  - When applying an approved `update` Change Proposal Item:
    - Keep the existing `motorcycle_rentals.id` unchanged.
    - If `brand` changed (and was staged via Priority A/B/C or reviewer reconciliation), resolve or create the brand in `brands` and update `brand_id` on `motorcycle_rentals`, updating `brand_name` on the Change Proposal Item.
    - If `model` changed (and was staged via Priority A/B/C or reviewer reconciliation), update `model` on `motorcycle_rentals`.
    - If `sourceUrl` is provided on `proposed_data`, update `source_url` on `motorcycle_rentals`, and if the existing record had a different non-empty `source_url`, append the old URL to `specifications_details.source_url_aliases`.
    - If `proposed_data.mergeDuplicateIds` is present, soft-retire each duplicate motorcycle record in the same shop (`availability_status = 'unavailable'`, `specifications_details.merged_into_id = survivingId`) and append each retired record's `source_url` to the surviving motorcycle's `source_url_aliases`.
- **Permanent Redirects for Merged Listings**:
  - On the public motorcycle detail route, if the fetched motorcycle has `specifications_details.merged_into_id` set, issue an HTTP `308` permanent redirect (`permanentRedirect`) to `/motorcycle/<merged_into_id>`.

## Testing Decisions

- **What makes a good test**: Tests must verify observable external behavior at module boundaries—diff outputs, HTTP status codes and payloads, persisted database mutations, UI resolution states, and HTTP redirects—rather than private helper internals.
- **Modules and Seams to be tested**:
  1. **Inventory Diff Engine Seam**: Unit tests covering:
     - Priority A (`existingMotorcycleId`) matching `Honda QBIX` to `Yamaha QBIX` as an in-place `update` with `brand`, `year`, and `rates` diffs.
     - Validation errors thrown for unknown `existingMotorcycleId`, cross-shop `existingMotorcycleId`, and duplicate `existingMotorcycleId` targets in the same payload.
     - Priority B (`sourceUrl`) and Priority C (`source_url_aliases`) matching two `Yamaha PG-1` records (`9500f956-4eb1-403f-bd52-de60fe6818f7` and `74a83430-2e1c-47af-ae9b-fb788a01367a`) to their respective source offers and staging a year correction (`2024` to `2026`) without creating a replacement listing.
     - Priority D alphanumeric boundary normalization (`PG1` / `PG 1` / `PG-1`) keeping curated display names authoritative while keeping genuine variants (`Click 125` vs `Click 125 Gen 5th`) separate.
     - Ambiguous multi-candidate matching (`PG-1` without `sourceUrl` or `existingMotorcycleId`) and likely replacement pairs (`Honda QBIX` to `Yamaha QBIX` without `existingMotorcycleId`) flagging `identity_review.needsReview = true`.
  2. **Change Proposal Service & API Route Seam**: Service and endpoint tests covering:
     - `POST /api/agent/change-proposals` returning HTTP `400` on invalid or duplicate `existingMotorcycleId`.
     - Interactive **Identity Review** resolution recomputing an item into an `update`, removing the superseded `delist` item, and updating `summary_counts`.
     - Applying an approved in-place `update` to update `brand_id`, `model`, `year`, `source_url`, `source_url_aliases`, and `rental_rate_tiers` while preserving the existing motorcycle ID and not executing superseded `add`/`delist` actions.
     - Applying a duplicate merge to set `availability_status = 'unavailable'` and `specifications_details.merged_into_id` on the retired duplicate record.
  3. **Change Proposal Diff Viewer & Public Motorcycle Route Seam**: Component and route tests verifying:
     - Rendering the **Needs Identity Review** warning banner and resolution controls, blocking the Apply button until resolved, and triggering resolution updates.
     - Issuing a permanent redirect (`HTTP 308`) to `/motorcycle/<survivingId>` when visiting a merged motorcycle's public URL.
- **Prior Art**: Existing unit and integration test suites for the inventory diff engine, Change Proposal service, agent ingestion API route, and Change Proposal diff viewer component.

## Out of Scope

- Changing the public motorcycle detail URL scheme away from `/motorcycle/[id]`.
- Automatic external HTTP crawling from inside the diff engine to probe third-party redirects at diff calculation time (redirect and alias knowledge is supplied by the crawler agent or recorded in `source_url_aliases`).

## Further Notes

- Real-world verification targets shop `abc85b6d-9b86-40fa-98a5-f3bc91b9a48c` ("from 8$ SIEM REAP SCOOTER RENTAL"), specifically existing QBIX record `7d316bb8-4f40-459c-a7ad-bfc445d8c851` and existing PG-1 records `9500f956-4eb1-403f-bd52-de60fe6818f7` and `74a83430-2e1c-47af-ae9b-fb788a01367a`.
