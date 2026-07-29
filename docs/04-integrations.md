# 04 — External Integrations

All integrations are optional except Airtable (required). Tokens live in environment variables — never in client bundles.

## Airtable (primary database)

| | |
|--|--|
| **Env** | `AIRTABLE_TOKEN`, `AIRTABLE_BASE_ID` |
| **Client** | `lib/airtable-server.ts` |
| **Sanitization** | `lib/airtable-sanitize.ts` — field-type coercion before write |
| **Queue** | `lib/airtable-queue.ts` — rate limit handling |
| **Setup** | `npm run setup:airtable`, `npm run verify:airtable` |

### Access rules

1. **Server-only** — never import `airtable-server` from client components
2. Table names are lowercase with underscores (e.g. `va_tasks`, `modelss`)
3. Linked record fields accept array of `rec…` ids on write
4. **Formulas** on linked fields often return the **primary field value** (slug/`user_id`), not record id — filter in JS when needed
5. DateTime fields require full ISO 8601 with ms: `2026-05-03T12:30:00.000Z`
6. Date fields require `YYYY-MM-DD` only

### Schema management

- `scripts/fetch-airtable-schema.ts` — dump live schema
- `scripts/audit-airtable-schema.ts` — compare against expectations
- `lib/airtable-schema.ts` — table defs for setup scripts (subset; not exhaustive)
- Individual `scripts/add-*-field.ts` and `scripts/create-*-table.ts` for migrations

### Role field sync

When adding custom role slugs, run:

```bash
npx tsx scripts/sync-airtable-role-options.ts
```

This updates `users.role` single-select and `sop_roles.authorized_roles` via Meta API (`lib/airtable-role-field-sync.ts`).

---

## Transcription service (HuggingFace / external)

Video transcription is **not** embedded in the Next.js app. It calls an external HTTP service (typically a HuggingFace Whisper deployment or similar).

| | |
|--|--|
| **Env** | `TRANSCRIBE_SERVICE_URL`, `TRANSCRIBE_SERVICE_API_KEY` |
| **Function** | `transcribeVideoUrl()` in `services/winner-videos.ts` |
| **API route** | `POST /api/transcript-videos` |
| **Timeout** | 5 minutes (`TRANSCRIBE_TIMEOUT_MS`) |

### Request format

```
POST {TRANSCRIBE_SERVICE_URL}/transcribe
Headers: Content-Type: application/json, X-API-Key: {TRANSCRIBE_SERVICE_API_KEY}
Body: { "url": "<public video URL from Airtable attachment>" }
```

### Response format (expected)

```json
{
  "transcript": "…",
  "language": "en",
  "duration": 123.4
}
```

Also accepts `duration_seconds` instead of `duration`.

### Flow

1. Client uploads video via multipart form
2. Server creates `video_transcripts` row, uploads attachment to Airtable
3. Server reads attachment URL, calls transcription service
4. Updates row with transcript text, language, duration, status `Done` or `Failed`

Used by both **Transcript Videos** tool and winner video research pipeline.

---

## TheOnlyAPI (OnlyFans CRM)

Optional integration for subscriber sync and whale enrichment.

| | |
|--|--|
| **Env** | `THE_ONLY_API_KEY`, `ONLYAPI_WEBHOOK_SECRET` |
| **Services** | `services/of-sync.ts`, `services/of-subscribers.ts` |
| **Webhook** | `POST /api/webhooks/onlyapi` |
| **Table** | `of_subscribers` |

### Subscriber fetch

REST call to `https://theonlyapi.com/api/of_list_subscribers` with Bearer token.

### Webhook

When `ONLYAPI_WEBHOOK_SECRET` is unset, webhooks are accepted without verification (logged warning). Set secret in production.

Model link: `modelss.of_user_id` field stores the OF account id.

---

## Vercel Blob

File storage for uploads that exceed Airtable attachment limits or need public URLs.

| | |
|--|--|
| **Env** | `BLOB_READ_WRITE_TOKEN` |
| **Package** | `@vercel/blob` |

### Used by

- Client payment proof uploads (`app/api/client/upload-proof/route.ts`)
- Feedback screenshots (`app/api/feedback/route.ts`)
- Link page asset uploads (`app/api/admin/link-pages/upload/route.ts`)
- Chatter screenshot uploads (`lib/chatter-screenshot-upload.ts`)
- VA phase item completion attachments (`app/api/va/phase-items/[id]/complete/route.ts`)

When Blob is not configured, features degrade gracefully or fall back to Airtable attachments only.

---

## Vercel Domains API

Automatic custom domain connection for link pages.

| | |
|--|--|
| **Env** | `VERCEL_TOKEN`, `VERCEL_PROJECT_ID`, `VERCEL_TEAM_ID` (optional) |
| **Lib** | `lib/vercel-domains.ts` |

Admin link pages UI shows warning when `vercelConfigured === false`.

---

## Web Push (VAPID)

| | |
|--|--|
| **Env** | `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` |
| **Service** | `services/push-subscriptions.ts` |
| **Table** | `push_subscriptions` |
| **Package** | `@block65/webcrypto-web-push` |

Generate keys: `npx web-push generate-vapid-keys`

Push delivery integrated in `services/notification-service.ts` after in-app notification create.

---

## Realtime WebSocket (optional)

Live notification delivery without polling.

| | |
|--|--|
| **Env** | `NEXT_PUBLIC_REALTIME_WS_URL`, `REALTIME_BROADCAST_URL`, `REALTIME_BROADCAST_SECRET`, `REALTIME_JWT_SECRET` |
| **Worker** | `realtime/` directory |
| **Docs** | `realtime/README.md` |

Deploy separately: `cd realtime && npx wrangler deploy`

When not configured, notifications still work via in-app polling/SWR refresh.

---

## Cloudflare D1 (optional auth backend)

Production auth can use D1 instead of demo login.

| | |
|--|--|
| **Env** | `D1_DATABASE_ID` |
| **Migrations** | `drizzle/migrations/` |
| **Commands** | `npm run db:generate`, `npm run db:migrate` |

See `docs/CLOUDFLARE_SETUP.md` for binding configuration in wrangler.

---

## Cloudflare Workers (cron)

| Worker | Purpose | Deploy |
|--------|---------|--------|
| `workers/cron-late-shifts/` | Late shift detection | `npm run cron:deploy` |
| `realtime/` | WebSocket notifications | Manual wrangler deploy |

Additional cron logic runs via authenticated Next.js API routes invoked by external schedulers (VA task spawn, daily summary, custom request deadlines, etc.) — see `services/cron-notification-jobs.ts`.

---

## Infloww API (legacy/reference)

`lib/infloww-api.ts` exists for historical Infloww integration. Listed in strict TypeScript debt — verify before extending.

---

## Integration troubleshooting

| Symptom | Check |
|---------|-------|
| Transcription always fails | `TRANSCRIBE_SERVICE_*` env vars; attachment URL publicly reachable |
| OF sync empty | `THE_ONLY_API_KEY`; `modelss.of_user_id` populated |
| Push not delivered | VAPID keys; user has `push_subscriptions` row; preferences not muted |
| Link page domain fails | Vercel token scopes; DNS propagation |
| Airtable 422 errors | Field name case; datetime format; unknown field in payload |
