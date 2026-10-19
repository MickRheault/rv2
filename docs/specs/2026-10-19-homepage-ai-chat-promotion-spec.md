# Spec: Promote AI Chat on Homepage Hero with Location Search Switcher (#158)

## Problem Statement

Global Moto Rentals provides a dedicated full-viewport AI Chat assistant at `/ai-chat`, capable of searching motorcycles, comparing shops, and answering rider questions across Southeast Asia. However, `/ai-chat` is not discoverable from the homepage ([`app/page.tsx`](file:///Users/mick/workspace/personal/rv2/app/page.tsx)) or the global site header ([`components/common/Header.tsx`](file:///Users/mick/workspace/personal/rv2/components/common/Header.tsx)). Visitors landing on `/` only see the classic Country/City dropdown search ([`components/search/HeroSearchForm.tsx`](file:///Users/mick/workspace/personal/rv2/components/search/HeroSearchForm.tsx)).

## Solution

Promote the AI Chat assistant as the primary default discovery experience on the homepage hero while keeping classic Country/City location search one click away as an alternative tab:

1. **Homepage Hero Framing ([`app/page.tsx`](file:///Users/mick/workspace/personal/rv2/app/page.tsx))**:
   - Keep `"Where do you want to ride?"` as the main hero `<h1>` heading.
   - Add a concise subtitle beneath the heading promoting both the AI assistant and location search: `"Ask our AI rental assistant or browse motorcycles by country and city."`
2. **Homepage Hero Segmented Switcher ([`components/search/HeroDiscoveryCard.tsx`](file:///Users/mick/workspace/personal/rv2/components/search/HeroDiscoveryCard.tsx))**:
   - Render an accessible segmented tab bar (`role="tablist"`) inside the hero card with two tabs:
     - **"Ask AI"** (`role="tab"`, active by default, `aria-selected="true"`).
     - **"Search by Location"** (`role="tab"`, `aria-selected="false"`).
   - **Ask AI Tab Panel**:
     - Renders an accessible prompt form (`<textarea>` or `<input>` with associated label, IME-safe `Enter`-to-submit via [`lib/chat/keyboard.ts`](file:///Users/mick/workspace/personal/rv2/lib/chat/keyboard.ts) while allowing `Shift+Enter` newlines, and an explicit `"Ask AI"` submit button).
     - Displays the 4 starter suggestion chips (`"Find scooters in Bangkok"`, `"List adventure bikes in Chiang Mai"`, `"What brands are available?"`, `"Show me shops in Phuket"`), shared with `/ai-chat` via a single constant module ([`lib/chat/suggestions.ts`](file:///Users/mick/workspace/personal/rv2/lib/chat/suggestions.ts)) to avoid duplication.
     - Submitting a non-empty prompt or clicking any suggestion chip immediately navigates to `/ai-chat?q=<encodeURIComponent(prompt)>`.
   - **Search by Location Tab Panel**:
     - Renders [`HeroSearchForm`](file:///Users/mick/workspace/personal/rv2/components/search/HeroSearchForm.tsx) (supporting an `embedded` prop so it integrates seamlessly inside the shared hero card without redundant outer card chrome, while preserving standalone rendering when `embedded` is omitted).
3. **Auto-Submit Initial Query on `/ai-chat` ([`app/ai-chat/chat-content.tsx`](file:///Users/mick/workspace/personal/rv2/app/ai-chat/chat-content.tsx))**:
   - Read `searchParams.get('q')` in `ChatContent`.
   - When `q` is non-empty (after trimming) and access is permitted (`!accessRequired || Boolean(secret)`), automatically append the user message and dispatch `POST /api/chat` with `{ message: q.trim() }` once per initial query.
   - Guard with a ref so React StrictMode double-effects or re-renders do not send duplicate requests, and ensure clicking **"New Chat"** clears the conversation without re-sending the initial `q` parameter.
   - Preserve existing `AI_CHAT_ACCESS_SECRET` behavior (`accessRequired` blocks rendering and prevents auto-sending when `secret` is missing).
4. **Global Header Navigation ([`components/common/Header.tsx`](file:///Users/mick/workspace/personal/rv2/components/common/Header.tsx))**:
   - Add `{ name: 'AI Chat', href: '/ai-chat' }` to the header `navigation` list so users can reach `/ai-chat` from any page on both desktop and mobile menus.

## Requirements & Acceptance Criteria

1. **Hero Heading & Subtitle**:
   - `app/page.tsx` renders the `<h1>` `"Where do you want to ride?"` and the subtitle `"Ask our AI rental assistant or browse motorcycles by country and city."`.
2. **Segmented Switcher & Default AI Tab**:
   - `HeroDiscoveryCard` renders a `tablist` with `"Ask AI"` selected by default and `"Search by Location"` unselected.
   - Selecting `"Search by Location"` switches the active tab and displays the Country and City selectors from `HeroSearchForm`.
   - Selecting `"Ask AI"` switches back to the AI prompt form and starter suggestion chips.
3. **Homepage AI Prompt Submission & 1-Click Suggestion Chips**:
   - Submitting a typed query (via clicking the `"Ask AI"` submit button or pressing `Enter` without `Shift` when IME is not composing) calls `router.push('/ai-chat?q=...')` with the trimmed, URL-encoded query.
   - Pressing `Enter` while IME composition is active (`isComposing` or `keyCode === 229`) or pressing `Shift+Enter` does not submit the form.
   - Clicking any starter suggestion chip immediately calls `router.push('/ai-chat?q=...')` with that chip's prompt.
4. **`/ai-chat?q=...` Auto-Send & Access Control**:
   - Visiting `/ai-chat?q=Find%20scooters%20in%20Bangkok` when public (or with valid `?secret=...`) automatically displays the user message `"Find scooters in Bangkok"`, calls `POST /api/chat` once, and renders the assistant response.
   - Visiting `/ai-chat?q=Find%20scooters%20in%20Bangkok` when `accessRequired` is `true` and no `secret` is provided displays `"Access denied"` and does **not** call `fetch('/api/chat')`.
   - Clicking `"New Chat"` after an auto-sent `?q=...` query clears the messages and restores suggestion chips without re-submitting `q`.
5. **Global Header Navigation Link**:
   - `Header` renders an `"AI Chat"` link pointing to `/ai-chat` in the desktop navigation bar and inside the mobile menu when opened.

## Testing Strategy & Seams

- **Homepage & Hero Switcher Component Tests** (`components/search/HeroDiscoveryCard.test.tsx`):
  - Verify `"Ask AI"` tab is active by default and displays the prompt textarea, submit button, and all 4 suggestion chips.
  - Verify typing a prompt and submitting navigates to `/ai-chat?q=<encoded>`.
  - Verify `Enter` submits, `Shift+Enter` does not submit, and IME composing `Enter` (`isComposing: true` / `keyCode: 229`) does not submit.
  - Verify clicking a suggestion chip immediately navigates to `/ai-chat?q=<encoded>`.
  - Verify clicking `"Search by Location"` switches tabs, renders Country and City dropdowns (`HeroSearchForm`), and allows location search navigation.
- **AI Chat Auto-Send Tests** ([`app/ai-chat/page.test.tsx`](file:///Users/mick/workspace/personal/rv2/app/ai-chat/page.test.tsx)):
  - Verify `/ai-chat?q=...` automatically sends the initial prompt once and displays the user and assistant messages.
  - Verify `/ai-chat?q=...` does not send a request if `accessRequired` is true and `secret` is absent.
  - Verify clicking `"New Chat"` after an auto-sent `q` clears the conversation without re-sending `q`.
- **Header Navigation Tests** ([`components/common/Header.test.tsx`](file:///Users/mick/workspace/personal/rv2/components/common/Header.test.tsx)):
  - Verify `"AI Chat"` navigation link (`href="/ai-chat"`) renders in desktop nav and mobile menu.

## Out of Scope

- Embedding a multi-turn streaming chat log directly inside the homepage hero card (conversation happens in the dedicated full-viewport `/ai-chat` experience).
- Changing `POST /api/chat` backend model, tools, or `AI_CHAT_ACCESS_SECRET` server validation logic.

## Implementation Tickets

- [ ] [#158: feat(home): promote AI Chat on homepage hero with location search switcher and header nav link](https://github.com/MickRheault/rv2/issues/158)
