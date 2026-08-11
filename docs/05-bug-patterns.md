# 05 — Known Recurring Bug Patterns

Patterns observed repeatedly in production and during development. Read this before debugging "it works locally but not in prod" or "the UI shows stale/wrong data."

---

## 1. `"use server"` files importing other `"use server"` files

Many `services/*.ts` files start with `"use server"`. Next.js treats the entire module as server-action surface area.

### Symptoms

- Unexpected bundler errors about client/server boundaries
- Functions unintentionally exposed as callable server actions
- Circular import failures between service modules

### Mitigation

- Pure read/logic modules that don't need to be actions should **omit** `"use server"` when possible
- When splitting code, put shared logic in `lib/` without `"use server"`
- Before adding `"use server"` to a new file, check if it's only imported by other server code (API routes, page.tsx, actions)

### Sync-related gotcha

Server actions that call service functions may cache aggressively. After mutations, always call `revalidatePath()` for affected routes (see below).

---

## 2. Record ID (`rec…`) vs slug (`user_id`, `model_id`)

Airtable has two identifier layers:

| ID type | Example | Used for |
|---------|---------|----------|
| Record id | `recABC123` | API create/update links, `getRecord` |
| Primary field / slug | `user_42`, model slug | Formula `ARRAYJOIN`, display, legacy text fields |

### Common failure

Writing a formula like `{assigned_to} = "recXYZ"` when `assigned_to` links to `users` whose primary field is `user_id` — formula never matches.

### Correct patterns in codebase

- `services/va-tasks.ts` — `resolveVaTaskUserLookupKey()` resolves `rec…` → `user_id` for formulas
- `services/model-live-streams.ts` — fetch with broad formula, filter `model_id` in JS
- `services/shifts.ts` — `resolveShiftChatterRecordId()` maps between id types

### Rule

When a filter returns zero rows but data exists in UI, check whether you're comparing **rec id vs slug**.

---

## 3. Missing or incomplete `revalidatePath`

Next.js App Router caches server component data. Mutations via server actions won't refresh UI until revalidated.

### Symptoms

- User completes action, page shows old data until hard refresh
- Admin board doesn't reflect VA's update

### Required pattern

After every mutation in `app/actions/*.ts`:

```typescript
import { revalidatePath } from "next/cache";
import { ROUTES } from "@/lib/routes";

// Revalidate ALL views that display this data
revalidatePath(ROUTES.admin.vaTasks);
revalidatePath(ROUTES.va.tasks);
```

VA tasks example revalidates: admin board, personal tasks, VA home, VA schedule.

Notifications use layout revalidation:

```typescript
revalidatePath("/", "layout");
revalidatePath("/notifications");
```

### Rule

When adding a new action, grep similar actions for their `revalidatePath` list and mirror it.

---

## 4. Client state desync / `fetchSeqRef`

Client components that refetch on date/filter changes can apply **stale responses** if older requests resolve after newer ones.

### Pattern (required)

```typescript
const fetchSeqRef = React.useRef(0);

async function load() {
  const seq = ++fetchSeqRef.current;
  setLoading(true);
  try {
    const data = await fetch(...);
    if (seq !== fetchSeqRef.current) return; // stale — discard
    setState(data);
  } finally {
    if (seq === fetchSeqRef.current) setLoading(false);
  }
}
```

Used in: `components/va-tasks-client.tsx`, `components/model-home-client.tsx`.

### Rule

Any new client component with user-triggered refetch (date nav, filters, tabs) should implement sequence guards.

---

## 5. Timezone / Athens calendar bugs

Business dates use **Europe/Athens**, not UTC midnight.

### Symptoms

- Task appears on wrong day near midnight UTC
- "Today" shows tomorrow's recurring task
- Weekly program week boundary off by one day

### Functions

| Use case | Function |
|----------|----------|
| Bucket due_date to day | `ymdInAthens(iso)` |
| VA task "today" | `getVaTasksViewTodayYmd()` |
| Week start Monday | `getWeekStartYmdInAthens()` |
| Spawn eligibility | Only `targetYmd === todayYmd` in spawn service |

### Trap

`getNowInAthens()` uses fixed UTC+3; `ymdInAthens()` uses IANA `Europe/Athens`. They can disagree around DST boundaries (product intentionally simplifies to +3 for week helpers).

---

## 6. VA task virtual vs real row confusion

| Mistake | Result |
|---------|--------|
| Delete `virt_*` id | Error thrown |
| Update virtual row in Airtable | Row doesn't exist |
| Expect real row for future date | Only virtual projection shows |
| Duplicate spawn same series+day | Mutex + re-check prevents most; run cleanup script if race |

