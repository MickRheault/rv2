# Soft Deactivation via Unavailable Status

When an ingestion run detects that existing shop inventory is missing from the source, the Change Proposal marks the items with `availability_status = 'unavailable'` rather than issuing hard deletes. Motorcycles with `availability_status = 'unavailable'` are excluded from public shop inventory listings, the shop's "Motorcycles Available (N)" count, and all public search/discovery queries (`services/shops.ts` and `services/motorcycles.ts`), while preserving their database records, foreign keys, historical analytics, and direct `/motorcycle/[id]` URLs (which remain live with a "Currently Unavailable" badge and `availability: false` in JSON-LD structured data).

