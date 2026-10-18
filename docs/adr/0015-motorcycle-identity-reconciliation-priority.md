# Motorcycle Identity Reconciliation Priority and SEO Preservation (Superseded by ADR 0016)

> Superseded by [0016-agent-computed-change-proposals.md](./0016-agent-computed-change-proposals.md).

Incoming motorcycle snapshots in a Change Proposal must reconcile against a shop's existing inventory in strict priority order before calculating additions and soft-delistings:
1. **Explicit Record Targeting (`existingMotorcycleId`)**: Validated to exist within the submitted shop and targeted by at most one incoming bike per payload; invalid or duplicate IDs return a `400` validation error rather than falling back to an addition.
2. **Exact Source Offer Identity (`sourceUrl`)**: Exact normalized match against an existing motorcycle's `source_url` within the same shop.
3. **Known Source URL Aliases**: Match against historical `source_url_aliases` recorded in `specifications_details` on existing shop motorcycles.
4. **Normalized Model Matching & Replacement Detection**: Normalized brand+model (and composite displacement) matching when unambiguous. When multiple existing records match or an unmatched addition pairs with an unmatched existing record of the same normalized model (such as a brand correction `Honda QBIX` → `Yamaha QBIX` or an ambiguous multi-variant model like two `PG-1` listings), the item is flagged for **Identity Review** rather than silently picking the first match or leaving an unlinked add-and-delist pair.

In-place updates preserve the existing motorcycle's database UUID (`id`) and public URL (`/motorcycle/[id]`) while updating editable attributes (`brand_id`, `model`, `year`, `engine_capacity_cc`, `source_url`, and `rental_rate_tiers`). When duplicate records are merged into a surviving record during Identity Review, the retired duplicate is marked `unavailable` with `specifications_details.merged_into_id` pointing to the surviving ID so `/motorcycle/[retiredId]` issues an HTTP 308 permanent redirect.
