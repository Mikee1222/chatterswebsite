# 03 — Features Index

Feature documentation is split by domain. Each page lists **routes**, **key files**, **Airtable tables**, and **gotchas**.

| Document | Scope |
|----------|-------|
| [shifts-and-programs.md](./shifts-and-programs.md) | Chatting shifts, task shifts, shift queue, weekly program (chatter + VA), availability |
| [va-tasks.md](./va-tasks.md) | VA tasks, virtual projection, recurring spawn, phases, templates, statistics |
| [models-and-content.md](./models-and-content.md) | Models (`modelss`), schedules, live streams, content, customs, periods |
| [whales-and-marketing.md](./whales-and-marketing.md) | Whales, OF sync, marketing, QA (spot check, daily review), research |
| [billing-and-clients.md](./billing-and-clients.md) | Client portal, billing cycles, payments, partnership |
| [rewards-training-tools.md](./rewards-training-tools.md) | Points, rewards, challenges, spin wheel, SOP Academy, link pages, tools |

## Cross-cutting features (quick reference)

| Feature | Routes | Service(s) | Tables |
|---------|--------|------------|--------|
| Accounts | `/admin/accounts`, `/accounts/*` | `services/users.ts`, `app/actions/accounts.ts` | `users` |
| Roles | `/admin/roles` | `services/roles.ts` | `roles` |
| Notifications | Bell UI, `/notifications` | `services/notification-service.ts`, `services/notifications.ts` | `notifications`, `notification_preferences`, `push_subscriptions` |
| Activity logs | `/activity-logs` | `services/activity-logs.ts` | `activity_logs` |
| Settings | `/settings` | `services/system-settings.ts`, `app/actions/system-settings.ts` | `system_settings` |
| Feedback | `/admin/feedback` | API + Vercel Blob | `feedback` |
| Fines & bonuses | `/fines-bonuses`, `/admin/fines-bonuses` | `services/fines-bonuses.ts` | `fines_and_bonuses` |
| Informations | `/informations`, `/admin/informations` | `services/mass-lists.ts`, `services/model-tiers.ts`, `services/pricing.ts` | `mass_lists`, `model_tiers`, `pricing_rows`, `pricing_specials` |
| Hidden nav | Admin settings | `services/system-settings.ts` | `system_settings.hidden_nav_items` |

## Adding a new feature checklist

1. Add permission(s) to `lib/permissions.ts` + role defaults
2. Add page guard (`requireAdminRoute` / `hasPermission`)
3. Add nav item with matching `requiresPermission` (use `sharedPermissionNavItems` if not admin-only)
4. Add `ROUTES.*` entry in `lib/routes.ts`
5. If notifications: follow `.cursor/rules/notifications.mdc` (9 files)
6. If new Airtable table: add setup script under `scripts/`
