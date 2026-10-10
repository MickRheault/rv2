# Three-Tier Ingestion Cadence

`shop_agent_configs` assigns each rental shop to one of three crawl cadence tiers:
- **Tier 1 (Weekly / 7 days)**: High-priority partners and active inventory.
- **Tier 2 (Monthly / 30 days)**: Standard catalog shops.
- **Tier 3 (Bi-Monthly / 60 days)**: Infrequent or seasonal shops.

The task scheduler queries shops where `last_run_at IS NULL OR last_run_at <= NOW() - cadence_interval`, prioritized by `priority ASC, last_run_at ASC NULLS FIRST`.
