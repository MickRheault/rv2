# RideVault Context

Global motorcycle rental aggregator platform connecting riders with rental shops and motorcycle inventory worldwide.

## Language

**Change Proposal**:
A staged batch of agent-authored Change Proposal Items (`add`, `update`, `delist`, and `unchanged`) for a rental shop produced by comparing the shop's website against its current RideVault database baseline, awaiting administrator review and application.
_Avoid_: Scrape proposal, raw snapshot diff, patch request

**Change Proposal Item**:
An explicit proposed action (`add`, `update`, `delist`, or `unchanged`) submitted by an ingestion agent targeting a specific motorcycle listing (`entity_id`) or rental shop profile within a Change Proposal, carrying the item's `original_data`, `proposed_data`, and `diff_summary`.
_Avoid_: Heuristic diff item, patch row, mutation entry

**Shop Agent Config**:
Per-shop configuration defining target source URL, crawl cadence tier (Tier 1 = weekly, Tier 2 = monthly, Tier 3 = bi-monthly), extraction hints, and active status for automated ingestion agents.
_Avoid_: Crawler config, scraper settings

**Urgency Score**:
A scheduling ratio (`days_since_last_run / tier_cadence_days`) used to rank pending ingestion tasks fairly across priority tiers, preventing lower-tier starvation under fixed daily crawl budgets.
_Avoid_: Crawl rank, overdue priority

**Canonical Model Name**:
The official manufacturer designation for a motorcycle model as curated in RideVault.
_Avoid_: Scraped model title, listing alias, informal nickname

**Model Year Range**:
The inclusive span of production years (`year` to `year_to`, or a single `year`) that defines a distinct generation or fleet pricing tier of a motorcycle listing at a rental shop.
_Avoid_: Generation string, year suffix in model name, open-ended year

**Recovery Snapshot**:
A full, self-contained SQL dump of the `public` and `auth` database schemas and data, compressed and GPG-encrypted for point-in-time disaster recovery.
_Avoid_: Partial dump, unencrypted export, table CSV

