# Spec: Playful Motorcycle-Themed Rotating Status Messages for AI Chat Loading

**Date**: 2026-10-22
**Status**: Approved
**Issue**: [#185](https://github.com/MickRheault/rv2/issues/185)

## 1. Goal & Problem Statement
When a user asks a question in `/ai-chat`, the backend runs MCP tool calls and generates a response over ~5–10 seconds. Currently, the Assistant loading bubble only displays three silent bouncing dots, making the UI feel stalled during multi-second searches.

## 2. Requirements
1. **Loading Message Catalog & Cadence (`lib/chat/suggestions.ts`)**:
   - Export `AI_CHAT_LOADING_INTERVAL_MS = 2200`.
   - Export `AI_CHAT_LOADING_MESSAGES` using general motorcycle-themed phrases that fit any prompt context:
     1. `'Kickstarting the engine...'`
     2. `'Revving up the search...'`
     3. `'Scanning the garage...'`
     4. `'Dialing in your answer...'`
2. **Rotating Status Bubble in Chat UI (`app/ai-chat/chat-content.tsx`)**:
   - While `isLoading` is `true`, display the animated bouncing dots indicator alongside the active message from `AI_CHAT_LOADING_MESSAGES` inside the Assistant loading bubble (`role="status"`, `aria-live="polite"`).
   - Start at index `0` (`"Kickstarting the engine..."`) whenever `isLoading` becomes `true`, and advance through `AI_CHAT_LOADING_MESSAGES` every `AI_CHAT_LOADING_INTERVAL_MS` (2200ms), clamping at the final message (`"Dialing in your answer..."`) or cycling cleanly until `isLoading` becomes `false`.
   - Clean up the interval timer on unmount or when `isLoading` becomes `false`.
3. **Testing (`app/ai-chat/page.test.tsx`)**:
   - Verify that when a chat message is in-flight (`isLoading === true`), `"Kickstarting the engine..."` is displayed immediately inside the Assistant loading indicator.
   - Verify that advancing timers by `AI_CHAT_LOADING_INTERVAL_MS` rotates through `"Revving up the search..."`, `"Scanning the garage..."`, and `"Dialing in your answer..."`.
   - Verify that once the response resolves, the loading status message disappears and a subsequent request starts back at `"Kickstarting the engine..."`.
