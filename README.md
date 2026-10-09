# Global Moto Rentals

A motorcycle rental directory for finding bikes and rental shops around the world. Search by location, model, category, and price, or get recommendations from an AI assistant.

**Live website:** [globalmotorentals.com](https://www.globalmotorentals.com/)

## Features

- Motorcycle search, rental-shop profiles, and pricing.
- AI-assisted recommendations and a Model Context Protocol (MCP) endpoint.
- Admin tools for managing listings, moderation, and analytics.

## Stack

Next.js (App Router), React, TypeScript, Tailwind CSS, Supabase (PostgreSQL and Auth), and OpenAI. Hosted on Vercel.

## Run locally

Requires Node.js 20.9+ and a Supabase project.

```bash
git clone https://github.com/MickRheault/rv2.git
cd rv2
npm ci
cp env.example .env.local
```

Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env.local`, and apply the migrations in `supabase/migrations` to your Supabase project.

```bash
npm run dev
```

Open [localhost:3000](http://localhost:3000). See [AI and MCP configuration](docs/publication-setup.md) for optional assistant setup.
