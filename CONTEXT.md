# RideVault Context

Global motorcycle rental aggregator platform connecting riders with rental shops and motorcycle inventory worldwide.

## Language

**Change Proposal**:
A staged shop-level review record produced by comparing a rental shop's website against its RideVault baseline, carrying zero or more Change Proposal Items alongside an optional Reconciliation Report, with independent coverage, reconciliation, and application statuses.
_Avoid_: Scrape proposal, raw snapshot diff, patch request

**Reconciliation Report**:
A private administrative inventory-accounting snapshot attached to a Change Proposal that records crawl scope, source-page coverage, and every in-scope motorcycle's disposition with supporting evidence.
_Avoid_: Public shop note, crawl log, mutation payload

**Reconciliation Entry**:
A model- or variant-level accounting record inside a Reconciliation Report classifying a motorcycle as `ready_change`, `unchanged`, `unresolved`, `excluded`, or `duplicate` with supporting source evidence and optional links to actionable Change Proposal Items.
_Avoid_: Unapplied mutation, shadow proposal item

**Unresolved Candidate**:
A durable shop-scoped tracking record for a discovered motorcycle that cannot yet be published as a validated Change Proposal Item, persisting across crawl runs through `open`, `ready_for_proposal`, `resolved_applied`, `excluded`, and `dismissed` states.
_Avoid_: Ephemeral warning, placeholder listing, extraction hint note

**Change Proposal Item**:
An explicit proposed mutation (`add`, `update`, or `delist`; plus `unchanged` on legacy reportless proposals) submitted by an ingestion agent targeting a specific motorcycle listing or rental shop profile within a Change Proposal.
_Avoid_: Heuristic diff item, patch row, mutation entry

**Shop Agent Config**:
Per-shop configuration defining target source URL, crawl cadence tier (Tier 1 = weekly, Tier 2 = monthly, Tier 3 = bi-monthly), extraction hints, and agent scheduling enablement for automated ingestion agents. A shop's task is eligible to be scheduled only when its Shop Agent Config is enabled and the rental shop itself has a publicly visible business status (`Operational` or `Active`).
_Avoid_: Crawler config, scraper settings

**Urgency Score**:
A scheduling ratio (`days_since_last_run / tier_cadence_days`) used to rank pending ingestion tasks fairly across priority tiers, preventing lower-tier starvation under fixed daily crawl budgets.
_Avoid_: Crawl rank, overdue priority

**Catalog Listing**:
A published rental shop profile or active motorcycle inventory record (`available` status) curated in RideVault with supplier-stated Rental Offers, inclusions, and conditions, distinct from live date-specific stock or real-time booking availability.
_Avoid_: Live booking inventory, real-time stock slot, instant reservation

**Canonical Model Name**:
The official manufacturer designation for a motorcycle model as curated in RideVault.
_Avoid_: Scraped model title, listing alias, informal nickname

**Model Year Range**:
The inclusive span of production years (`year` to `year_to`, or a single `year`) that defines a distinct generation or fleet pricing tier of a motorcycle listing at a rental shop.
_Avoid_: Generation string, year suffix in model name, open-ended year

**Rental Offer**:
A standalone verbatim pricing option published by a rental shop for a motorcycle (`daily`, `package`, `hourly`, or `monthly`), preserving the supplier's authoritative amount, currency, billing basis (`per_hour`, `per_day`, `per_calendar_month`, or `package_total`), duration unit (`hour`, `day`, or `calendar_month`), commitments, billing increments, `"from"` qualifier, and supplier label without synthetic daily conversion.
_Avoid_: Synthetic rate tier, averaged daily rate, descriptive pricing note

**Extension Charge**:
An extra-day or extra-hour overage charge (`offer_type = 'extension'`) attached to a specific parent Rental Offer via `parent_offer_id` rather than standing alone as an independent rental option.
_Avoid_: Standalone extra-day tier, unlinked overage note

**Daily Equivalent**:
A read-only comparison figure (`round(amount / days, 2)`) deterministically derived for fixed-day `package_total` Rental Offers (`duration_unit = 'day'`, fixed `days > 1`), displayed secondary to the authoritative package total and never computed for `calendar_month`, `hourly`, `daily`, or `extension` offers.
_Avoid_: Standalone daily rate, 30-day calendar-month division, manual daily override

**Recovery Snapshot**:
A full, self-contained SQL dump of the `public` and `auth` database schemas and data, compressed and GPG-encrypted for point-in-time disaster recovery.
_Avoid_: Partial dump, unencrypted export, table CSV

