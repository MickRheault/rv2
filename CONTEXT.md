# RideVault Context

Global motorcycle rental aggregator platform connecting riders with rental shops and motorcycle inventory worldwide.

## Language

**Change Proposal**:
A staged set of proposed additions, updates, or removals to a rental shop's inventory and rates produced from a single ingestion run, awaiting review or automated application.
_Avoid_: Scrape proposal, crawl diff, patch request

**Shop Agent Config**:
Per-shop configuration defining target source URL, run frequency, extraction hints, and active status for automated ingestion agents.
_Avoid_: Crawler config, scraper settings

**Canonical Model Name**:
The official manufacturer designation for a motorcycle model as curated in RideVault.
_Avoid_: Scraped model title, listing alias, informal nickname
