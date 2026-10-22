# Spec: Shorten AI Chat Input Placeholder for Single-Line Mobile View

**Date**: 2026-10-22
**Status**: Approved
**Issue**: [#182](https://github.com/MickRheault/rv2/issues/182)

## 1. Goal & Problem Statement
The AI chat textbox placeholder (`"Ask about motorcycles, shops, or locations..."`, 45 characters) wraps onto 2 lines on mobile viewports in both `/ai-chat` (`app/ai-chat/chat-content.tsx`) and the homepage AI chat discovery card (`components/search/HeroDiscoveryCard.tsx`, which also sets `rows={2}`).

## 2. Requirements
1. **Shared Concise Placeholder Constant (`lib/chat/suggestions.ts`)**:
   - Export `AI_CHAT_INPUT_PLACEHOLDER = 'Ask about bikes or shops...'` from `lib/chat/suggestions.ts`.
2. **Update AI Chat Input Textboxes (`app/ai-chat/chat-content.tsx`, `components/search/HeroDiscoveryCard.tsx`)**:
   - Use `AI_CHAT_INPUT_PLACEHOLDER` (`"Ask about bikes or shops..."`) for `placeholder` and `aria-label` / `<label>` in both `app/ai-chat/chat-content.tsx` and `components/search/HeroDiscoveryCard.tsx`.
   - Set `rows={1}` on the `<textarea>` in `components/search/HeroDiscoveryCard.tsx` so the textbox starts as a single line on mobile viewports.
3. **Testing (`app/ai-chat/page.test.tsx`, `components/search/HeroDiscoveryCard.test.tsx`)**:
   - Update unit tests to verify the shortened placeholder (`"Ask about bikes or shops..."`) and single-row (`rows={1}`) configuration.
