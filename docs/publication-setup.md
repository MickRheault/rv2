# Configuration after publication cleanup

## AI chat

The AI chat feature requires `OPENAI_API_KEY` on the server for AI responses. `AI_CHAT_ACCESS_SECRET` is an optional access lock, independent of the provider key. Neither variable should have a `NEXT_PUBLIC_` prefix.

- **Public chat:** Remove `AI_CHAT_ACCESS_SECRET` from the deployment environment (or leave it empty/whitespace-only). Open `/ai-chat` without an access code. The page and `/api/chat` both allow public access; old links containing a `secret` query parameter also work. Keep `OPENAI_API_KEY` configured.
- **Restricted chat:** Set a non-empty `AI_CHAT_ACCESS_SECRET`. Generate a new access code using `openssl rand -hex 32`; do not reuse the old committed code. Open `/ai-chat?secret=<your-access-code>`. The page sends the supplied code in the request's `Authorization: Bearer` header. Missing or incorrect credentials return HTTP 401 before calling OpenAI. Keep the URL private because it contains your access code.

Use your ignored `.env.local` for local development and the deployment environment for production. Restart the local server or redeploy the application after adding, changing, or removing the access secret. No additional flag or code change is needed to switch modes. The page reads the mode on each request and passes only an access-required boolean to the browser; the configured secret is never bundled into client JavaScript.

Populate `MCP_KEY_READ_ONLY` and `MCP_KEY_ADMIN` in your deployment environment with newly generated values if MCP is used. The example file deliberately contains no usable keys.

## Local development accounts

`supabase/seed.sql` no longer creates a personal administrator or embeds a password. The historical permissions migration no longer resets a personal account to a committed password. Use your local Supabase Studio to create a test user with a unique password, then assign its local `public.user_roles` entry as needed. Keep real account credentials and authentication exports outside Git. This source change does not reset or remove existing Supabase users; reset any live account that used the old seeded password separately.

## Import data

The importer scripts and category mapping remain tracked. Generated files under `.scripts/import-data/templated-data/` are untracked and ignored. Existing local files are preserved. On a fresh clone, place your private datasets under that directory before running an importer. Ignore rules do not remove these files from older commits; history cleanup is a separate step.
