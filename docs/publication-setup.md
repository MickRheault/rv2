# Configuration after publication cleanup

## AI chat

The OpenAI chat feature still uses `OPENAI_API_KEY` on the server. Its access code is now checked by `/api/chat` against `AI_CHAT_ACCESS_SECRET`, also on the server.

Set both values in your ignored `.env.local` for local development and in the deployment environment for production. Generate a new access code using `openssl rand -hex 32`; do not reuse the old committed code. Neither variable should have a `NEXT_PUBLIC_` prefix.

Open `/ai-chat?secret=<your-access-code>` as before. The page sends the supplied code in the request's `Authorization: Bearer` header. An incorrect code returns HTTP 401 without calling OpenAI. A missing server configuration returns HTTP 503. Keep the URL private because it contains your access code; the configured server value is never bundled into the browser JavaScript.

Populate `MCP_KEY_READ_ONLY` and `MCP_KEY_ADMIN` in your deployment environment with newly generated values if MCP is used. The example file deliberately contains no usable keys.

## Local development accounts

`supabase/seed.sql` no longer creates a personal administrator or embeds a password. Use your local Supabase Studio to create a test user with a unique password, then assign its local `public.user_roles` entry as needed. Keep real account credentials and authentication exports outside Git. This source change does not reset or remove existing Supabase users; reset any live account that used the old seeded password separately.

## Import data

The importer scripts and category mapping remain tracked. Generated files under `.scripts/import-data/templated-data/` are untracked and ignored. Existing local files are preserved. On a fresh clone, place your private datasets under that directory before running an importer. Ignore rules do not remove these files from older commits; history cleanup is a separate step.
