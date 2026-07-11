# Auth Feature — Security & Design Tradeoffs

This document records the security tradeoffs made while implementing the auth
feature, including where the refresh token / access JWT are stored and why, so
the design intent is explicit and future changes don't silently regress it.

## 1. Token storage strategy

### Tokens involved

| Token            | Lifetime                  | Lifetime owner            | Set by                |
| ---------------- | ------------------------- | ------------------------- | --------------------- |
| Access JWT       | 1 hour (`accessTokenLifespan`)  | In-memory + sessionStorage | Strapi `/auth/local`, `/auth/refresh`, `/auth/reset-password` JSON body (`jwt`) |
| Refresh token    | 7 days (`maxRefreshTokenLifespan`) | httpOnly cookie only      | Strapi sets `Set-Cookie: rws_refresh` when `x-strapi-refresh-cookie: httpOnly` is sent |

### Where each token lives client-side

**Access JWT — in-memory + `sessionStorage`.** The short-lived access token is held in
the `AuthService.accessToken` field (in-memory) and mirrored into `sessionStorage` so
a single page reload within the same tab can restore the session without an extra
round-trip. `sessionStorage` was chosen over `localStorage` for two reasons:

1. **Scope**: `sessionStorage` is partitioned per-tab and cleared on tab close. A
   forgotten login in a shared browser (e.g. library / kiosk) does not survive to the
   next user, unlike `localStorage` which persists indefinitely until explicitly
   cleared.
2. **XSS surface**: although still readable by XSS during the session, an attacker
   can only exfiltrate a token that will expire within the hour — not a 7-day bearer
   token.

**Refresh token — httpOnly cookie, never touched by JavaScript.** Strapi's
SessionManager (`jwtManagement: 'refresh'`) issues the refresh token as an httpOnly,
`SameSite=Lax` cookie named `rws_refresh` when the client sends
`x-strapi-refresh-cookie: httpOnly`. Because the cookie is `httpOnly`, JavaScript
running on the page cannot read it via `document.cookie`, so a successful XSS payload
cannot exfiltrate the long-lived refresh token — it can only ride it within the same
browser. This is the whole reason the access/refresh split exists.

### Why not `localStorage` for the access JWT

The original draft of this feature used `localStorage` for both the access JWT and
the refresh token. That was changed because:

- `localStorage` persists across tabs and across browser restarts, dramatically
  expanding the window in which an XSS payload can read a token. Combined with the
  refresh token also being in `localStorage`, that would have given a single XSS
  bug a 7-day-lifetime bearer credential — the worst-case scenario.
- Even with a separate refresh flow, putting the access JWT in `localStorage` lets
  an attacker keep making requests for the rest of the token's 1-hour lifetime even
  after the user has navigated away. In-memory storage caps that to "while the SPA
  is still loaded."

The tradeoff: a page reload now triggers a silent `/auth/refresh` round-trip
(one network request) before the user can make an authenticated call. That's the
deliberate cost of keeping the access token out of `localStorage`.

### Why not refresh token in `localStorage` at all

Spec required this. Even an opaque refresh token in `localStorage` is a 7-day bearer
credential readable by any XSS payload — worse than the access JWT, which at least
expires in an hour. The httpOnly cookie is the standard defence and lines up with
Strapi 5.50's built-in SessionManager, which is why we use it.

## 2. Silent refresh & retry

`authInterceptor` attaches `Authorization: Bearer <jwt>` and `withCredentials: true`
to outgoing requests. On a `401` (and the request is not itself an `/auth/*` call), it
calls `AuthService.refreshToken()`, which:

- POSTs to `/auth/refresh` with `withCredentials: true` so the browser auto-sends the
  `rws_refresh` cookie. The response includes a fresh access JWT and a rotated
  refresh cookie.
- Deduplicates concurrent refresh attempts via an in-flight `BehaviorSubject`-like
  flag (`refreshInFlight`). Multiple 401s in the same burst share one refresh call
  instead of racing each other.
- On success, the interceptor retries the original request exactly once.
- On failure (refresh cookie invalid/expired, network error), the interceptor forces
  `AuthService.logout()` — which POSTs `/auth/logout` to invalidate the cookie
  server-side, clears local state, and navigates to `/login`.

## 3. Logout

`AuthService.logout()` does **not** just clear local state — it POSTs to
`/auth/logout` (Strapi 5.50 built-in) with `withCredentials: true` so the server
revokes the refresh cookie. This means a logout on one device invalidates the
refresh token server-side; another tab that re-uses the same cookie will correctly
fail its next refresh attempt and be bounced to `/login`.

The local session (`sessionStorage` access JWT + cached user, and in-memory state)
is cleared in a `finalize()` so it happens whether the network call succeeds or
fails — a network failure during logout should not leave the user "logged in".

## 4. invite endpoint — privilege-escalation defence

The custom `POST /api/auth/invite` route (HR/Admin only, gated by the custom `isHR`
policy) resolves the `roleId` against the database and enforces an allowlist of
assignable role types:

