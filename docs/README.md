# Gunzo Agency Platform — Developer Handover

Welcome. This documentation set is the primary onboarding path for engineers taking over the **Chatter Dashboard** (internal codename: `chatter-dashboard`) — the Gunzo Agency operations platform used by chatters, VAs, models, clients, and admin staff.

## Quick start

1. Read [01-overview.md](./01-overview.md) — stack, architecture, env vars.
2. Read [02-roles-permissions.md](./02-roles-permissions.md) — RBAC is enforced everywhere; mistakes here break nav and page access.
3. Skim [03-features/](./03-features/) for the area you will work on.
4. Bookmark [05-bug-patterns.md](./05-bug-patterns.md) before your first PR.

## Table of contents

### Core handover (this series)

| Doc | Contents |
|-----|----------|
| [01-overview.md](./01-overview.md) | Product purpose, tech stack, repo layout, deployment targets, environment variables |
| [02-roles-permissions.md](./02-roles-permissions.md) | System roles, custom roles, `resolveRolePermissions`, nav invariants, full permission list |
| [03-features/](./03-features/) | Feature-by-feature reference (files, Airtable tables, gotchas) |
| [04-integrations.md](./04-integrations.md) | Airtable, transcription service, TheOnlyAPI, Vercel Blob, Realtime, Cloudflare |
| [05-bug-patterns.md](./05-bug-patterns.md) | Recurring failure modes and how to avoid them |
| [06-development.md](./06-development.md) | Local dev, build/typecheck, scripts, conventions |
| [07-tech-debt.md](./07-tech-debt.md) | Known open issues and deferred work |

### Feature deep-dives

| Doc | Features covered |
|-----|------------------|
| [03-features/shifts-and-programs.md](./03-features/shifts-and-programs.md) | Shifts, shift queue, weekly program (chatter + VA), availability |
| [03-features/va-tasks.md](./03-features/va-tasks.md) | VA tasks, virtual projection, recurring spawn, phases, templates, statistics |
| [03-features/models-and-content.md](./03-features/models-and-content.md) | Models, schedules, live streams, content assignments, customs, periods |
| [03-features/whales-and-marketing.md](./03-features/whales-and-marketing.md) | Whales, marketing accounts, spot checks, daily review, research |
| [03-features/billing-and-clients.md](./03-features/billing-and-clients.md) | Client portal, billing cycles, payments, partnership, expense requests |
| [03-features/rewards-training-tools.md](./03-features/rewards-training-tools.md) | Rewards, challenges, spin wheel, SOP Academy, link pages, PDF maker, blur tool |

### Existing operational docs (still valid)

| Doc | Contents |
|-----|----------|
| [CLOUDFLARE_SETUP.md](./CLOUDFLARE_SETUP.md) | Cloudflare Pages + D1 auth setup |
| [DEPLOY_HANDOFF.md](./DEPLOY_HANDOFF.md) | Pre-deploy checklist, GitHub + Cloudflare steps |
| [TYPESCRIPT_IMPROVEMENT.md](./TYPESCRIPT_IMPROVEMENT.md) | Strict TypeScript progress tracker |

## Repository map (high level)

```
app/                  Next.js App Router — pages, API routes, server actions
components/           React UI (glass iOS-inspired design system)
services/             Server-only Airtable/domain logic ("use server" on many)
lib/                  Shared utilities: RBAC, nav, Airtable client, notifications
scripts/              One-off migrations, Airtable setup, audit scripts
workers/              Cloudflare cron workers (e.g. late-shift checks)
realtime/             Optional WebSocket worker + Durable Object
types/                Shared TypeScript types
.cursor/rules/        Agent rules for notifications + RBAC (follow when adding features)
```

## Golden rules

1. **Airtable is the business database.** Almost all domain data lives in one base (`AIRTABLE_BASE_ID`). The models table is named **`modelss`** (double s) — not `models`.
2. **Never expose `AIRTABLE_TOKEN` to the client.** All Airtable calls go through `lib/airtable-server.ts` from server components, route handlers, or `"use server"` modules.
3. **Use `hasPermission()` — never raw `user.role === "admin"`.** See `.cursor/rules/rbac.mdc`.
4. **New notification events require a 9-file checklist.** See `.cursor/rules/notifications.mdc`.
5. **Business calendar = Europe/Athens.** VA tasks, weekly programs, and spawn logic bucket dates in Athens (see `lib/airtable-datetime.ts`).
6. **Route paths live in `lib/routes.ts`.** Use `ROUTES.*` for links, redirects, and `revalidatePath`.

## Who to ask / where things live

| Concern | Primary files |
|---------|---------------|
| Auth / sessions | `lib/auth.ts`, `lib/session-token.ts`, `middleware.ts` |
| Permissions | `lib/permissions.ts`, `lib/rbac.ts`, `services/roles.ts` |
| Navigation | `lib/nav-config.ts`, `lib/routes.ts` |
| Notifications | `services/notification-service.ts`, `lib/notification-types.ts` |
| Airtable access | `lib/airtable-server.ts`, `lib/airtable-sanitize.ts` |

---

*Last updated: handover documentation commit — comprehensive project overview for new developers.*
