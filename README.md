# Remote Work Supervisor — IO-Watch

A full-stack remote-work monitoring and productivity platform. Employees run a lightweight **desktop agent** that tracks work sessions, breaks, and project activity in real time; **HR/Admin** get a live operational dashboard to manage teams, projects, overtime, alerts, and trusted devices — all built on a modern, role-aware stack.

```
┌───────────────────────────┐        ┌──────────────────────────┐
│  Desktop Agent (Electron) │        │  Angular Web App (SPA)   │
│  The Guardian             │        │  IO-Watch                │
│  - input/activity tracking│        │  Employee · HR · Admin   │
│  - screenshot analysis    │        │  - dashboards            │
│  - heartbeats / pairing   │        │  - projects / teams      │
│  - offline detection      │        │  - overtime / alerts     │
└─────────────┬─────────────┘        └────────────┬─────────────┘
              │ REST + Socket.IO                  │ REST + Socket.IO
              ▼                                   ▼
        ┌───────────────────────────────────────────────┐
        │        Strapi 5 API Server (:1337)            │
        │  sessions · breaks · projects · allocations   │
        │  teams · alerts · overtime · analytics · agent│
        └─────────────────────┬─────────────────────────┘
                              ▼
                       ┌──────────────┐
                       │  PostgreSQL  │
                       │   (Docker)   │
                       └──────────────┘
```

---

## Table of Contents

