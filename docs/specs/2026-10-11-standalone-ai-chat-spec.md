# Spec: Standalone Full-Viewport AI Chat Experience

## Problem Statement

Currently, the AI Chat assistant at `/ai-chat` is embedded as an inline content card inside the standard global website layout (`app/layout.tsx`). As a result, the chat interface is constrained between the full marketing navigation header and the multi-section marketing footer. Users on both desktop and mobile encounter competing scroll containers, limited vertical canvas space (`h-[70vh]`), and visual clutter from unrelated marketing navigation. The conversational experience feels like an embedded widget rather than a dedicated, modern AI rental advisor (like ChatGPT or Claude).

## Solution

Transform `/ai-chat` into a dedicated, standalone conversational application that occupies 100% of the viewport (`100dvh`). The interface removes the global marketing header and footer, replacing them with a sleek, minimal application bar and an optional collapsible side drawer. Users have an expansive, focused chat canvas with a centered message stream, sticky bottom prompt bar, quick navigation back to the main rental fleet, and one-click session reset.

## User Stories

1. **Standalone Full-Screen Viewport**: As a rider, I want the AI chat page to occupy the full browser window without standard site headers or footers, so that I have a clean, distraction-free conversational experience.
2. **Minimal App Header**: As a rider, I want a minimal top bar with the Global Moto Rentals logo, a "← Back to Fleet" link, and a "New Chat" button, so that I can easily navigate back to the main site or restart my inquiry at any time.
3. **Collapsible Resource Sidebar**: As a rider, I want a collapsible sidebar containing quick links to top rental locations (Bangkok, Phuket, Chiang Mai, Bali), riding tips, and licensing guides, so that I can reference essential travel info without leaving the chat.
4. **Mobile Drawer Navigation**: As a mobile user, I want the sidebar to open as an accessible slide-over drawer, so that it doesn't crowd my phone screen while typing.
5. **Centered Message Canvas**: As a rider, I want the conversation stream to be centered with optimal reading width (`max-w-3xl`) and auto-scrolling, so that responses are easy to read and follow.
6. **Rich Interactive Responses**: As a rider, I want assistant messages to render rich markdown with bold bike models, prices, and clickable links to motorcycle listings and rental shop pages that open seamlessly.
7. **Pinned Bottom Prompt Box**: As a rider, I want a sticky input box at the bottom of the screen with quick suggestion chips on empty state, send on Enter, multiline support with Shift+Enter, and clear loading feedback while the assistant is querying tools.
8. **Direct Fleet Back-Links**: As a rider, I want one-click navigation links embedded throughout the chat to bring me directly to filtered city searches or motorcycle detail pages on the main platform.
9. **Access Protection Intact**: As the platform operator, I want the existing `AI_CHAT_ACCESS_SECRET` access code verification to remain fully functional within the standalone layout when enabled.

## Implementation Decisions

- **Dedicated Route Group / Layout Isolation**: Isolate `/ai-chat` using a custom Next.js layout (`app/ai-chat/layout.tsx` or route group `(chat)`) that bypasses the root header and footer, while retaining global providers (`QueryProvider`, `Analytics`).
- **Dynamic Viewport Height (`100dvh`)**: Use CSS `100dvh` for the root container to ensure smooth rendering on mobile devices with dynamic address bars and virtual keyboards.
- **Collapsible Sidebar Architecture**: State stored in local component state (or persisted in `localStorage`) toggling a 260px desktop drawer and a full-height overlay on mobile devices (`< 768px`).
- **Seamless Session Reset ("New Chat")**: Provide an explicit "New Chat" action that resets conversation state, cancels pending completions, and restores starter prompt pills without requiring a hard browser refresh.
- **Top Navigation Bar**: Fixed 56px top header:
  - Left: Sidebar toggle button + GMR Brand Logo & Beta badge.
  - Right: "New Chat" icon button + "← Back to Website" button.
- **Preserved API & Guardrail Boundary**: All existing backend routing (`POST /api/chat`), tool calling execution, question logging, and motorcycle domain guardrails remain 100% untouched.

## Testing Decisions

- **Component Tests**:
  - Test layout renders minimal header with back link and "New Chat" button.
  - Test sidebar toggle behavior (open/close) on desktop and mobile viewports.
  - Test "New Chat" button clears conversation history and resets to starter prompt suggestions.
  - Test access code prompt modal displays and functions when `accessRequired = true`.
- **E2E / Integration Checks**:
  - Verify back link navigates to `/`.
  - Verify markdown links to `/motorcycle/:id` and `/shop/...` render valid URLs.
  - Verify message submission sends query and renders assistant markdown stream.

## Out of Scope

- Multi-conversation persistent history stored in user accounts (deferred to future authenticated user dashboard).
- Voice audio input / speech-to-text (deferred to Phase 3).
- Direct in-chat booking checkout gateway (chat redirects to shop/motorcycle detail pages for booking).
