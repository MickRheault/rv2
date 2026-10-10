# Server-Side Diff Calculation

The ingestion API accepts full inventory snapshots for a rental shop rather than pre-calculated diffs. The RV2 backend queries current database state, calculates additions, updates, and removals, and stores both the raw snapshot and computed diff in the Change Proposal. This keeps external agent logic thin, prevents stale comparisons, and centralizes diff business rules.
