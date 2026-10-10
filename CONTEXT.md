# RideVault Context

Global motorcycle rental aggregator platform connecting riders with rental shops and motorcycle inventory worldwide.

## Language

**Change Proposal**:
A staged set of proposed additions, updates, or removals to a rental shop's inventory and rates produced from a single ingestion run, awaiting review or automated application.
_Avoid_: Scrape proposal, crawl diff, patch request

**Change Proposal Item**:
An individual proposed action (create, update, delist) targeting a specific motorcycle listing, rate, condition, or shop property within a Change Proposal.
_Avoid_: Diff item, patch row, mutation entry

**Shop Agent Config**:
Per-shop configuration defining target source URL, crawl cadence tier (Tier 1 = weekly, Tier 2 = monthly, Tier 3 = bi-monthly), extraction hints, and active status for automated ingestion agents.
_Avoid_: Crawler config, scraper settings

**Canonical Model Name**:
The official manufacturer designation for a motorcycle model as curated in RideVault.
_Avoid_: Scraped model title, listing alias, informal nickname
