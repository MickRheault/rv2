# Shop Ingestion Agent & Change Proposals Design Specification

Date: 2026-10-10  
Status: Approved via Grilling Interview

## 1. Overview
Automated ingestion system allowing external crawler agents (e.g. Hermes) to crawl rental shop websites on configurable cadences, extract inventory and rate data verbatim, and submit staged Change Proposals to RideVault (RV2) for admin review and atomic execution.

## 2. Architecture & Data Flow

```text
[Hermes Agent]
      │
      │ 1. GET /api/agent/tasks (Fetch due shops based on Urgency Score)
      ▼
[Crawl Shop Website]
      │
      │ 2. POST /api/agent/change-proposals (Send verbatim inventory snapshot)
      ▼
[RV2 Server Diff Engine]
      │ 
      │ 3. Server computes diff against live DB state
      │    - Exact match on canonical model names
      │    - Missing bikes flagged as availability_status = 'unavailable'
      │    - Zero-drop safeguard blocks mass-delist on empty crawls
      ▼
[change_proposals & change_proposal_items] (Status: pending)
      │
      ├── Phase 1 Review: [RV2 Admin Dashboard /admin/change-proposals]
      │                    (Review diff, check/uncheck items, Approve Selected)
      │
      └── Phase 2 Future: [Telegram Bot via Hermes]
                           (Ping admin with diff summary -> call apply endpoint)
      │
      ▼
[POST /api/admin/change-proposals/:id/apply]
      │
      ▼
[Update DB: motorcycle_rentals, rental_rate_tiers, rental_shops, inclusions]
```

## 3. Database Schema

### 3.1 `shop_agent_configs`
Configures crawler cadence and guidance per shop:
```sql
CREATE TABLE public.shop_agent_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID NOT NULL REFERENCES public.rental_shops(id) ON DELETE CASCADE,
    source_url TEXT,
    tier INTEGER NOT NULL DEFAULT 2 CHECK (tier BETWEEN 1 AND 3), -- 1: 7d, 2: 30d, 3: 60d
    extraction_hints TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_run_at TIMESTAMP WITH TIME ZONE,
    last_error TEXT,
    consecutive_errors INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    CONSTRAINT shop_agent_configs_shop_id_key UNIQUE (shop_id)
);
```

### 3.2 `change_proposals`
Tracks batch run per shop:
```sql
CREATE TYPE change_proposal_status AS ENUM ('pending', 'partially_applied', 'applied', 'rejected');

CREATE TABLE public.change_proposals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID NOT NULL REFERENCES public.rental_shops(id) ON DELETE CASCADE,
    source VARCHAR(50) NOT NULL DEFAULT 'hermes_agent',
    status change_proposal_status NOT NULL DEFAULT 'pending',
    raw_snapshot JSONB NOT NULL,
    summary JSONB NOT NULL, -- e.g. {"new_count": 2, "updated_count": 4, "delisted_count": 1}
    reviewed_by_admin_id UUID REFERENCES auth.users(id),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
```

### 3.3 `change_proposal_items`
Tracks individual item actions for cherry-picking:
```sql
CREATE TYPE proposal_action AS ENUM ('create', 'update', 'delist');
CREATE TYPE proposal_entity_type AS ENUM ('motorcycle', 'rate_tier', 'shop', 'inclusion', 'condition');
CREATE TYPE proposal_item_status AS ENUM ('pending', 'approved', 'rejected', 'applied');

CREATE TABLE public.change_proposal_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    proposal_id UUID NOT NULL REFERENCES public.change_proposals(id) ON DELETE CASCADE,
    entity_type proposal_entity_type NOT NULL,
    entity_id UUID, -- Existing entity ID if update/delist, null if create
    action proposal_action NOT NULL,
    original_data JSONB,
    proposed_data JSONB NOT NULL,
    status proposal_item_status NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
```

## 4. API Endpoints

1. `GET /api/agent/tasks` (Bearer `AGENT_API_KEY`)
   - Returns shops due for crawl sorted by `urgency_score = (NOW() - last_run_at) / tier_days DESC LIMIT :budget`.
   - Includes canonical brand IDs and known models for official naming guidance.
2. `POST /api/agent/change-proposals` (Bearer `AGENT_API_KEY`)
   - Accepts raw scraped snapshot (`shop_id`, bikes array, rates array, shop info).
   - Computes diff server-side and writes to `change_proposals` and `change_proposal_items`.
3. `POST /api/agent/tasks/:shop_id/status` (Bearer `AGENT_API_KEY`)
   - Reports crawler errors (bot block, site down) and advances `last_run_at` to prevent tight loops.
4. `POST /api/admin/change-proposals/:id/apply` (Admin session or `AGENT_API_KEY`)
   - Body: `{ item_ids: UUID[] }`
   - Executes approved mutations atomically across production tables.

## 5. Domain Rules & Safeguards

1. **Strict Canonical Model Naming**: No fuzzy matching. Exact match against existing shop inventory. New models preserve official manufacturer designations.
2. **Protected Geodata Boundary**: `provider_name`, `full_address`, `latitude`, `longitude`, and `place_id` are strictly immutable to prevent corruption of Google Maps alignment.
3. **Soft Deactivation**: Missing inventory is marked with `availability_status = 'unavailable'`. Hard deletes are forbidden.
4. **Zero-Drop Safeguard**: If an incoming snapshot returns 0 bikes for a shop with active inventory, server refuses to create a mass-delist proposal and flags for inspection.
5. **Verbatim Pricing**: Rates and tiers are recorded verbatim as advertised on the website without synthetic mathematical division.
