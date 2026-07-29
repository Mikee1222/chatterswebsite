# Whales & Marketing

## Whales

High-value fan tracking and assignment.

| | |
|--|--|
| **Routes** | `/my-whales`, `/whales`, `/admin/whales`, `/va/whales` |
| **Permissions** | `whales:view`, `whales:manage`, `whales:assign` |
| **Services** | `services/whales.ts`, `services/whale-transactions.ts`, `app/actions/whales.ts` |
| **Tables** | `whales`, `whale_transactions`, `whale_activity`, `whale_tags` |

### Chatter vs admin views

- Chatters see assigned whales at `/my-whales` (beta nav item)
- Admin full registry at `/admin/whales`
- VAs see read-only agency list at `/va/whales`

### Transactions

`/log-transaction`, `/my-rebills`, `/admin/rebills-tips` — logged in `whale_transactions`. Challenge metric hooks on transaction create.

### OF subscriber sync

When `THE_ONLY_API_KEY` is set, `services/of-sync.ts` caches subscribers in `of_subscribers` table. See [04-integrations.md](../04-integrations.md).

---

## Marketing

Social account tracking, funnel links, shadowban reports.

| | |
|--|--|
| **Routes** | `/admin/marketing`, `/va/marketing` |
| **Permissions** | `marketing:view` (VA), `marketing:manage` (admin), `marketing:shadowban-report` |
| **Service** | `services/marketing.ts` |
| **Tables** | `marketing_platforms`, `model_social_accounts`, `model_funnel_links`, `shadowban_reports`, `phones` |

VA marketing page is permission-gated via `sharedPermissionNavItems` — hidden when user has `marketing:manage` (they see admin page instead).

Setup: `scripts/create-marketing-tables.ts`, `scripts/seed-marketing-platforms.ts`.

---

## Marketing QA — Spot checks

| | |
|--|--|
| **Routes** | `/spot-checks` (submit), `/admin/spot-checks` (manage) |
| **Permissions** | `spotcheck:submit`, `spotcheck:manage` |
| **Service** | `services/marketing-reviews.ts` |
| **Table** | `marketing_spot_checks` |

---

## Marketing QA — Daily review

| | |
|--|--|
| **Routes** | `/daily-review`, `/admin/daily-review` |
| **Permissions** | `daily_review:submit`, `daily_review:manage` |
| **Table** | `marketing_daily_reviews`, `marketing_exec_audits` |

---

## Research (Winner videos)

Marketing research pipeline: submit winning video references → admin review → creative script assignment.

| | |
|--|--|
| **Routes** | `/winners` (submit), `/admin/winner-videos` (manage), `/creative-scripts`, `/my-scripts` |
| **Permissions** | `winner_videos:submit`, `winner_videos:manage`, `creative_scripts:submit`, `creative_scripts:manage` |
| **Service** | `services/winner-videos.ts` |
| **Table** | `winner_videos` |

### Workflow

1. VA/staff with `winner_videos:submit` uploads video metadata at `/winners`
2. Admin reviews at `/admin/winner-videos` with `winner_videos:manage`
3. On approve, assign a Creative (user with `creative_scripts:submit`)
4. Creative writes script at `/creative-scripts`; tracks own work at `/my-scripts`

### Transcription

Video transcription for research uses the same `transcribeVideoUrl()` as the Transcript Videos tool — see [04-integrations.md](../04-integrations.md).

---

## Mistakes (chatter QA)

| | |
|--|--|
| **Routes** | `/mistakes` (chatter), `/va/mistakes` (VA submit), `/admin/mistakes` (review) |
| **Permissions** | `mistakes:view`, `mistakes:manage`, `mistakes:reasons-manage` |
| **Service** | `services/chatter-mistakes.ts` |
| **Tables** | `chatter_mistakes`, `mistake_reasons` |

VA mistakes nav uses submit-tier link with dedup against admin manage page.

---

## My Profiles (VA tool)

| | |
|--|--|
| **Route** | `/my-profiles` |
| **Permission** | `my_profiles:view` (opt-in) |
| **Service** | `services/my-profiles.ts` |

Shows assigned models, social accounts, and phones for the logged-in VA.

---

## Blur tool

| | |
|--|--|
| **Route** | `/va/blur-tool` |
| **Permission** | `blur_tool:access` (opt-in) |

Client-side image blur utility for marketing content prep.

---

## Related

- [rewards-training-tools.md](./rewards-training-tools.md) — transcript videos tool
- [04-integrations.md](../04-integrations.md) — TheOnlyAPI, transcription service
