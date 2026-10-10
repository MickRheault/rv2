# Global Moto Rentals

<p align="center">
  <img src="public/images/og-default.jpg" alt="Global Moto Rentals Platform" width="100%">
</p>

AI-native motorcycle rental directory and fleet intelligence platform connecting riders, rental operators, and autonomous AI agents worldwide.

**[Visit Live Platform →](https://www.globalmotorentals.com/)**

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-blue?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?logo=typescript)](https://www.typescriptlang.org/)
[![MCP](https://img.shields.io/badge/MCP-Ready-purple)](https://modelcontextprotocol.io/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-emerald?logo=supabase)](https://supabase.com/)
[![OpenAI](https://img.shields.io/badge/OpenAI-Function_Calling-orange?logo=openai)](https://openai.com/)

---

## AI & Agent Infrastructure

Global Moto Rentals is built from the ground up to be fully operable by both human riders and autonomous AI agents.

### Model Context Protocol (MCP) Server

The platform implements an official Model Context Protocol server at `/api/mcp` using `mcp-handler`, exposing rich fleet data and management capabilities to any MCP-compliant AI client (such as Claude Desktop, Cursor, OpenAI Agents, or autonomous agent runtimes).

- **Standard Transports:** Native support for Server-Sent Events (SSE) and Streamable HTTP transports.
- **Dual-Tier Security:** Read-only exploration (`MCP_KEY_READ_ONLY`) and authenticated admin operations (`MCP_KEY_ADMIN`) verified via token headers or URL parameters.
- **Direct Server-Side Execution:** Internal TypeScript services execute tool calls directly against the database with zero external HTTP overhead.

#### Agent Tool Inventory

| Category | Tools | Capabilities |
| :--- | :--- | :--- |
| **Discovery** | `list_motorcycles`, `list_shops`, `list_brands`, `list_categories`, `list_locations` | Multi-parameter fleet search with automatic geographic and category name resolution (e.g. "Chiang Mai", "Scooter", price bounds). |
| **Inspection** | `get_motorcycle`, `get_shop`, `list_condition_types`, `list_features` | Deep inspection of specific vehicles, rental shop policies, insurance tiers, and included amenities. |
| **Fleet Operations** | `create_motorcycle`, `update_motorcycle`, `delete_motorcycle`, `create_shop`, `update_shop`, `delete_shop` | Programmatic fleet catalog management for verified shop managers and automated agents. |
| **Pricing & Policies** | `set_motorcycle_rate_tiers`, `set_motorcycle_conditions`, `set_shop_inclusions`, `set_shop_conditions` | Duration-based pricing tiers, mileage limits, and rental contract condition configuration. |

#### Connecting an AI Agent

Add Global Moto Rentals to your client configuration (e.g., `claude_desktop_config.json` or Cursor):

```json
{
  "mcpServers": {
    "global-moto-rentals": {
      "url": "https://www.globalmotorentals.com/api/mcp"
    }
  }
}
```

---

### Autonomous Agent Ingestion Pipeline (RideVault Engine)

To maintain fleet and pricing freshness across distributed rental operators, the platform features a scheduled agent ingestion pipeline:

- **Staged Change Proposals:** Automated ingestion agents submit batched additions, modifications, and delistings as structured `Change Proposals` and `Change Proposal Items` awaiting review or automated ingestion.
- **Zero-Drop Safeguard:** A circuit breaker mechanism that detects crawler blocking or structural page shifts, automatically halting proposals if a shop's active inventory drops to zero unexpectedly.
- **Anti-Starvation Urgency Scheduler:** Fixed crawl budgets prioritize tasks using a dynamic urgency score (`days_since_last_run / tier_cadence_days`), ensuring lower-cadence tiers (Tier 3) are never starved by high-frequency targets.
- **Canonical Model Matching:** Normalizes unstructured listing strings into standardized manufacturer model names and curated specifications.

---

### Conversational AI Rental Assistant

Integrated interactive assistant (`/ai-chat`) powered by OpenAI:

- Natural language intent parsing translates complex queries (e.g., *"Looking for an adventure bike in Chiang Mai under $35/day with ABS"*) into structured tool calls.
- In-chat interactive vehicle cards render real-time pricing, shop locations, direct contact links, and rental inclusions.
- Server-side access controls supporting both public discovery and authenticated deployment environments.

---

## Core Platform Features

- **Global Rental Directory:** Search by country, province, city, motorcycle brand, category, and price range.
- **Verified Pricing & Rate Tiers:** Verbatim source-of-truth pricing with duration discounts (daily, weekly, monthly).
- **Rental Shop Profiles:** Verified operator contact info, opening hours, terms, deposit requirements, and included gear.
- **SEO & Discoverability:** Automatic postbuild XML sitemaps (`next-sitemap`), OpenGraph preview generation, and schema.org structured data (JSON-LD) for rich search engine indexing.
- **Admin Moderation Workspace:** Staged change proposal review UI, crawler health monitoring, premium listing management, and analytics snapshots.

---

## Technical Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS |
| **AI Protocol** | Model Context Protocol (`mcp-handler`), OpenAI SDK |
| **Data & State** | Supabase (PostgreSQL, Row Level Security, Auth), Zustand, React Query |
| **Validation & Forms** | Zod, React Hook Form |
| **Testing** | Jest, React Testing Library (160+ unit and integration tests) |
| **Hosting & Analytics** | Vercel Edge Network, Vercel Web Analytics & Speed Insights |

---

## Architecture & Design Decisions

Architectural decisions and domain trade-offs are documented as [Architecture Decision Records (ADRs)](docs/adr/):

- [ADR 0001: Agent REST API for Change Proposals](docs/adr/0001-agent-rest-api-for-change-proposals.md)
- [ADR 0003: Server-Side Diff Calculation](docs/adr/0003-server-side-diff-calculation.md)
- [ADR 0004: Strict Canonical Model Naming](docs/adr/0004-strict-canonical-model-naming.md)
- [ADR 0008: Three-Tier Crawl Priority](docs/adr/0008-three-tier-crawl-priority.md)
- [ADR 0009: Relative Overdue Ratio Scheduling](docs/adr/0009-relative-overdue-ratio-scheduling.md)
- [ADR 0010: Verbatim Pricing Source of Truth](docs/adr/0010-verbatim-pricing-source-of-truth.md)

---

## Getting Started

### Prerequisites

- Node.js **20.9+**
- npm
- Supabase project

### Installation

```bash
git clone https://github.com/MickRheault/rv2.git
cd rv2
npm ci
cp env.example .env.local
```

### Environment Configuration

Configure `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
OPENAI_API_KEY=your-openai-api-key

# Optional MCP and AI Chat access secrets
MCP_KEY_READ_ONLY=your-read-key
MCP_KEY_ADMIN=your-admin-key
```

Apply database migrations:

```bash
# Apply migrations via Supabase CLI or Dashboard SQL editor
supabase db push
```

### Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

### Scripts

| Command | Purpose |
| :--- | :--- |
| `npm run dev` | Start development server |
| `npm test` | Run test suite (160+ unit/integration tests) |
| `npm run build` | Build production application and generate sitemaps |
| `npm run type-check` | Validate TypeScript types |
| `npm run lint` | Run ESLint check |