- **HR inviter** may assign only `employee`, `manager`, or `hr`.
- **Admin inviter** may additionally assign `admin`.
- **`super-admin`** is hard-forbidden for everyone (it is Strapi's built-in admin
  role and must not be grantable via the Content API).

This closes a privilege-escalation hole where an HR user could previously create an
`Admin` or `super-admin` account. `teamId` is also validated to reference an
existing `Team` row, so a typo doesn't silently create a user with a dangling null
team or throw an unhelpful ORM error.

## 5. Password policy and rate limiting

- **Server-side password enforcement**: `config/plugins.ts` sets
  `validationRules.password = { minLength: 10, regex: /^(?=.*\d).{10,}$/ }`, which
  the built-in `resetPassword`/`register`/`changePassword` handlers honour. The
  invite handler separately asserts the generated temporary password satisfies the
  same regex before persisting (defense-in-depth, single source of truth shared via
  the `PASSWORD_PATTERN` const).
- **Login rate-limiting**: built-in `plugin::users-permissions.rateLimit` is
  configured to 5 requests per 60 seconds and applied by the plugin itself to
  `/auth/local`, `/auth/local/register`, `/auth/forgot-password`,
  `/auth/reset-password`. The `/auth/refresh` route is intentionally *not*
  rate-limited by the plugin in its default config; this is a flag for a future
  hardening pass if abuse becomes a concern (refresh tokens are bearer/cookie
  secrets so the attack surface is limited to holders of a valid token).

## 6. Inactive users

The `callback` (login) and `me` handlers short-circuit when `isActive === false`.
The built-in `refresh` handler does **not** re-check `isActive` — a long-lived
refresh token (7 days) issued before a user was deactivated will keep working until
it expires or the cookie is revoked via `/auth/logout`. This is a known limitation;
if instant deactivation-on-refresh is required, override the `refresh` handler like
`callback` and reject when `user.isActive === false`.

## 7. CORS & cross-origin cookie refresh

Cross-origin browser apps cannot send an httpOnly refresh cookie unless the server
echoes a specific origin (not `*`) AND `Access-Control-Allow-Credentials: true`.
`config/middlewares.ts` configures `strapi::cors` with `credentials: true` and an
origin allowlist driven by the `CORS_ORIGIN` env var. Local dev runs through the
Angular dev-server proxy (`proxy.conf.json` → `localhost:1337`), which makes the
cookie same-origin and skips CORS entirely; production deployments must set
`CORS_ORIGIN` to the web app's origin.

The Electron desktop agent does not go through the browser, so it doesn't need
CORS — refresh tokens travel through the cookie logic transparently.
`SESSION_COOKIE_SECURE` should be set `true` in production so the cookie is marked
`Secure` (otherwise `SameSite=Lax` cookies are not sent over plain HTTP, but the
cookie itself would still be set).

## 8. Known limitations / future hardening

- **No unit tests** for the auth flows (invite, inactive-user, refresh, retry-on-401).
  These are the highest-value business logic in the feature and should be covered.
- **No custom email templates** — relying on Strapi's defaults with the console
  email provider (acceptable per spec, but the reset-password email body is the
  generic English default and references the Strapi project name, not "Remote Work
  Supervisor").
- **No proactive token refresh** — refresh only happens on a 401. A pre-emptive
  refresh shortly before the access JWT expires (using `jwt-decode`, which is
  already a dependency but unused) would eliminate the occasional single failed
  request + retry round-trip on the first call after expiry.

## 9. Files touched / added

**Backend**
- `src/extensions/users-permissions/strapi-server.ts` — role-allowlist + teamId
  validation in `invite`; removed dead `passwordMeetsPolicy` export; the regex
  remains the single source of truth via `PASSWORD_PATTERN`.
- `config/middlewares.ts` — CORS configured for credentials + origin allowlist.
- `.env.example` — added `SESSION_COOKIE_SECURE` and `CORS_ORIGIN`.

**Frontend**
- `src/app/features/auth/services/auth.service.ts` — rewritten: in-memory + sessionStorage
  access JWT, real `/auth/refresh` implementation with concurrent-refresh deduplication,
  `logout()` calls backend `/auth/logout`.
- `src/app/core/interceptors/auth.interceptor.ts` — single-retry silent refresh on 401,
  with logout-on-failure.
- `src/app/core/guards/role.guard.ts` — unauthenticated users now redirect to `/login`.
- `src/app/features/auth/styles/auth-pages.scss` — WCAG-AA primary button (indigo on
  teal), 180ms page-enter animation, prefers-reduced-motion honored for the new
  animation.
- `src/styles/_design-tokens.scss` (new) — single source of truth for palette +
  typography tokens; `styles.scss` now `@use`s it.
- All four auth pages — `aria-describedby` + `id` on every error paragraph
  (login/forgot already had it; reset & set-initial now match).
- All four auth pages — `AutofocusDirective` wired on the primary input.
- `src/index.html` — Inter (400–700) and IBM Plex Mono (400/500) loaded from Google
  Fonts.
- Deleted unused `AuthFacadeService` and `AuthenticationService` duplicates.
