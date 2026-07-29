# Rewards, Training & Tools

## Points & rewards

Gamification system — points, levels, redemption.

| | |
|--|--|
| **Routes** | `/rewards`, `/admin/rewards`, `/admin/rewards-config` |
| **Permissions** | `rewards:view`, `rewards:manage`, `rewards:config` |
| **Services** | `services/points-engine.ts`, `services/points-config.ts`, `app/actions/rewards.ts` |
| **Tables** | Points stored in user-linked records; config in `system_settings` |

Notifications: `points_awarded`, `level_up`, `spin_available`.

Debug audit: `services/points-debug-audit.ts`, `app/actions/rewards-debug.ts`.

---

## Challenges

| | |
|--|--|
| **Routes** | `/challenges`, `/admin/challenges` |
| **Permissions** | `challenges:view`, `challenges:manage` |
| **Service** | `services/challenges.ts` |
| **Tables** | `challenges`, challenge progress table |

Metrics defined in `lib/challenges.ts` (`CHALLENGE_METRICS`). Progress updated from whales, customs, transactions hooks.

Notification: `challenge_completed`.

---

## Spin wheel

| | |
|--|--|
| **Routes** | `/spin-wheel`, `/admin/spin-results` |
| **Permissions** | `spin-wheel:view`, `spin-wheel:manage` |
| **Service** | `services/spin-wheel.ts` |
| **Tables** | `spin_wheel_prizes`, `spin_wheel_spins` |

Winning a bonus creates a `fines_and_bonuses` row with `source: "spin_wheel"`.

---

## SOP Academy (training)

Structured training: departments → roles → functions → standards, with quizzes and sign-offs.

| | |
|--|--|
| **Routes** | `/sops`, `/admin/sop-library` |
| **Permissions** | `sops:view`, `sops:manage`, `sops:sign-off`, `sops:quiz` |
| **Services** | `services/sops.ts`, `services/sop-progress.ts`, `services/sop-quiz.ts`, `services/sop-signoff.ts`, `services/sop-academy-overview.ts` |

### Tables

| Table | Purpose |
|-------|---------|
| `sop_departments` | Top-level grouping |
| `sop_roles` | Role within department (`authorized_roles` multi-select synced with RBAC slugs) |
| `sop_functions` | Training modules |
| `sop_progress` | Per-user completion state |
| `sop_quiz_questions` | Quiz content |
| `sop_quiz_attempts` | Attempt history |
| `sop_signoffs` | Manager sign-offs |
| `sop_feedback` | User feedback on modules |

Setup scripts: `scripts/setup-sop-tables.ts`, `scripts/add-sop-academy-v2.ts`, etc.

Notifications: `sop_academy_reminder`, `sop_academy_training_complete`, `sop_academy_signed_off`.

---

## Link pages (link-in-bio)

Public pages at `/l/[slug]` and custom domains.

| | |
|--|--|
| **Routes** | `/admin/link-pages`, public `/l/[slug]`, redirects `/r/[slug]` |
| **Permissions** | `link-pages:view`, `link-pages:manage` |
| **Services** | `services/link-pages.ts`, `services/link-redirects.ts`, `services/link-ab-testing.ts`, `services/link-page-analytics.ts` |
| **Schema** | `lib/link-pages-schema.ts` |

### Tables

| Table | Purpose |
|-------|---------|
| `link_pages` | Page config (slug, theme, domain, A/B) |
| `link_page_blocks` | Content blocks |
| `link_page_analytics` | Click/view events |
| `link_ab_results` | A/B test results |
| `link_redirects` | Short redirect links |

Custom domains via Vercel API (`lib/vercel-domains.ts`) when `VERCEL_TOKEN` + `VERCEL_PROJECT_ID` set.

Middleware routes custom domains to link pages — see `middleware.ts` `getLinkPageByCustomDomainFresh()`.

---

## PDF Maker

| | |
|--|--|
| **Route** | `/admin/pdf-maker` |
| **Permission** | `pdf_maker:manage` |
| **Service** | `services/pdf-maker.ts` |
| **Tables** | `pdf_documents`, `pdf_templates` |

Uses `pdf-lib` + `@pdf-lib/fontkit` for document generation.

---

## Transcript Videos

Upload video → external transcription service → store transcript.

| | |
|--|--|
| **Route** | `/transcript-videos` |
| **Permission** | `video_transcribe:access` (opt-in; in `MANAGER_EXCLUDED`) |
| **API** | `app/api/transcript-videos/route.ts` |
| **Services** | `services/video-transcripts.ts`, `services/winner-videos.ts` (`transcribeVideoUrl`) |
| **Table** | `video_transcripts` |

Requires `TRANSCRIBE_SERVICE_URL` + `TRANSCRIBE_SERVICE_API_KEY`. See [04-integrations.md](../04-integrations.md).

Max upload size shared with winner videos: `WINNER_VIDEO_MAX_FILE_BYTES` in `lib/winner-video-files.ts`.

---

## Informations hub

Reference data for staff: mass lists, model tiers, pricing.

| | |
|--|--|
| **Routes** | `/informations`, `/admin/informations` |
| **Permissions** | `informations:view` (chatter/VA floor), `informations:manage` |
| **Services** | `services/mass-lists.ts`, `services/model-tiers.ts`, `services/pricing.ts` |

---

## Activity logs

| | |
|--|--|
| **Route** | `/activity-logs` |
| **Permission** | `activity_logs:view` |
| **Service** | `services/activity-logs.ts` |
| **Table** | `activity_logs` |

Append-only audit trail for login, shifts, model enter/leave, etc.

---

## Related

- [04-integrations.md](../04-integrations.md) — Vercel Blob, transcription, Vercel domains
- [whales-and-marketing.md](./whales-and-marketing.md) — winner videos / research pipeline
