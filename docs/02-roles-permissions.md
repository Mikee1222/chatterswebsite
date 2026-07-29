# 02 — User Roles & Permissions

RBAC (role-based access control) is the primary authorization model. Every new page, API route, and server action must use `hasPermission()` — not raw role string checks.

## System roles

Defined in `types/index.ts` as `UserRole`:

| Role slug | Description | Default nav profile |
|-----------|-------------|---------------------|
| `admin` | Full access; `adminOnly` nav items visible | `adminNav` |
| `manager` | Nearly full access; excludes destructive/config permissions | `adminNav` (minus `adminOnly`) |
| `chatter` | Shift + whales + chatter workflows | `chatterNav` |
| `virtual_assistant` | VA tasks, content, marketing (permission-gated) | `vaNav` |
| `model` | Model portal (calendar, customs, content) | `modelNav` |
| `client` | Client billing portal | Minimal (no standard nav array) |

### Staff dual-role (chatter + VA)

Users can have `secondary_role` and `active_role` on the session (`AuthUser` in `lib/auth-config.ts`). `getEffectiveStaffRole()` in `lib/staff-session-role.ts` resolves which hat is active for permissions and nav.

### VA type

VAs have `va_type`: `chatting` | `marketing` | `both`. This affects **hidden nav items** — admins can hide different links per VA type via `system_settings.hidden_nav_items`.

## Custom roles

Custom roles are stored in Airtable table **`roles`**:

| Field | Purpose |
|-------|---------|
| `role_id` | Slug (lowercase), synced to `users.role` single-select |
| `label` | Display name |
| `permissions` | JSON array of permission strings |
| `notification_defaults` | JSON per-category notification toggles |
| `is_system_role` | When true, cannot delete |

When a user's `users.role` is not one of the six system slugs, `isCustomNavRole()` returns true. Custom roles get:

- Permission-gated items from `adminNav` (only links they have grants for)
- Shared admin shell items (Home, Settings) via `getCustomRoleSharedAdminNavItems()`
- Home route rewritten to `/admin/custom-role-home`

Creating a new custom role slug requires running `npx tsx scripts/sync-airtable-role-options.ts` so the slug appears in Airtable's `users.role` field options.

## Permission system

### Source of truth

`lib/permissions.ts`:

- `PERMISSIONS` — constant object of `"resource:action"` strings
- `DEFAULT_ROLE_PERMISSIONS` — baseline grants per system role
- `PERMISSION_LABELS` / `PERMISSION_DESCRIPTIONS` — UI copy (descriptions in Greek)

### Runtime resolution

```
Session user
  → resolveRoleForPermissions()     (respects active_role for dual-role staff)
  → getRolePermissions(roleName)    (services/roles.ts)
  → resolveRolePermissions()        (union-merge with code defaults)
  → expandTaskProgressPermissions() (va-tasks:manage → task_progress:view)
  → expandLegacyProgramPermissions() (weekly-program:* → chatter/VA program *)
  → cached Set<Permission> (60s TTL)
```

### `resolveRolePermissions` — the union-merge rule

```typescript
// services/roles.ts
function resolveRolePermissions(roleId: string, stored: Permission[]): Permission[] {
  const defaults = DEFAULT_ROLE_PERMISSIONS[roleId as UserRole];
  if (!defaults) return stored;           // custom roles: Airtable is authoritative
  if (stored.length === 0) return [...defaults];
  const merged = new Set(stored);
  for (const p of defaults) merged.add(p); // CODE DEFAULTS ARE A FLOOR
  return [...merged];
}
```

**Critical implication:** Any permission listed in `CHATTER_PERMISSIONS`, `VA_PERMISSIONS`, or `DEFAULT_ROLE_PERMISSIONS.admin/manager` becomes a **mandatory floor** for that system role. Stored Airtable toggles can only **add** permissions, not remove floor grants.

**Opt-in permissions** (blur tool, winner videos submit, video transcribe, my profiles) are intentionally **excluded** from VA/chatter defaults. For manager, they're in `MANAGER_EXCLUDED` so the Roles UI toggle stays authoritative.

### Permission expansion rules

| Trigger | Adds |
|---------|------|
| Has `va-tasks:manage` | Also `task_progress:view` |
| Has `weekly-program:view` | Also `chatter_program:view` + `va_program:view` |
| Has `weekly-program:manage` | Also `chatter_program:manage` + `va_program:manage` |

## Nav-placement invariant

Navigation is built in `lib/nav-config.ts` with a strict invariant:

