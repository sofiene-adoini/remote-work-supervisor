# Production Readiness — Configuration & Secrets Audit

Audit date: 2026-07-31. Working tree was clean (`git status`) at the time of writing.
Covers: hardcoded values, env-var coverage, repository hygiene, and packaging readiness.

## 1. Backend (Strapi, `backend/`)

### Already env-driven (good)
- `config/server.ts` — `HOST`, `PORT`, `APP_KEYS`, `WEBHOOKS_POPULATE_RELATIONS`.
- `config/database.ts` — full `DATABASE_*` family (postgres/mysql/sqlite).
- `config/admin.ts` — `ADMIN_JWT_SECRET`, `API_TOKEN_SALT`, `TRANSFER_TOKEN_SALT`, `ENCRYPTION_KEY`, `FLAG_*`.
- `config/plugins.ts` — `SESSION_COOKIE_SECURE`, `SMTP_HOST/PORT/USER/PASS/FROM`.
- `config/middlewares.ts` — CORS origin list from `CORS_ORIGIN` (comma-separated).
- `src/index.ts` — Socket.IO origins from `CORS_ORIGIN`.

### Hardcoded values to promote to `.env`
| Location | Constant | Current value |
| --- | --- | --- |
| `src/index.ts` | `OFFLINE_GRACE_MS` | `15_000` ms |
| `config/plugins.ts` | `accessTokenLifespan` | `60 * 60` (1 h) |
| `config/plugins.ts` | `maxRefreshTokenLifespan` / `idleRefreshTokenLifespan` | `7 * 24 * 60 * 60` (7 d) |
| `config/plugins.ts` | ratelimit `interval` / `max` | `60_000` / `5` |
| `config/plugins.ts` | SMTP `secure` | `false` (no `SMTP_SECURE` flag) |

### Gaps
- **`.env.example` missing SMTP block** — real `backend/.env` has `SMTP_HOST/PORT/USER/PASS/FROM`, but
  `backend/.env.example` stops at CORS. Must be added so new machines can configure email.
- `src/index.ts` bootstrap fallback `?? ['http://localhost:4200']` for Socket.IO origins; harmless in
  dev but should read a single FRONTEND/APP origin source of truth.
- Default seeded work policy values (workingDays, timezone `Africa/Tunis`, late tolerance 5 min, etc.)
  are hardcoded bootstrap defaults — acceptable, but document they are overridable via the policy CRUD.

## 2. Frontend (Angular, `frontend/`)

### Gaps
- **No `src/environments/` directory and no `fileReplacements` in `angular.json`** — the app cannot be
  built with different configs per environment.
- `src/app/core/constants/app.constants.ts` hardcodes:
  - `API_BASE_URL = 'http://localhost:1337'`
  - `API_BASE_PATH = '/api'`
  - `APP_NAME = 'Assas'`
- `proxy.conf.json` hardcodes `http://localhost:1337` (dev-only, fine to keep).
- **No app version constant** anywhere in the frontend.

### Branding (currently hardcoded, acceptable for single-product)
- `src/index.html` — `<title>Assas — The Guardian</title>`
- `shared/layouts/dashboard-layout/dashboard-layout.component.html` — logo + `Assas`
- `features/auth/pages/login-page.component.ts` — "Access your Assas dashboard."
- `styles/_design-tokens.scss` — comments only (cosmetic)

## 3. Desktop Agent (Electron, `agent/`)

### Hardcoded values to promote to config
| Location | Constant | Current value | Notes |
| --- | --- | --- | --- |
| `src/api/api.js` | `API_BASE_URL` | `http://localhost:1337/api` | **must be configurable** |
| `src/realtime/realtime-agent.js` | `SERVER_URL` | `http://localhost:1337` | **must be configurable** |
| `main.js` | `HEARTBEAT_MS` | `5 * 60 * 1000` | |
| `main.js` | `REFRESH_MS` | `55 * 60 * 1000` | |
| `src/tracking/agent-tracker.js` | `IDLE_THRESHOLD_MS` | `1 * 60 * 1000` | **test leftover** — production intent was 5 min |
| `src/tracking/agent-tracker.js` | `AUTO_BREAK_THRESHOLD_MS` | `2 * 60 * 1000` | **test leftover** — production intent was 15 min |
| `src/tracking/agent-tracker.js` | `CHECK_INTERVAL_MS` | `30 * 1000` | |
| `src/screenshots/agent-screenshot.js` | `CAPTURE_INTERVAL_MS` | `30 * 1000` | **test leftover** — production intent was 10 min |
| `src/auth/secure-storage.js` | service/file/fallback | `RemoteWorkSupervisor` / `device-credentials.json` / `~/.rws-agent` | fine |

> Note: the tracker/screenshot test modules expose `_setTestOverrides`, so the **production defaults
> themselves are currently the short test-era values**. This is the highest-priority agent fix.

### Runtime artifacts & hygiene
- Untracked runtime files at `agent/` root: `electron-err.log`, `electron-out.log` (covered by `*.log`),
  `logo.png` (**tracked**), `test-*.js` (two tracked, one ignored).
- `agent/build/` exists with a `node_modules` copy — not tracked (covered by `build` rule); should be
  removed locally and/or given an explicit ignore.
- No `electron-builder` config yet. `package.json` already has `electron` + `electron-builder` devDeps,
  productName should become the branded name.

## 4. Repository / GitHub safety

### Verified clean
- `.env` / `backend/.env` are **not tracked** (only `.env.example` variants are).
- No `.github` workflows exist (nothing dangerous auto-running).
- `docker-compose.yml` is fully `env`-driven.

### Hardening to apply
| Item | Status |
| --- | --- |
| `release/` (electron-builder output dir) | add to `.gitignore` |
| `agent/device-credentials.json` | add explicit ignore |
| `*.local` | add |
| `.agents/` (top-level dir present) | add |
| `agent/build/` | add explicit ignore |
| `agent/electron-*.log` | covered by `*.log` but add explicit entry for clarity |

## 5. Phase mapping
- Phase 2 (env vars): backend `.env.example` SMTP block + new `AGENT_*`/session vars; frontend environments.
- Phase 3 (config service): frontend environment-driven constants; agent `config` module + `agent/.env.example`.
- Phase 5 (agent constants): the two `localhost` URLs + intervals/thresholds from §3.
- Phase 6 (Electron Builder): `electron-builder.yml` + branded `productName`.
- Phase 4 (GitHub safety): `.gitignore` items in §4.
- Phase 8 (download card): needs env-driven `downloadUrl` + `version`.
