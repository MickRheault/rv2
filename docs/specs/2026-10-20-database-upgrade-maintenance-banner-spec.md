# Spec: Global Top Scheduled Database Upgrade Maintenance Banner (#171)

## Problem Statement

When the database is undergoing maintenance or a quota reset window, live queries (such as location search and AI chat) can be temporarily unreachable for up to 24 hours. Blocking the entire site would hurt SEO and prevent visitors from viewing static/cached pages, while displaying no notice leaves users without context if a query fails.

## Solution

Add a non-blocking, accessible top announcement banner ([`components/common/MaintenanceBanner.tsx`](file:///Users/mick/workspace/personal/rv2/components/common/MaintenanceBanner.tsx)) rendered globally via [`components/common/AppLayout.tsx`](file:///Users/mick/workspace/personal/rv2/components/common/AppLayout.tsx) so it appears on the homepage (`/`), standard routes (`/search`, `/browse`, `/motorcycle`), and the standalone `/ai-chat` layout.

## Requirements & Design Decisions

1. **Banner Copy**:
   - Display the exact message:
     `"Scheduled Maintenance: We are currently upgrading our database infrastructure. Live search and AI chat may be temporarily unavailable for the next 24 hours."`
2. **Placement in [`components/common/AppLayout.tsx`](file:///Users/mick/workspace/personal/rv2/components/common/AppLayout.tsx)**:
   - On standard routes, render `<MaintenanceBanner />` immediately above `<Header />`.
   - On standalone `/ai-chat` routes, render `<MaintenanceBanner />` at the top of the `h-screen h-[100dvh] overflow-hidden flex flex-col` wrapper above `{children}` so the chat viewport remains `flex-1` without overflowing.
3. **Environment Variable Control (`NEXT_PUBLIC_MAINTENANCE_MODE`)**:
   - Active by default when `process.env.NEXT_PUBLIC_MAINTENANCE_MODE` is unset, empty, or any value other than `'false'` (case-insensitive, trimmed).
   - Setting `NEXT_PUBLIC_MAINTENANCE_MODE=false` hides the banner (`returns null`).
4. **Accessibility & Styling**:
   - Render with `role="status"` and `aria-live="polite"`.
   - Use high-contrast amber banner styling (`bg-amber-50 border-b border-amber-200 text-amber-900`) with a compact warning/info icon and responsive centered text.

## Testing Strategy & Seams

- **Unit Tests** ([`components/common/MaintenanceBanner.test.tsx`](file:///Users/mick/workspace/personal/rv2/components/common/MaintenanceBanner.test.tsx)):
  - Verify `MaintenanceBanner` renders the scheduled maintenance notice with `role="status"` and `aria-live="polite"` by default (when `NEXT_PUBLIC_MAINTENANCE_MODE` is unset or `'true'`).
  - Verify `MaintenanceBanner` renders nothing when `NEXT_PUBLIC_MAINTENANCE_MODE` is `'false'` or `' FALSE '`.
- **Layout Integration Tests** ([`components/common/AppLayout.test.tsx`](file:///Users/mick/workspace/personal/rv2/components/common/AppLayout.test.tsx)):
  - Verify `AppLayout` renders the maintenance banner on standard routes and on `/ai-chat` without breaking the standalone layout invariants.

## Implementation Tickets

- [ ] [#171: feat(ui): display global top scheduled database upgrade maintenance banner](https://github.com/MickRheault/rv2/issues/171)