> **If a page is guarded by `hasPermission(PERMISSIONS.X)`, the nav item for that page must be reachable via `sharedPermissionNavItems` or the role's base nav with `requiresPermission: PERMISSIONS.X`.**

This ensures granting a permission to **any** role (including custom roles and chatters) surfaces the link — not only admin.

### `sharedPermissionNavItems`

Permission-gated links appended to **every** role's nav before filtering:

| Item | Permission | Dedup rule |
|------|------------|------------|
| Accounts | `accounts:view` | — |
| Weekly program | `chatter_program:view` | — |
| VA weekly program | `va_program:view` | — |
| VA tasks (personal) | `va-tasks:view` | Hidden if user has `va-tasks:manage` or `task_progress:view` |
| Research (submit) | `winner_videos:submit` | Hidden if `winner_videos:manage` |
| Scripts to Write | `creative_scripts:submit` | Hidden if `creative_scripts:manage` |
| Spot Checks (submit) | `spotcheck:submit` | Hidden if `spotcheck:manage` |
| Daily Review (submit) | `daily_review:submit` | Hidden if `daily_review:manage` |
| VA Mistakes | `mistakes:view` | Hidden if `mistakes:manage` |
| VA Marketing | `marketing:view` | Hidden if `marketing:manage` |
| PDF Maker | `pdf_maker:manage` | — |
| Transcript Videos | `video_transcribe:access` | — |
| Blur tool | `blur_tool:access` | — |
| My Profiles | `my_profiles:view` | — |

### Submit vs manage deduplication

Nav items use `hiddenIfPermission` or `hiddenIfAnyPermission` so users with **manage** grants see the richer admin review page instead of the submit-tier link. Example: a user with both `winner_videos:submit` and `winner_videos:manage` sees only `/admin/winner-videos` (Research), not `/winners`.

### `winner_videos:submit` example (end-to-end)

1. Permission defined: `WINNER_VIDEOS_SUBMIT: "winner_videos:submit"` in `lib/permissions.ts`
2. **Not** in `VA_PERMISSIONS` or `CHATTER_PERMISSIONS` defaults — must be granted via Roles UI
3. Nav: `sharedPermissionNavItems` entry → `/winners` with `requiresPermission: WINNER_VIDEOS_SUBMIT`, `hiddenIfPermission: WINNER_VIDEOS_MANAGE`
4. Page: `app/(dashboard)/winners/page.tsx` guards with `hasPermission(user, PERMISSIONS.WINNER_VIDEOS_SUBMIT)`
5. Manage tier: `/admin/winner-videos` requires `winner_videos:manage`

### VA tasks nav resolution

Custom roles with `va-tasks:view` but not manage/progress see personal `/va-tasks`, not admin board:

```typescript
shouldUsePersonalVaTasksNav(role, granted) // lib/nav-config.ts
```

## Guard patterns

### Pages (server components)

```typescript
const user = await getSessionFromCookies();
await requireAdminRoute(user, PERMISSIONS.SOME_PERMISSION);
// or for non-admin routes:
if (!(await hasPermission(user, PERMISSIONS.SOME_PERMISSION))) redirect(ROUTES.dashboard);
```

### API routes

```typescript
const session = await getSessionFromCookies();
if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
if (!(await hasPermission(session, PERMISSIONS.X))) return Response.json({ error: "Forbidden" }, { status: 403 });
```

### Server actions

Start with session + permission check; return `{ success: false, error: "Unauthorized." }` or use `requirePermission()` which throws `Forbidden`.

See `.cursor/rules/rbac.mdc` for the full checklist.

## Manager exclusions

Managers get all permissions except:

- `roles:manage`
- `accounts:delete`
- `earnings:config`
- `notifications:diagnostic`
- `rewards:config`
- `mistakes:reasons-manage`
- `video_transcribe:access` (opt-in)

## Full permission list

All permissions from `lib/permissions.ts` (as of codebase snapshot):

