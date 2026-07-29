# 06 — Development Workflow

## Prerequisites

- **Node.js** ≥ 18 (`package.json` engines)
- **npm** ≥ 9
- Airtable personal access token with read/write to the Gunzo base
- Copy `.env.example` → `.env.local` and fill required vars

## Local development

```bash
npm install
npm run dev
```

Open http://localhost:3000

### Demo login (no D1)

Set in `.env.local`:

```
DEMO_LOGIN_EMAIL=admin@example.com
DEMO_LOGIN_PASSWORD=demo123
DEMO_LOGIN_ROLE=admin
```

Roles: `admin`, `manager`, `chatter`, `virtual_assistant`, `model`, `client`

When Airtable users exist with matching email/password, Airtable auth takes precedence.

## Build & typecheck

| Command | Purpose | Required? |
|---------|---------|-------------|
| `npm run typecheck` | Standard TS check (`tsc --noEmit`) | **Yes** — must pass for merge |
| `npm run typecheck:strict` | Stricter overlay (~629 errors) | Informational |
| `npm run typecheck:count` | Count strict errors | Informational |
| `npm run build` | Next.js production build | Before deploy |
| `npm run lint` | ESLint via `next lint` | Recommended |

### tsc vs build

- **`typecheck`** catches type errors faster (~seconds)
- **`build`** catches Next.js-specific issues (server/client boundaries, static generation, missing exports)
- Always run both before major releases

Strict mode progress: see [TYPESCRIPT_IMPROVEMENT.md](./TYPESCRIPT_IMPROVEMENT.md).

Pre-commit hook (Husky) runs `npm run typecheck`.

## Deployment

### Cloudflare Pages (primary documented path)

```bash
npm run pages:build    # OpenNext for Cloudflare
npm run deploy         # Build + deploy
npm run preview:cf     # Local preview
```

See [CLOUDFLARE_SETUP.md](./CLOUDFLARE_SETUP.md) and [DEPLOY_HANDOFF.md](./DEPLOY_HANDOFF.md).

### Vercel

```bash
npm run build
# Deploy via Vercel CLI or Git integration
```

Required for: Vercel Blob uploads, custom domain API for link pages.

### Cron worker

```bash
npm run cron:deploy    # late-shift worker
```

## Scripts directory

`scripts/` contains ~100 TypeScript utilities. Categories:

### Airtable setup & migration

| Script | Purpose |
|--------|---------|
| `setup-airtable.ts` | Initial base setup (`npm run setup:airtable`) |
| `fetch-airtable-schema.ts` | Dump schema (`npm run fetch:schema`) |
| `audit-airtable-schema.ts` | Validate schema (`npm run audit:airtable`) |
| `sync-airtable-role-options.ts` | Sync role slugs to Airtable selects |
| `setup-rbac-roles-table.ts` | Create roles table |
| `add-*-field.ts` | Add individual fields |
| `create-*-table.ts` | Create tables |

Run with: `npx tsx scripts/<name>.ts`

Most scripts load `.env` via `dotenv` — ensure Airtable creds are set.

### VA tasks / recurring

| Script | Purpose |
|--------|---------|
| `verify-recurring-spawn-fix.ts` | Spawn regression test |
| `cleanup-duplicate-recurring-tasks.ts` | Remove duplicate spawned rows |
| `audit-recurring-over-spawn.ts` | Detect over-spawning |
| `test-va-tasks-regression.ts` | Broader VA task tests |

### Notifications

| Script | Purpose |
|--------|---------|
| `verify-all-notifications.ts` | End-to-end notification verification |
| `test-notifications.ts` | Manual notification tests |
| `fix-notification-setup.ts` | Repair notification schema |

### Maintenance

| Script | Purpose |
|--------|---------|
| `find-unused-pages.ts` | Detect orphan pages (`npm run find:unused`) |
| `clear-stuck-live-streams.ts` | Fix stuck live stream statuses |
| `cleanup-orphaned-shift-models.ts` | Shift model link cleanup |

## Code conventions

### Routes

All paths in `lib/routes.ts`. Never hardcode `/admin/...` in components.

```typescript
import { ROUTES } from "@/lib/routes";
<Link href={ROUTES.admin.vaTasks}>
revalidatePath(ROUTES.va.tasks);
```

### Permissions

```typescript
import { PERMISSIONS } from "@/lib/permissions";
import { hasPermission, requireAdminRoute } from "@/lib/rbac";
```

See `.cursor/rules/rbac.mdc`.

### Services layer

- One Airtable table (or small group) per service file
- `const TABLE = "table_name"` at top
- `mapRecord()` function for Airtable → typed record
- `listAllRecords` for unbounded lists; `listRecords` with formula for scoped queries
- Pass `_caller: "service.function"` in list options for debug logging

### Server actions

Located in `app/actions/`. Pattern:

1. Get session
2. Check permission
3. Call service
4. `revalidatePath` affected routes
5. Return `{ success, error? }` or throw

### Components

- Server components by default in `page.tsx`
- Client components: suffix `-client.tsx`, add `"use client"`
- UI primitives in `components/ui/`

### Styling

Tailwind + glass design tokens. Mobile-first; test bottom nav at 375px width.

### Notifications

Follow `.cursor/rules/notifications.mdc` for new events.

### Git

- Pre-commit runs typecheck
- Do not commit `.env`, `.env.local`, or secrets
- Commit messages: conventional style (`fix:`, `feat:`, `docs:`)

## Testing

No comprehensive automated test suite. Reliance on:

- `npm run typecheck` + `npm run build`
- Manual QA on staging
- Scripts in `scripts/test-*.ts` and `scripts/verify-*.ts`
- CI: `.github/workflows/typecheck.yml`

When fixing VA tasks, recurring spawn, or notifications — run the relevant verify script.

## Debugging tips

| Issue | Approach |
|-------|----------|
| Airtable write fails | Check server logs for field name/type; see `lib/airtable-sanitize.ts` |
| Permission denied | Log `await getUserPermissions(user)`; check Roles UI + floor merge |
| Wrong date bucket | Log `ymdInAthens(due_date)` vs expected |
| Stale UI | Missing `revalidatePath`? Client missing `fetchSeqRef`? |
| Notification not sent | Run diagnostic at `/admin/notification-diagnostic` (requires `notifications:diagnostic` + `ENABLE_NOTIFICATION_TESTING` in prod) |

## Project layout quick reference

```
app/(dashboard)/admin/     Admin pages
app/(dashboard)/va/        VA-specific pages
app/(dashboard)/model/     Model portal
app/(dashboard)/client/    Client portal
app/api/                   REST endpoints
app/actions/               Server actions
services/                  Domain / Airtable logic
lib/                       Shared utilities
components/                React components
types/index.ts             Domain types
middleware.ts              Auth + link page routing
```

## Related

- [01-overview.md](./01-overview.md) — env vars
- [05-bug-patterns.md](./05-bug-patterns.md) — common pitfalls
- [07-tech-debt.md](./07-tech-debt.md) — known gaps
