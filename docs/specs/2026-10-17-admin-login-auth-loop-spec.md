# Spec: Resolve "Checking authentication..." Deadlock and Login Loop on `/admin/login` (#147)

## Problem Statement
When a user visits `/admin/login` after their session expires, switches tabs, or attempts to sign in again, the page hangs or loops on `"Checking authentication..."`.

Root-cause diagnosis identified four interacting defects:
1. **GoTrue Re-Entrant Lock Deadlock in `AdminAuthProvider.onAuthStateChange`**:
   - `@supabase/auth-js` (`GoTrueClient`) holds its internal `_acquireLock` while `await`ing `_notifyAllSubscribers(event, session)` during `_initialize() -> _recoverAndRefresh()`, `_onVisibilityChanged()`, and `_callRefreshToken()`.
   - `AdminAuthProvider` registered an `async` `onAuthStateChange` callback that directly `await`ed `getCurrentAdminUser()`, which called `supabase.auth.getUser()` and `supabase.auth.getSession()`. Those calls attempted to re-acquire `_acquireLock` and queued behind the outer `_notifyAllSubscribers` promise in `this.pendingInLock`, creating a deterministic cyclic promise deadlock.
   - Furthermore, `TOKEN_REFRESHED` was not skipped while `!initialized`, so returning with an expired access token deadlocked `initialize()` immediately and left `isLoading = true` (`"Checking authentication..."`) forever.
2. **Missing Initialization Safety Timeout in `AdminAuthProvider`**:
   - Unlike `AdminRoute` (which has a 10s safety timeout), `/admin/login` is a public admin page that bypasses `AdminRoute` and relies directly on `AdminAuthProvider.isLoading`. If `supabase.auth.getSession()` or a browser Web Lock (`navigator.locks`) stalls, `isLoading` remains `true` indefinitely and never reveals the login form.
3. **`AdminLoginPage` Full-Page Unmount on Post-Init `authLoading` Transitions & Silent Non-Admin Loop**:
   - Whenever `AdminAuthProvider` set `isLoading = true` after initial mount (e.g., on `SIGNED_IN`), `AdminLoginPage` hit `if (authLoading)` and unmounted the entire `<Card>` login form, flashing `"Checking authentication..."` and wiping local component state (`error`, `message`, `email`, `password`). If the signed-in user lacked the `'admin'` role, `user` resolved to `null` and `authLoading` returned to `false`, dumping the user back onto a blank login form with no error message.
4. **Redundant `getUser()` / `getSession()` Round-Trips in `lib/admin/auth.ts`**:
   - `getCurrentAdminUser()` called `supabase.auth.getUser()`, then called `getCurrentUserRole()`, which called `supabase.auth.getSession()` and `supabase.auth.getUser()` a second time before querying `user_roles`.

## Requirements & Design Decisions
1. **Non-Blocking `onAuthStateChange` & Pre-Init Event Guard (`components/admin/AdminAuthProvider.tsx`)**:
   - Skip all `onAuthStateChange` events while `!initialized` (`initialize()` is the sole authority for initial session resolution).
   - Never return a blocking Promise from `onAuthStateChange` that `await`s `supabase.auth.*` inside GoTrue's `_notifyAllSubscribers` lock; defer async admin role resolution via `setTimeout(..., 0)` (or microtask after callback return) and pass the event's `session` directly to `getCurrentAdminUser(session)`.
2. **Bounded Initialization Safety Timeout (`components/admin/AdminAuthProvider.tsx`)**:
   - Enforce a 5-second safety timeout (`ADMIN_AUTH_INIT_TIMEOUT_MS = 5000`) during `initialize()` so that if `supabase.auth.getSession()` or `getCurrentAdminUser()` stalls, `AdminAuthProvider` logs a warning, sets `user = null`, and transitions `isLoading` to `false` so `/admin/login` renders the Sign In form.
3. **Keep Login Form Mounted & Surface Non-Admin Sign-In Errors (`app/admin/login/page.tsx`)**:
   - Track whether initial auth check has settled (`hasCompletedInitialCheck`) so `AdminLoginPage` only shows the full-screen `"Checking authentication..."` spinner before the login form is first shown—never unmounting the form during `handleSignIn` or subsequent auth events.
   - In `handleSignIn`, after `supabase.auth.signInWithPassword` succeeds, verify admin privileges via `refreshAuth(data.session)`. If the signed-in user is a valid admin, redirect to `/admin`; otherwise, sign out the non-admin session and display a clear error alert (`"Access denied: this account does not have administrator privileges."`).
4. **Reuse Provided `Session` in `getCurrentAdminUser` & `getCurrentUserRole` (`lib/admin/auth.ts`)**:
   - Allow `getCurrentAdminUser(sessionOverride?)` and `getCurrentUserRole(sessionOverride?)` to use a caller-supplied `Session` (and its `session.user` / `session.access_token`) without redundantly calling `supabase.auth.getSession()` or `supabase.auth.getUser()`.

## Testing Strategy & Seams
- **Integration Test Seam (`components/admin/AdminAuthProvider.test.tsx`)**:
  - Verify `AdminAuthProvider` + `AdminLoginPage` does not deadlock on `"Checking authentication..."` when GoTrue emits `TOKEN_REFRESHED` or `SIGNED_IN` while holding its internal `_acquireLock`.
  - Verify `AdminAuthProvider` falls back to rendering the login form (`isLoading = false`) after the 5s initialization timeout if `supabase.auth.getSession()` hangs.
  - Verify signing in on `AdminLoginPage` keeps the form mounted, redirects to `/admin` for admin users, and displays a clear error alert (without looping on `"Checking authentication..."`) when a signed-in user lacks admin privileges.