| Permission | Label category |
|------------|----------------|
| `billing:view` | Billing — View |
| `billing:manage` | Billing — Manage |
| `accounts:view` | Accounts — View |
| `accounts:create` | Accounts — Create |
| `accounts:edit` | Accounts — Edit |
| `accounts:delete` | Accounts — Delete |
| `accounts:reset-password` | Accounts — Reset password |
| `earnings:view` | Earnings — View |
| `earnings:config` | Earnings — Configure |
| `mistakes:view` | Mistakes — View |
| `mistakes:manage` | Mistakes — Manage |
| `mistakes:reasons-manage` | Mistakes — Manage reasons |
| `challenges:view` | Challenges — View |
| `challenges:manage` | Challenges — Manage |
| `rewards:view` | Rewards — View |
| `rewards:config` | Rewards — Configure |
| `rewards:manage` | Rewards — Manage |
| `shifts:view` | Shifts — View |
| `shifts:manage` | Shifts — Manage |
| `shifts:start` | Shifts — Start |
| `shifts:active-view` | Shifts — View active |
| `fines:view` | Fines & bonuses — View |
| `fines:manage` | Fines & bonuses — Manage |
| `fines:review` | Fines & bonuses — Review |
| `models:view` | Models — View |
| `models:manage` | Models — Manage |
| `models:schedules` | Models — Schedules |
| `models:availability` | Models — Availability |
| `clients:view` | Clients — View |
| `clients:manage` | Clients — Manage |
| `whales:view` | Whales — View |
| `whales:manage` | Whales — Manage |
| `whales:assign` | Whales — Assign |
| `marketing:view` | Marketing — View |
| `marketing:manage` | Marketing — Manage |
| `marketing:shadowban-report` | Marketing — Shadowban report |
| `va-tasks:view` | VA tasks — View |
| `va-tasks:manage` | VA tasks — Manage |
| `va-tasks:assign` | VA tasks — Assign |
| `task_progress:view` | Task progress — View |
| `task_templates:manage` | Task templates — Manage |
| `va_statistics:view` | VA statistics — View |
| `sops:view` | SOPs / training — View |
| `sops:manage` | SOPs / training — Manage |
| `sops:sign-off` | SOPs / training — Sign off |
| `sops:quiz` | SOPs / training — Take quiz |
| `pdf_maker:manage` | PDF Maker — Manage |
| `spotcheck:submit` | Spot checks — Submit |
| `spotcheck:manage` | Spot checks — Manage |
| `winner_videos:submit` | Winner videos — Submit |
| `winner_videos:manage` | Winner videos — Manage |
| `creative_scripts:submit` | Creative scripts — Submit |
| `creative_scripts:manage` | Creative scripts — Manage |
| `daily_review:submit` | Daily review — Submit |
| `daily_review:manage` | Daily review — Manage |
| `content:view` | Content — View |
| `content:manage` | Content — Manage |
| `content:assign` | Content — Assign |
| `spin-wheel:view` | Spin wheel — View |
| `spin-wheel:manage` | Spin wheel — Manage |
| `notifications:view` | Notifications — View |
| `notifications:manage` | Notifications — Manage |
| `notifications:diagnostic` | Notifications — Diagnostic |
| `custom-requests:view` | Custom requests — View |
| `custom-requests:manage` | Custom requests — Manage |
| `custom-requests:approve` | Custom requests — Approve |
| `weekly-program:view` | Weekly program — View *(legacy; expands to chatter/VA)* |
| `weekly-program:manage` | Weekly program — Manage *(legacy)* |
| `chatter_program:view` | Chatter program — View |
| `chatter_program:manage` | Chatter program — Manage |
| `va_program:view` | VA program — View |
| `va_program:manage` | VA program — Manage |
| `payments:view` | Payments — View |
| `payments:submit` | Payments — Submit |
| `payments:manage` | Payments — Manage |
| `settings:view` | Settings — View |
| `settings:manage` | Settings — Manage |
| `roles:view` | Roles & permissions — View |
| `roles:manage` | Roles & permissions — Manage |
| `feedback:view` | Feedback — View |
| `feedback:manage` | Feedback — Manage |
| `informations:view` | Informations — View |
| `informations:manage` | Informations — Manage |
| `pricing:view` | Pricing — View |
| `pricing:manage` | Pricing — Manage |
| `mass-lists:view` | Mass lists — View |
| `mass-lists:manage` | Mass lists — Manage |
| `link-pages:view` | Link pages — View |
| `link-pages:manage` | Link pages — Manage |
| `video_transcribe:access` | Transcript videos — Access |
| `blur_tool:access` | Blur tool — Access |
| `my_profiles:view` | My profiles — View |
| `activity_logs:view` | Activity logs — View |

## Roles UI

`/admin/roles` (requires `roles:manage`, admin-only nav) reads:

- Permission groups from `getPermissionGroups()` in `lib/permissions.ts`
- Notification categories from `NOTIFICATION_CATEGORY_EVENTS` in `lib/notification-role-defaults.ts`

Changes persist to Airtable `roles` table and call `clearRbacCache()`.

## Related

- [05-bug-patterns.md](./05-bug-patterns.md) — permission floor pitfalls
- `.cursor/rules/rbac.mdc` — agent checklist
