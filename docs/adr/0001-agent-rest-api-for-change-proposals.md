# REST API for Ingestion Change Proposals

External ingestion agents submit inventory and rate updates via dedicated Next.js REST API routes (`/api/agent/change-proposals`) rather than direct Supabase database connections or MCP. This keeps the database service role key private to the server, validates incoming payloads with Zod, and calculates diffs server-side into a staged change proposal queue.