Completing a virtual task must materialize real row first (server action handles this).

---

## 7. Notification event checklist not followed

Adding a notification without updating all 9 files causes:

- Event not in Airtable select options → create fails
- No routing rule → wrong recipients
- Missing preference key → always blocked by prefs
- No deep link → push opens wrong page
- Roles UI missing toggle

**Always follow** `.cursor/rules/notifications.mdc` checklist.

Key files:

1. `lib/notification-types.ts`
2. `types/index.ts`
3. `lib/notifications-schema.ts`
4. `lib/notification-routing.ts`
5. `lib/notification-role-defaults.ts`
6. `lib/notification-routes.ts`
7. `services/notification-service.ts`
8. `lib/notification-role-defaults.ts` → `DEFAULT_NOTIFICATION_DEFAULTS`
9. Roles UI auto-updates from step 5

Verify with: `npx tsx scripts/verify-all-notifications.ts`

---

## 8. Permission floor prevents toggling off

Because `resolveRolePermissions()` **union-merges** code defaults:

- Adding a permission to `VA_PERMISSIONS` or `CHATTER_PERMISSIONS` makes it **permanent** for that role
- Roles UI toggle cannot remove it

### Correct approach for opt-in features

- Do **not** add to role default arrays
- For manager, add to `MANAGER_EXCLUDED` if it should be opt-in
- Add nav item to `sharedPermissionNavItems` with `requiresPermission`

Documented example: `winner_videos:submit`, `blur_tool:access`, `video_transcribe:access`.

### Inverse bug: removing a default does not revoke stored grants

`resolveRolePermissions()` **unions** code defaults into stored permissions but **never strips** previously stored grants. So removing `mistakes:view` from `CHATTER_PERMISSIONS` in code leaves Production chatters with Mistakes nav/forms until the **roles** row is updated in Supabase (and Airtable if dual-used).

**Fix:** surgically remove the permission from the Chatter role `permissions` JSON. Permissions are loaded per request (60s in-memory RBAC cache) — re-login is not required; wait for cache TTL or a fresh serverless instance.

Incident (2026-08): `test@gmail.com` (role=chatter) still saw Mistakes after the code default removal for this reason.

---

## 9. Nav / page permission drift

### Symptom

User has permission (Roles UI) but no nav link, OR nav link visible but page redirects to dashboard.

### Causes

1. Nav item missing from `sharedPermissionNavItems` (page guarded but nav only in `adminNav`)
2. Page uses different permission than nav `requiresPermission`
3. Middleware blocks path — check `lib/va-schedule-overview-access.ts` for shared admin paths
4. `adminOnly: true` on nav but page only checks permission

### Rule

Page guard permission === nav `requiresPermission` (or `requiresAnyPermission`). For custom roles, use shared permission nav items.

---

## 10. Airtable field name case sensitivity

Airtable formulas and API field names are **case-sensitive**.

Examples:

- `week_start` not `Week Start` in formulas (`services/weekly-program.ts`)
- `due_date` not `Due date` on write (read accepts alternates)

Use constants for field names in services.

---

## 11. Linked field empty vs blank datetime

Some Airtable bases treat empty datetime differently:

- `{actual_end}=""` works in formulas
- `BLANK({actual_end})` may not

Model live streams filter active rows in JS for this reason.

---

## 12. Concurrent recurring task spawn

Shift start + day-boundary cron + page load can race to create duplicate rows for the same series + Athens day across **separate serverless instances** (in-process mutex is per-instance only).

Mitigations in `services/va-task-recurring-spawn.ts`:

- Supabase `recurring_spawn_key` unique partial index (DB-level idempotency)
- `getVaTaskByRecurringSpawnKey()` lookup before insert + unique-violation fallback
- In-process `spawnLocks` mutex (same-instance concurrency)
- Fresh fetch before insert
- `recurringRealRowExistsForAthensYmd()` check
- `dedupeRecurringRealRowsOnDay()` in date expand (display-side safety net)
- `clonePhasesToTask()` skips when target already has phases

If duplicates appear, run `npx tsx scripts/cleanup-duplicate-recurring-tasks.ts`.

---

## Quick diagnostic commands

```bash
# Type errors
npm run typecheck

# Airtable schema audit
npm run audit:airtable

# VA task spawn regression
npx tsx scripts/verify-recurring-spawn-fix.ts

# Notification system
npx tsx scripts/verify-all-notifications.ts
```
