# Models & Content

## Models (`modelss`)

The creator profile table is **`modelss`** (double s).

| | |
|--|--|
| **Routes** | `/admin/models`, `/admin/models/[id]`, `/models`, `/free-modelss` |
| **Permissions** | `models:view`, `models:manage`, `models:schedules`, `models:availability` |
| **Services** | `services/modelss.ts`, `app/actions/modelss.ts` |
| **Table** | `modelss` |

### Key fields

- Status: free/occupied, current chatter linkage
- `of_user_id` — TheOnlyAPI OF account link (see [04-integrations.md](../04-integrations.md))
- Availability windows, team/group links
- Model tiers via `model_tiers` table

### Model groups

`model_groups` table — see `scripts/create-model-groups-table.ts`.

---

## Model schedules

| | |
|--|--|
| **Routes** | `/admin/model-schedules`, `/admin/model-schedules/overview`, `/admin/schedule-overview`, `/va/schedule-overview` |
| **Services** | `services/model-schedule.ts` |
| **Table** | `model_schedule` |

Unified calendar of model events: VA tasks, lives, customs, personal events.

VA schedule overview is read-only for VAs with content assignments — middleware allows via `lib/va-schedule-overview-access.ts`.

---

## Model live streams

| | |
|--|--|
| **Routes** | `/admin/model-live-streams`, `/model/live-streams` |
| **Services** | `services/model-live-streams.ts`, `services/model-live-notify.ts`, `services/model-live-scheduled-reminders.ts` |
| **Table** | `model_live_streams` |

### Status flow

- `planned` → `live` / `in_progress` → ended (`actual_end` set)
- Active detection: `isActiveLiveStreamRecord()` — status `live` or `in_progress` without `actual_end`

### Gotchas (recent fixes)

- **`model` vs `model_id`** — Airtable field renamed; code reads `f.model ?? f.model_id`
- **`actual_end` formula** — empty datetime cells match `{actual_end}=""` but not `BLANK()` in this base; active-stream queries filter in JS
- **`ARRAYJOIN` on model link** returns `model_id` slug, not `rec…` — filter in JS after fetch
- Stuck live streams: `scripts/clear-stuck-live-streams.ts`

### Notifications

- `model_live_started`, `model_live_ended`, `model_live_scheduled`, `model_missed_live`

---

## Model tasks

Admin-assigned tasks for models (separate from VA tasks).

| | |
|--|--|
| **Route** | `/admin/model-tasks`, `/model/tasks` |
| **Service** | `services/model-tasks.ts` |
| **Table** | `model_tasks` |

---

## Model content requests

Models request content (scripts, mass DMs, photo sets, etc.).

| | |
|--|--|
| **Routes** | `/admin/model-content-requests`, model portal |
| **Service** | `services/model-content-requests.ts` |
| **Table** | `model_content_requests` |

Types: `script`, `mass`, `photo_set`, `video`, `other`.

---

## VA content assignments

VAs create and fulfill content deliverables for models.

| | |
|--|--|
| **Routes** | `/va/content-assignments`, `/admin/va-content-assignments`, `/model/content-assignments` |
| **Permissions** | `content:view`, `content:manage`, `content:assign` |
| **Service** | `services/va-content-assignments.ts` |
| **Table** | `va_content_assignments` |

API routes under `app/api/va/content-assignments/` handle status updates with `revalidatePath`.

---

## Custom requests

End-to-end custom content workflow (chatter/model → agency → VA fulfillment).

| | |
|--|--|
| **Routes** | `/request-custom`, `/admin/custom-requests`, `/admin/model-customs`, `/va/custom-requests`, `/model/customs` |
| **Permissions** | `custom-requests:view`, `custom-requests:manage`, `custom-requests:approve` |
| **Services** | `services/custom-requests.ts`, `services/custom-request-agency-queue.ts`, `services/custom-request-notify-vas.ts` |
| **Table** | `custom_requests` |

Dual status tracks: `admin_status`, `model_status`. Heavy notification integration (15+ event types).

Challenge progress hook: completing customs increments `customs_completed` metric.

---

## Period tracking

Model period/menstrual cycle tracking for scheduling sensitivity.

| | |
|--|--|
| **Service** | `services/model-periods.ts`, `services/period-notifications.ts` |
| **Table** | `model_periods` |
| **Actions** | `app/actions/model-periods.ts` |

Notifications: 3-day reminder, predicted day, confirmed early, overdue, prediction reset.

Debug: set `PERIOD_TRACKER_DEBUG=true` in env.

---

## Model time off & expense requests

| Feature | Table | Service |
|---------|-------|---------|
| Time off | `model_time_off_requests` | `services/model-time-off-requests.ts` |
| Expense requests | `model_expense_requests` | `services/model-expense-requests.ts` |

Expense approvals tie into payment notifications (`expense_approved`, `expense_rejected`).

---

## Model personal events

| | |
|--|--|
| **Table** | `model_personal_events` |
| **Service** | `services/model-personal-events.ts` |

Private calendar entries visible on model schedule views.

---

## Content calendar (model portal)

| | |
|--|--|
| **Route** | `/model/content-calendar` |
| **Components** | Model home client with `fetchSeqRef` pattern |

Aggregates assignments, lives, customs on a calendar grid.

---

## Related

- [va-tasks.md](./va-tasks.md) — VA task → model_schedule sync
- [whales-and-marketing.md](./whales-and-marketing.md) — research / winner videos
- [billing-and-clients.md](./billing-and-clients.md) — client_models linkage
