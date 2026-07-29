# 01 — Project Overview

## What this is

**Gunzo Agency Platform** (package name: `chatter-dashboard`) is an internal web application for a creator-management agency. It coordinates:

- **Chatters** — OF chatting shifts, whale management, weekly schedules
- **Virtual assistants (VAs)** — task shifts, VA tasks with phased checklists, content assignments, marketing support
- **Models** — availability, content calendar, custom requests, live streams
- **Clients** — billing visibility, payment submissions, content delivery
- **Admin / managers** — full operational oversight, RBAC, billing, QA workflows

The UI is an iOS-inspired dark glass design (black + pink accents), mobile-first with role-specific bottom navigation.

Production URL: typically `https://gunzoteam.com` (`NEXT_PUBLIC_APP_URL`).

## Tech stack

| Layer | Technology |
|-------|------------|
| Framework | **Next.js 14** (App Router), **React 18**, **TypeScript** |
| Styling | **Tailwind CSS**, Radix UI primitives, Framer Motion |
| Data | **Airtable** (primary database — one base) |
| Auth | JWT session cookies (`SESSION_JWT_SECRET`); optional **Cloudflare D1** for production user store |
| File uploads | **Vercel Blob** (`@vercel/blob`) for proofs, feedback screenshots, link page assets |
| Push | Web Push via `@block65/webcrypto-web-push` + VAPID keys |
| Realtime | Optional Cloudflare Worker + Durable Object (`realtime/`) for live notification delivery |
| Deploy | **Cloudflare Pages** via `@opennextjs/cloudflare`; also runs on **Vercel** in practice (Blob, domains API) |
| Cron | Cloudflare Workers (`workers/cron-late-shifts/`) + in-app cron route handlers |

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Browser (PWA-capable)                                       │
│  React client components + SWR for client refetch            │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTPS
┌──────────────────────────▼──────────────────────────────────┐
│  Next.js (middleware.ts → session JWT verify)                │
│  ├── app/(dashboard)/**/page.tsx  — Server Components        │
│  ├── app/api/**/route.ts          — Route Handlers           │
│  └── app/actions/*.ts               — Server Actions           │
└──────────────────────────┬──────────────────────────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        ▼                  ▼                  ▼
   Airtable API      Vercel Blob        External APIs
   (all business    (files)            (TheOnlyAPI, transcribe
    data)                               service, Vercel domains)
```

### Request flow

1. `middleware.ts` verifies the session cookie (except public paths: `/login`, `/l/*` link pages, `/api/l/*`, static assets).
2. Dashboard layout loads nav via `getNavItemsForUser()` — filters by role, permissions, and hidden-nav settings.
3. Pages call `services/*` modules or `app/actions/*` for mutations.
4. Side effects: Airtable writes, `revalidatePath`, `notify()` for notifications, optional WebSocket broadcast.

### Server vs client boundaries

- **`services/`** — Domain logic. Many files have `"use server"` at the top (Next.js server action modules). Do not import these from client components unless they are only called as server actions.
- **`lib/`** — Pure utilities + RBAC + Airtable client. Some libs are server-only (`airtable-server.ts`).
- **`components/*-client.tsx`** — Client components with local state, SWR, optimistic UI.

## Key directories

| Path | Purpose |
|------|---------|
| `app/(auth)/login/` | Login page |
| `app/(dashboard)/` | All authenticated routes (admin, chatter, VA, model, client paths) |
| `app/l/[slug]/` | Public link-in-bio pages |
| `app/api/` | REST endpoints (transcription, webhooks, cron triggers, uploads) |
| `app/actions/` | Server actions grouped by domain |
| `services/` | Airtable CRUD and business rules (~80 modules) |
| `lib/permissions.ts` | Permission constants + default role grants |
| `lib/nav-config.ts` | Sidebar / mobile nav (single source of truth) |
| `lib/routes.ts` | All route path constants |
| `lib/notification-*.ts` | Notification event types, routing, schema |
| `scripts/` | Airtable migrations, audits, seeds (~100 scripts) |
| `types/index.ts` | Shared domain types |
| `.cursor/rules/` | RBAC + notification checklists for AI/human contributors |

## Environment variables

Copy `.env.example` → `.env.local` (or `.env`) for local development. **Never commit real secrets.**

### Required

| Variable | Description |
|----------|-------------|
| `AIRTABLE_TOKEN` | Airtable personal access token with base read/write |
| `AIRTABLE_BASE_ID` | Base ID (`app…`) |
| `SESSION_JWT_SECRET` | Min 32 chars for HS256 JWT signing. Required in production. |

### Local development (no D1)

| Variable | Description |
|----------|-------------|
| `DEMO_LOGIN_EMAIL` | Fallback login when no D1/Airtable user match |
| `DEMO_LOGIN_PASSWORD` | Demo password |
| `DEMO_LOGIN_ROLE` | `admin`, `chatter`, `virtual_assistant`, etc. |

### Recommended production

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_APP_URL` | Canonical app URL for PWA manifest, push, email links |

### Optional integrations

| Variable | Description |
|----------|-------------|
| `THE_ONLY_API_KEY` | TheOnlyAPI — OF subscriber sync (`services/of-sync.ts`) |
| `ONLYAPI_WEBHOOK_SECRET` | Validates `POST /api/webhooks/onlyapi` |
| `TRANSCRIBE_SERVICE_URL` | External transcription HTTP service base URL |
| `TRANSCRIBE_SERVICE_API_KEY` | API key sent as `X-API-Key` header |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | Web Push |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob for uploads |
| `VERCEL_TOKEN` / `VERCEL_PROJECT_ID` / `VERCEL_TEAM_ID` | Auto-connect custom domains for link pages |
| `ADMIN_AIRTABLE_USER_IDS` | Comma-separated Airtable user record IDs for admin alerts |
| `NEXT_PUBLIC_REALTIME_WS_URL` | WebSocket URL for live notifications |
| `REALTIME_BROADCAST_URL` / `REALTIME_BROADCAST_SECRET` | Server → Worker broadcast |
| `REALTIME_JWT_SECRET` | WS auth |
| `D1_DATABASE_ID` | Cloudflare D1 binding for auth backend |
| `ENABLE_NOTIFICATION_TESTING` | Enables `/admin/test-notifications` in production |

See [04-integrations.md](./04-integrations.md) for integration details.

## Deployment

The repo supports **two deployment paths**:

1. **Cloudflare Pages** (documented in `docs/CLOUDFLARE_SETUP.md`, `docs/DEPLOY_HANDOFF.md`)
   - Build: `npm run pages:build` (OpenNext for Cloudflare)
   - Deploy: `npm run deploy` or CI to Pages

2. **Vercel** (used for Blob storage, custom domains, and some production hosting)
   - Build: `npm run build`
   - Env vars mirror Cloudflare list; Blob token required for file features

Cron jobs: deploy `workers/cron-late-shifts` separately (`npm run cron:deploy`). Additional cron logic runs via authenticated API routes called by external schedulers.

## Timezone convention

All schedule-facing features use **Europe/Athens** calendar bucketing:

- `ymdInAthens(iso)` — bucket UTC ISO datetime to `YYYY-MM-DD` in Athens
- `getVaTasksViewTodayYmd()` — "today" for VA task date navigation
- Weekly program `week_start` normalized to Monday (Athens)

**Important:** The codebase uses a simplified **UTC+3 year-round** offset for some helpers (`getNowInAthens`) while `ymdInAthens` uses proper IANA `Europe/Athens`. When debugging date bugs, check which function a feature uses.

## Models table naming

The Airtable table for creator profiles is **`modelss`** (intentional double-s). Code references:

- `services/modelss.ts` — CRUD
- Billing links `billing_cycle_revenues.model` → `modelss`

Do not rename to `models` without a coordinated Airtable migration.

## Related reading

- [02-roles-permissions.md](./02-roles-permissions.md)
- [06-development.md](./06-development.md)
- [CLOUDFLARE_SETUP.md](./CLOUDFLARE_SETUP.md)
