# Spec: Enforce Relative URLs and Prevent Hallucinated Domains in AI Chatbot Links (#167)

## Problem Statement

The AI chatbot (`/ai-chat` backed by `POST /api/chat`) occasionally generates broken external URLs with a hallucinated domain such as:

```text
https://www.globalmoto.com/motorcycle/474ae1b4-c952-42ef-b5d3-b84ef9020898
```

`globalmoto.com` is not Global Moto Rentals' domain (`globalmotorentals.com`). This happens for three reasons:
1. **`SYSTEM_PROMPT` in [`app/api/chat/route.ts`](file:///Users/mick/workspace/personal/rv2/app/api/chat/route.ts) lacks an explicit relative-URL constraint and canonical domain declaration**: The prompt introduces the bot as *"You are a helpful assistant for Global Moto Rentals (GMR)"* and asks for `[Model Name](url)` and `[Shop Name](url)`. Because LLMs frequently attempt to convert relative paths (`/motorcycle/<id>`) into absolute `https://...` URLs in Markdown, the model guesses `https://www.globalmoto.com` from the brand name.
2. **`get_motorcycle` and `get_shop` in [`lib/mcp/tools.ts`](file:///Users/mick/workspace/personal/rv2/lib/mcp/tools.ts) omit `url` and `shopUrl`**: While `list_motorcycles` and `list_shops` include `url` and `shopUrl` fields in their formatted output, `get_motorcycle` and `get_shop` return raw service records without `url` or `shopUrl`, leaving the LLM to construct URLs on its own when those tools are called.
3. **No client-side link normalization in [`app/ai-chat/chat-content.tsx`](file:///Users/mick/workspace/personal/rv2/app/ai-chat/chat-content.tsx)**: `<ReactMarkdown>` renders `href` values verbatim, so if the LLM prepends an external or hallucinated domain onto an internal `/motorcycle/...` or `/shop/...` path, clicking the link navigates to a dead external domain.

## Requirements & Solution

1. **Harden `SYSTEM_PROMPT` in [`app/api/chat/route.ts`](file:///Users/mick/workspace/personal/rv2/app/api/chat/route.ts)**:
   - Explicitly instruct the model to keep all motorcycle (`url`) and shop (`shopUrl` / `url`) links as exact relative paths starting with `/` (e.g. `/motorcycle/{id}` and `/shop/{country}/{city}/{slug}`) as supplied by the tool results.
   - Explicitly forbid prepending any scheme or domain name (such as `https://www.globalmoto.com` or `https://globalmoto.com`) to motorcycle or shop URLs.
2. **Include Canonical Relative `url` and `shopUrl` in `get_motorcycle` and `get_shop` ([`lib/mcp/tools.ts`](file:///Users/mick/workspace/personal/rv2/lib/mcp/tools.ts))**:
   - In `executeTool('get_motorcycle')`, include `url: \`/motorcycle/\${motorcycle.id}\`` and `shopUrl` (computed via `getShopUrl(motorcycle.rental_shops)` when shop slug, city, and country are present, matching `list_motorcycles`).
   - In `executeTool('get_shop')`, include `url` (computed via `getShopUrl(shop)` or `/shop/${shop.slug || shop.id}` fallback, matching `list_shops`).
3. **Normalize Internal `/motorcycle/...` and `/shop/...` Markdown Links in [`app/ai-chat/chat-content.tsx`](file:///Users/mick/workspace/personal/rv2/app/ai-chat/chat-content.tsx)**:
   - Add a link normalization helper (e.g. `normalizeChatHref(href?: string)`) used by the `<ReactMarkdown>` custom `a` component.
   - When `href` is an absolute `http:` or `https:` URL whose pathname begins with `/motorcycle/` or `/shop/`, strip the origin and render the relative path (`pathname + search + hash`) so internal resource links always resolve on the current host across local, preview, and production environments.

## Testing Strategy & Seams

- **Prompt Invariants (`app/api/chat/route.test.ts`)**:
  - Verify `SYSTEM_PROMPT` instructs the model to use relative `/motorcycle/...` and `/shop/...` paths and never prepend a domain or invent `globalmoto.com`.
- **Tool URL Output (`__tests__/lib/mcp/tools.test.ts` or `app/api/chat/route.test.ts`)**:
  - Verify `executeTool('get_motorcycle', { id })` returns `url: "/motorcycle/<id>"` and `shopUrl` (when shop location/slug data is present).
  - Verify `executeTool('get_shop', { id })` returns `url` with the canonical relative shop path.
- **Client Markdown Link Normalization (`app/ai-chat/page.test.tsx`)**:
  - Verify that assistant Markdown containing `https://www.globalmoto.com/motorcycle/474ae1b4-c952-42ef-b5d3-b84ef9020898` and `https://www.globalmoto.com/shop/thailand/bangkok/mikes-rentals` renders `<a>` elements with `href="/motorcycle/474ae1b4-c952-42ef-b5d3-b84ef9020898"` and `href="/shop/thailand/bangkok/mikes-rentals"`.

## Implementation Tickets

- [ ] [#167: fix(chat): enforce relative URLs and prevent hallucinated domains in AI chatbot links](https://github.com/MickRheault/rv2/issues/167)
