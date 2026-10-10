# Two-Table Structure for Change Proposals

Change Proposals use a normalized two-table schema (`change_proposals` and `change_proposal_items`) rather than a single JSONB document. This enables item-level status tracking, granular cherry-picking in the review dashboard (approving or rejecting individual additions, rate updates, or deactivations), and clean relational querying across entities.
