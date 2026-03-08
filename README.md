# Chatter internal dashboard

Production-ready internal web app for your team: iOS-inspired black + pink glass UI, role-based access (admin, chatter, virtual assistant), and a single Airtable base as the main business data backend.

## Stack

- **Next.js** (App Router), **TypeScript**, **Tailwind CSS**
- **Auth**: Cloudflare D1 for users, sessions, and passwords (local dev: env-based demo user)
- **Data**: One Airtable base; all Airtable access is server-side only (token never exposed to the frontend)

## Single Airtable base

The app uses **one Airtable base**. All business data lives in these tables:

| Table | Purpose |
|-------|---------|
| `whales` | Whale profiles, assignment, spend, followups |
| `whale_transactions` | Transaction history per whale |
| `whale_activity` | Activity timeline per whale |
| `whale_tags` | Tags (name, color, description) |
| `users` | Staff (name, email, role, status, target hours) — auth identity is synced from D1 |
| `modelss` | Model records and current status (free/occupied, current chatter) |
| `weekly_program` | Weekly schedule (Mon–Sun) per staff |
| `shifts` | Chatting shifts and task shifts (chatter vs virtual assistant) |
| `shift_models` | Which modelss a chatter is in during a shift |
| `activity_logs` | App-wide audit log (login, shift start/end, model enter/leave, etc.) |
| `system_settings` | Key/value settings |
| `staff_task_types` | Task types for virtual assistants (mistakes, vault_cleaning, other) |
| `staff_hours_summary` | Optional cached hours summary |
| `notifications` | In-app and push notification records (per user) |
| `push_subscriptions` | Web Push subscriptions per user/device |
| `notification_preferences` | Per-user toggles (push, in-app, categories, quiet hours) |

The Airtable API token and base ID are read from environment variables and used only in server code (Server Components, Route Handlers, Server Actions). The frontend never sees them.

## Realtime in-app notifications

- **WebSockets**: A separate Cloudflare Worker + Durable Object (`realtime/`) manages live connections. Deploy it with `cd realtime && npx wrangler deploy` and set `NEXT_PUBLIC_REALTIME_WS_URL`, `REALTIME_BROADCAST_URL`, and the two secrets in the app and Worker.
- **Flow**: When a notification is created (Airtable + `notify()`), the server broadcasts the event to the Worker; the Worker pushes it to the right clients over WebSockets. The UI updates the bell count and list and shows an iOS-style glass toast. No polling.
- See `realtime/README.md` for deploy and local dev.

## Notifications

- **Settings → Notifications**: Each user can control push, in-app, category toggles, and quiet hours. Preferences are stored in `notification_preferences`.
- **Topbar bell**: Unread count, dropdown list, mark as read, and links to the related entity (whale, shift, etc.).
- **Flow**: When an event occurs (e.g. shift started, model taken), the app creates a record in `notifications`, loads `notification_preferences`, applies rules (mute_all, critical_only, category), then optionally sends push via `push_subscriptions`. Push delivery is stubbed (Web Push can be added with VAPID).
- **Default preferences**: When a user first opens Settings or when you create a new user, call `createDefaultPreferencesForUser(airtableUserId)` so they get a default `notification_preferences` row.

## Roles

- **Admin**: Full access; manage accounts, whales, weekly program, shifts, modelss, activity logs, hours, settings.
- **Chatter**: Own whales, own weekly program, start/end chatting shifts, enter/leave modelss during a shift.
- **Virtual assistant**: Own weekly program, start/end task shifts (with required shift type; task label required when type is “other”). No model enter/leave unless you add it later.

## Install and run locally

1. **Clone and install**
   ```bash
   npm install
   ```

2. **Environment variables**  
   Copy `.env.example` to `.env` and set at least:
   - `AIRTABLE_TOKEN` — Airtable personal access token  
   - `AIRTABLE_BASE_ID` — Airtable base ID (starts with `app...`)  
   For local demo login (no D1): `DEMO_LOGIN_EMAIL`, `DEMO_LOGIN_PASSWORD`, optional `DEMO_LOGIN_ROLE` (e.g. `admin`).

3. **Run**
   ```bash
   npm run dev
   ```
   Open http://localhost:3000 and sign in with the demo user.

## Build and typecheck

- **Production build:** `npm run build`
- **Type check:** `npm run typecheck`
- **Lint:** `npm run lint`

## Deploy to Cloudflare

1. **Build for Cloudflare Pages**  
   Use `npm run pages:build` (runs `npx @cloudflare/next-on-pages`). Configure your Pages project to use this build command and the output directory specified by next-on-pages.

2. **Set environment variables** in Cloudflare Pages → your project → Settings → Environment variables (Production):
   - **Required:** `AIRTABLE_TOKEN`, `AIRTABLE_BASE_ID`, `SESSION_JWT_SECRET` (min 32 characters; e.g. `openssl rand -base64 32`)
   - **Recommended:** `NEXT_PUBLIC_APP_URL` (your production URL, e.g. `https://your-app.pages.dev`)
   - **Optional:** `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` for push; Realtime vars (see `realtime/README.md`)

3. **Do not** rely on `DEMO_LOGIN_*` in production. Use D1 or another user store; see [docs/CLOUDFLARE_SETUP.md](docs/CLOUDFLARE_SETUP.md).

Full checklist and D1 setup: [docs/CLOUDFLARE_SETUP.md](docs/CLOUDFLARE_SETUP.md).

## Env vars (reference)

| Variable | Required | Description |
|----------|----------|-------------|
| `AIRTABLE_TOKEN` | Yes | Airtable personal access token |
| `AIRTABLE_BASE_ID` | Yes | Airtable base ID (starts with `app...`) |
| `SESSION_JWT_SECRET` | Yes (production) | Min 32 chars; sign session cookies. Omit in dev (uses fallback). |
| `NEXT_PUBLIC_APP_URL` | Recommended | Full app URL for PWA manifest and push |
| `DEMO_LOGIN_EMAIL` | No (dev) | Email for demo user when D1 not used |
| `DEMO_LOGIN_PASSWORD` | No (dev) | Password for demo user |
| `DEMO_LOGIN_ROLE` | No (dev) | Role: `admin`, `chatter`, or `virtual_assistant` |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | No | Web push (generate: `npx web-push generate-vapid-keys`) |
| `ADMIN_AIRTABLE_USER_IDS` | No | Comma-separated Airtable user IDs for admin notifications |
| D1 binding | Optional | Production auth; see Cloudflare setup |

## Project layout

- `app/` — App Router: login, dashboard layout, and all main pages (whales, weekly program, active shifts, task shifts, free modelss, hours, accounts, activity logs, settings).
- `components/` — Reusable UI (sidebar, topbar, glass cards, tables, modals).
- `services/` — Server-only Airtable services (whales, modelss, shifts, weekly-program, users, activity-logs, staff-task-types, hours).
- `lib/` — Airtable client, auth helpers, auth config, utils.
- `app/actions/` — Server actions (auth, shifts, model-session).
- `middleware.ts` — Protects non-public routes; redirects unauthenticated to `/login`.

All Airtable table names match the base; the models table is **modelss** (not `models`).