1. [Features](#features)
2. [Roles & Permissions](#roles--permissions)
3. [Technology Stack](#technology-stack)
4. [Repository Structure](#repository-structure)
5. [Getting Started](#getting-started)
6. [Configuration Reference](#configuration-reference)
7. [Desktop Agent](#desktop-agent)
8. [Key Workflows](#key-workflows)
9. [Real-time Events](#real-time-events)
10. [Scripts Reference](#scripts-reference)
11. [Security Notes](#security-notes)
12. [Testing](#testing)
13. [Troubleshooting](#troubleshooting)
14. [Documentation](#documentation)

---

## Features

### Employee

| Feature | Description |
| --- | --- |
| **Dashboard** | Live work-status widget (clocked in/out, on break, agent online), hours worked today and this week, clock-in time, current project, recent alerts, overtime summary. |
| **Time Tracking** | Overview, daily/weekly/monthly statistics and history, session timeline with breaks, analytics views, and company policy-aware progress. |
| **Clock In / Out** | One active session per day. Clock-out computes worked time, runs policy checks (daily max, minimum break), detects overtime, and closes open project allocations. |
| **Breaks** | Manual breaks with a reason; automatic breaks triggered after prolonged inactivity (auto-break). Break time accumulates toward session totals. |
| **Projects** | "My Projects" view of team and individually assigned projects with progress, estimated vs. worked hours, and per-project contribution share. |
| **Team Workspace** | Team roster with live presence (online / on break / offline), project workload, and contribution breakdown. |
| **Project Allocation** | Switch the project you are currently working on; allocations feed project hours and HR analytics. |
| **Overtime** | Review auto-detected overtime, submit justifications, track approval status. |
| **Alerts** | In-app notifications (policy warnings, idle detection, agent offline, suspicious screen activity) with read/unread state and period filters. |
| **Desktop Agent** | Download the Windows agent installer, generate a one-time pairing code, and manage your trusted devices. |

### HR / Admin

| Feature | Description |
| --- | --- |
| **Dashboard** | Company-wide counters: active/on-break/offline employees, hours today, pending overtime, unread alerts. |
| **Employees** | Searchable directory with pagination, CSV export, invites, profile editing, activation/suspension, termination (soft-delete) and restore, password reset (revokes devices), role management. |
| **Employee Detail** | Per-employee timeline: sessions, breaks, alerts, screenshot analyses, attendance, and date-range summaries. |
| **Teams** | Create/edit/delete teams, assign/remove members, designate team leaders, and manage unassigned employees. |
| **Projects** | Full project management: create, edit, reassign to a **team** or **individual employees**, deadlines, priorities, estimated hours, and per-employee contribution. |
| **Overtime** | Approve or reject employee overtime declarations with pending/submitted queues and statistics. |
| **Alerts** | System-wide alert center with period presets, team/member filters, and severity/type filtering. |
| **Trusted Devices** | View and revoke all paired agent devices, with OS, version, and last-seen information. |
| **Analytics** | Chart.js visualizations (daily and per-employee), CSV export, top productive/overtime employees, activity/break/monitor statistics. |
| **Company Work Policy** | Configure expected and maximum daily hours, minimum break, overtime thresholds, working days, and tolerances. |

### Desktop Agent ("The Guardian")

| Feature | Description |
| --- | --- |
| **Pairing** | One-time `RWS-XXXX-XXXX` code links the agent to an employee account; device trust lasts 90 days by default. |
| **Session control** | Clock in/out and start/end breaks directly from the system tray app. |
| **Activity tracking** | Global input listener (mouse/keyboard) detects idle and drives auto-break behavior. |
| **Screenshot analysis** | Periodic screen captures are diffed locally; repeated unchanged screens are flagged `suspicious` without any image leaving the machine. |
| **Heartbeat & refresh** | Keeps the device online and rotates access tokens automatically. |
| **Offline handling** | If the agent disconnects during an active session, the backend auto clock-outs after a short grace period. |

---

## Roles & Permissions

Three roles control access to the web app (seeded on first boot):

| Role | Access |
| --- | --- |
| **Employee** | Self-service: own dashboard, sessions, breaks, projects, overtime declarations, alerts, devices. |
| **HR** | Everything in HR/Admin: employees, teams, projects, overtime approvals, alerts, devices, analytics, work policy. |
| **Admin** | Everything HR has, plus the ability to invite and assign the `Admin` role itself. |

Authentication is JWT-based with an **httpOnly refresh cookie** (`rws_refresh`). Access tokens live ~1 hour; refresh tokens rotate and last up to 7 days. Public self-registration is disabled — users are invited by HR/Admin. Role guards apply on the frontend (route guards) and the backend (permissions + in-controller 403s).

---

## Technology Stack

| Layer | Technology |
| --- | --- |
| Web frontend | Angular 22, Angular Material, Lucide icons, Chart.js, ngx-toastr |
| API server | Strapi 5.50 (Node.js), custom controllers/routes, Socket.IO |
| Database | PostgreSQL 17 (Docker), `pg` driver |
| Desktop agent | Electron 43, `uiohook-napi`, `screenshot-desktop`, `pixelmatch`, `keytar`, `socket.io-client` |
| Email | Nodemailer SMTP provider |
| Runtime | Node.js >= 20 (Strapi) / Electron (agent) |

---

## Repository Structure

```
remote-work-supervisor/
├── backend/          # Strapi 5 API — REST + Socket.IO, auth, business logic
│   ├── src/api/      # Domain modules: session, break, project, team, alert,
│   │                 #   overtime-declaration, workspace, hr-analytics, agent, ...
│   └── src/extensions/users-permissions/   # Auth hardening (invite, policies)
├── frontend/         # Angular web application (Employee / HR / Admin)
├── agent/            # Electron desktop agent ("The Guardian")
│   ├── src/          # api, auth, tracking, screenshots, realtime, config, state
│   └── electron-builder.yml   # Windows installer packaging
├── docs/             # Security & production-readiness documentation
├── docker-compose.yml # PostgreSQL service
├── .env.example      # Root environment template
└── README.md
```

---

## Getting Started

### Prerequisites

- **Node.js** `>= 20` and `npm`
- **Docker** (for PostgreSQL)
- **Windows 10/11** (for the desktop agent)

### 1. Infrastructure — PostgreSQL

Copy the root template and set your values:

```bash
cp .env.example .env
```

Start the database:

```bash
docker compose up -d
```

The service exposes PostgreSQL on `localhost:5433` (container name `rws-postgres`).

### 2. Backend — Strapi API

```bash
cd backend
npm install
cp .env.example .env   # fill DATABASE_*, APP_*, SMTP_*, CORS_ORIGIN, etc.
npm run develop
```

The API is available at `http://localhost:1337`. Strapi's admin panel is at `http://localhost:1337/admin`. On first boot the server seeds the `Employee`, `HR`, and `Admin` roles and the default company work policy.

Verify health: `GET http://localhost:1337/_health` → `204`.

### 3. Frontend — Angular Web App

```bash
cd frontend
npm install
npm start              # ng serve → http://localhost:4200
```

Open `http://localhost:4200` and sign in. The Angular dev server proxies `/api` requests and Socket.IO connections to the backend.

### 4. Desktop Agent

**Development mode** (from source):

```bash
cd agent
npm install
npm start              # launches the Electron app
```

**Packaged installer** (Windows):

```bash
npm run dist           # electron-builder → agent/release/*.exe
```

Install the produced `IO-Watch Setup 1.0.0.exe`, then:

1. In the web app, open **Desktop Agent** (Employee) → **Generate Pairing Code**.
2. In the agent window, enter the code and click **Pair**.
3. The device appears under **Trusted Devices**; clock in from the agent or the web app to start tracking.

> The agent stores credentials in the OS keychain (`RemoteWorkSupervisor`) with a file fallback (`device-credentials.json`).

---

## Configuration Reference

### Root `.env` (Docker / shared)

| Variable | Purpose |
| --- | --- |
| `POSTGRES_DB` | Database name for the container |
| `POSTGRES_USER` | Database user |
| `POSTGRES_PASSWORD` | Database password (secret) |
| `POSTGRES_HOST` | Database host |
| `POSTGRES_PORT` | Database host port |
| `DATABASE_CLIENT` | `postgres` (or `sqlite`/`mysql`) |
| `DATABASE_HOST` / `DATABASE_PORT` | Backend database connection |
| `DATABASE_NAME` | Backend database name |
| `DATABASE_USERNAME` / `DATABASE_PASSWORD` | Backend credentials |
| `DATABASE_SSL` | `true`/`false` |
| `STRAPI_PORT` | Strapi dev port (default `1337`) |
| `NODE_ENV` | `development` or `production` |

### Backend `.env` (`backend/.env`)

In addition to the database settings above, the backend supports (see `backend/.env.example`):

| Variable | Default | Purpose |
| --- | --- | --- |
| `CORS_ORIGIN` | `*` (unset) | Comma-separated allowed web origins (credentials enabled). Set to your frontend origin, e.g. `http://localhost:4200` |
| `APP_KEYS` / `API_TOKEN_SALT` / `ADMIN_JWT_SECRET` / `JWT_SECRET` / `TRANSFER_TOKEN_SALT` | — | Strapi crypto secrets (generate in production) |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` | — | Nodemailer SMTP for invite/reset emails |
| `SESSION_ACCESS_TOKEN_LIFESPAN` | `3600` | Access-token TTL (seconds) |
| `SESSION_MAX_REFRESH_LIFESPAN` | `604800` | Refresh-token max lifetime (seconds) |
| `SESSION_IDLE_REFRESH_LIFESPAN` | `604800` | Idle refresh lifetime (seconds) |
| `OFFLINE_GRACE_MS` | `15000` | Agent-disconnect grace before auto clock-out |
| `AGENT_TRUST_DURATION_DAYS` | `90` | Device trust window |
| `AGENT_PAIR_CODE_TTL_SECONDS` | `60` | Pairing-code lifetime |
| `AGENT_PAIR_RATE_LIMIT_WINDOW_MS` / `AGENT_PAIR_RATE_LIMIT_MAX` | `60000` / `5` | Pairing-code rate limit |

### Frontend (`frontend/src/environments/`)

`environment.ts` (development) and `environment.prod.ts` (production) expose: `appName`, `appVersion`, `apiBasePath`, `apiBaseUrl`, `socketUrl`, and `agent.downloadUrl` / `agent.version` (used by the Desktop Agent download card). Production builds substitute these via Angular `fileReplacements`.

### Agent `.env` (`agent/.env`)

Optional; all values fall back to production defaults in `agent/src/config/config.js`. See `agent/.env.example`.

| Variable | Default | Purpose |
| --- | --- | --- |
| `AGENT_API_BASE_URL` | `http://localhost:1337/api` | Backend REST base |
| `AGENT_SERVER_URL` | `http://localhost:1337` | Backend Socket.IO origin |
| `AGENT_HEARTBEAT_MS` | `300000` (5 min) | Device heartbeat interval |
| `AGENT_REFRESH_MS` | `3300000` (55 min) | Access-token refresh interval |
| `AGENT_IDLE_THRESHOLD_MS` | `300000` (5 min) | Inactivity before "idle" |
| `AGENT_AUTO_BREAK_THRESHOLD_MS` | `900000` (15 min) | Inactivity before auto-break |
| `AGENT_CHECK_INTERVAL_MS` | `30000` (30 s) | Activity-check polling |
| `AGENT_CAPTURE_INTERVAL_MS` | `600000` (10 min) | Screenshot capture interval |

---

## Desktop Agent

### How it works

1. **Pairing** — the employee generates a one-time code; the agent exchanges it for a device identity, a refresh token, and an httpOnly cookie. Devices are trusted for 90 days by default and can be revoked at any time.
2. **Tracking** — a global input listener resets an "last activity" timestamp. Idle state and auto-break thresholds are configurable (see table above).
3. **Screenshot analysis** — captures are diffed against the previous capture (pixelmatch). Three consecutive near-identical captures produce a `suspicious` analysis record and a critical alert. Only **metadata** (`diffScore`, `isSuspicious`, `analysisStatus`) is sent to the server — never the images.
4. **Heartbeat & refresh** — keeps the device marked online and rotates the access token before it expires.
5. **Offline handling** — a dropped Socket.IO connection starts a grace timer; if the agent does not return, the backend closes the active session and raises an `agent_offline` alert.

### Testing with short intervals

For local testing only, set short values in `agent/.env` (e.g. `AGENT_AUTO_BREAK_THRESHOLD_MS=60000`, `AGENT_CAPTURE_INTERVAL_MS=60000`) and restart the agent. Remember that the **packaged installer** cannot read `agent/.env` (it looks inside the read-only `app.asar`); override thresholds there with real environment variables at launch:

```powershell
$env:AGENT_AUTO_BREAK_THRESHOLD_MS = "60000"
& "IO-Watch.exe"
```

---

## Key Workflows

### Sessions & breaks

- **Clock in** creates one active session per day (a second clock-in is rejected). Weekend work is flagged if the policy forbids it.
- **Clock out** completes the session, applies policy checks (daily max hours, minimum break), runs overtime detection, closes open project allocations, and notifies in real time.
- **Manual break** stores a reason; **auto-break** (`reason: auto-idle`) fires after prolonged inactivity and is marked `isAuto`.
- A **continuous-work monitor** (every 5 min) warns when elapsed work minus breaks exceeds `maximumContinuousWorkHours`.

### Projects & allocations

- Projects are assigned to a **team** or to **individual employees**. Employees see both kinds in their "My Projects" view, with badges distinguishing team vs. individual assignments.
- While a session is active, employees can **switch** the project they are working on; allocations accumulate `durationMinutes` and drive project hours and analytics.

### Overtime

- After clock-out, the backend compares worked time against the policy. Exceeding thresholds creates an overtime declaration (`detected`).
- The employee **submits** a justification (`submitted`), which HR/Admin **approves** or **rejects**. Cancellations are tracked too.

### Alerts

Alerts carry a type, severity (`info` / `warning` / `critical`), title, and message. Employees see their own; HR/Admin can browse, filter, and mark all as read. Examples: `clock_in`, `clock_out`, `idle_detected`, `auto_break`, `break_violation`, `overtime_alert`, `continuous_work_warning`, `agent_offline`, `suspicious_activity`.

---

## Real-time Events

Socket.IO keeps the web app and agent in sync (JWT-authenticated):

| Event | Direction | Meaning |
| --- | --- | --- |
| `session:status-changed` | server → web | Any employee clocked in/out or broke |
| `session:updated` | server → web | Session detail update (own room) |
| `alert:created` | server → web | New alert broadcast |
| `overtime:status-changed` / `overtime:detected` | server → web | Overtime lifecycle events |
| `project:allocation-changed` | server → web | Project allocation switched/stopped |
| `agent_online` / agent sockets | server ↔ agent | Presence and offline detection |

---

## Scripts Reference

| Location | Command | Purpose |
| --- | --- | --- |
| `backend/` | `npm run develop` | Start Strapi with hot reload |
| `backend/` | `npm run start` | Start in production mode |
| `backend/` | `npm run build` | Build the API server |
| `frontend/` | `npm start` | Serve the web app (dev, port 4200) |
| `frontend/` | `npm run build` | Production build |
| `frontend/` | `npm test` | Run unit tests (Vitest) |
| `agent/` | `npm start` | Launch the Electron agent (dev) |
| `agent/` | `npm run dist` | Build the Windows installer |
| `agent/` | `npm test` | Run agent test suites (auth, tracker, screenshot) |
| root | `docker compose up -d` | Start PostgreSQL |

---

## Security Notes

- JWT access token in memory/sessionStorage only; refresh token in an **httpOnly** cookie; automatic silent refresh on expiry.
- Password policy: ≥ 10 characters including a digit; changing the password **revokes all trusted devices**.
- Public registration disabled; login blocked for deactivated accounts; role allow-list on invites.
- Agent pairing is rate-limited; pairing codes are stored hashed (SHA-256), expire in 60 s, and are single-use.
- Screenshot analysis sends metadata only — never screen content.
- Secrets (`*.env`, `device-credentials.json`, installer artifacts) are gitignored.

See [`docs/auth-security-notes.md`](docs/auth-security-notes.md) for the full authentication/security design.

---

## Testing

- **Backend**: `npx tsc --noEmit` for type safety; endpoints verified via integration smoke tests.
- **Frontend**: `npm test` (Vitest + jsdom).
- **Agent**: `npm test` runs auth, tracker, and screenshot-analysis suites (`test-auth.js`, `test-tracker.js`, `test-screenshot-analysis.js`). Tracker/screenshot modules expose `_setTestOverrides` for isolated, fast tests.

---

## Troubleshooting

| Symptom | Likely cause / fix |
| --- | --- |
| `ECONNREFUSED` on the backend | PostgreSQL not running (`docker compose up -d`) or `.env` DB values wrong |
| Login fails with deactivated account | Account suspended; contact HR/Admin |
| Agent won't pair | Code expired (60 s) — regenerate; or device already trusted — rename/revoke it first |
| Auto-break never fires | You must be **clocked in**; threshold is 15 min by default — or `agent/.env` not read by the installed app (use env vars at launch) |
| Screenshot analysis never suspicious | Screen must be **static** for 3+ consecutive captures (~30 min at defaults) |
| No email sent | SMTP variables missing in `backend/.env` |
| Installer triggers SmartScreen | Installer is unsigned — choose "More info → Run anyway" |

---

## Documentation

- [`docs/auth-security-notes.md`](docs/auth-security-notes.md) — authentication & security design
- [`docs/production-readiness-report.md`](docs/production-readiness-report.md) — deployment/capacity verification and follow-ups
- [`docs/production-readiness-audit.md`](docs/production-readiness-audit.md) — configuration and hardening audit

---

© 2026 IO-Watch. All rights reserved.
