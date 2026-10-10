# Three-Tier Ingestion Priority

`shop_agent_configs` includes a 3-tier priority system (1 = High/Focus, 2 = Standard, 3 = Low/Deferred). Tasks are ordered primarily by priority (`priority ASC, last_run_at ASC NULLS FIRST`), and the task dispatch API supports filtering by priority level. This allows phased rollouts and token conservation by focusing the crawler strictly on high-priority partner shops before processing broader catalog tiers.
