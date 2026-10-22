# Display Extraction Hints on Change Proposal Detail Page (#188)

## Problem
When reviewing a staged Change Proposal on `/admin/change-proposals/[id]`, administrators cannot see the `extraction_hints` configured or learned for that shop (`shop_agent_configs.extraction_hints`). Having visibility into the extraction hints directly in the Proposal Summary card helps admins verify whether the agent's extracted rates, conditions, and policies align with the shop's known extraction rules.

## Requirements
1. **Placement**:
   - Display only on the Proposal Detail / Diff Viewer page (`/admin/change-proposals/[id]`, rendered by `components/admin/ChangeProposalDiffViewer.tsx` inside the Proposal Summary Header `Card`).
   - Do **not** add extraction hints to the `/admin/change-proposals` list table.
2. **Data Retrieval (`ChangeProposalService.getProposalById`)**:
   - In `ChangeProposalService.getProposalById(proposalId)` (`services/change-proposals.ts`), query `shop_agent_configs` for `proposal.shop_id` (`select('extraction_hints').eq('shop_id', proposal.shop_id).maybeSingle()`) using defensive optional chaining so partial mocks in tests do not break.
   - Resolve `extraction_hints: string | null` by preferring the non-empty trimmed `shop_agent_configs.extraction_hints` value, falling back to `proposal.extraction_hints` or `proposal.raw_snapshot?.extractionHints` / `proposal.raw_snapshot?.extraction_hints`, or `null` if none exists.
3. **Read-Only UI Display (`ChangeProposalDiffViewer`)**:
   - Extend `DiffViewerProposal` with optional `extraction_hints?: string | null` (and also support `extractionHints?: string | null` or `raw_snapshot?.extractionHints` / `raw_snapshot?.extraction_hints` if passed directly).
   - When non-empty `extraction_hints` are present on the proposal, render a read-only "Extraction Hints" section inside the Proposal Summary Header `Card` with `whitespace-pre-wrap` to preserve multiline hints.
   - When `extraction_hints` is `null`, `undefined`, or whitespace-only, do not render the Extraction Hints block.
