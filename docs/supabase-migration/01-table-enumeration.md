# Airtable → Supabase table enumeration (Phase 1)

Generated from `airtable-audit-report.txt` + codebase inventory.

| Metric | Count |
|---|---|
| Airtable tables in audit | 64 |
| Airtable fields in audit | 922 |
| multipleRecordLinks fields | 158 |
| Formula/rollup/lookup skipped | 44 |
| Postgres tables (audit + code-only) | 97 |
| Normalized join tables | 7 |
| Service modules | ~84 (~27k LOC) |
| Files importing Airtable | ~140 |

## Audit tables

| Airtable name | Postgres | Fields | Stored cols (excl. computed) | Category |
|---|---|---|---|---|
| `activity_logs` | `activity_logs` | 9 | 9 | app |
| `billing_cycle_revenues` | `billing_cycle_revenues` | 14 | 8 | app |
| `billing_cycles` | `billing_cycles` | 26 | 23 | app |
| `calendar_events` | `calendar_events` | 6 | 6 | app |
| `challenge_progress` | `challenge_progress` | 6 | 6 | app |
| `challenges` | `challenges` | 10 | 10 | app |
| `Chatter Complaints` | `chatter_complaints` | 9 | 8 | legacy |
| `Chatter Performance` | `chatter_performance` | 38 | 12 | legacy |
| `chatter_points` | `chatter_points` | 6 | 6 | app |
| `Chatters` | `chatters` | 24 | 23 | legacy |
| `Chatters Apply Form` | `chatters_apply_form` | 16 | 16 | legacy |
| `client_models` | `client_models` | 3 | 3 | app |
| `clients` | `clients` | 26 | 26 | app |
| `Creators` | `creators` | 12 | 12 | legacy |
| `custom_requests` | `custom_requests` | 35 | 35 | app |
| `earnings_config` | `earnings_config` | 2 | 2 | app |
| `feedback` | `feedback` | 12 | 12 | app |
| `FeedBackcc` | `feedback_cc` | 10 | 10 | legacy |
| `Fines & Bonuses` | `fines_and_bonuses_legacy` | 6 | 6 | app |
| `invoices` | `invoices` | 8 | 8 | app |
| `Mistakes` | `mistakes` | 4 | 3 | app |
| `Model Content` | `model_content_legacy` | 13 | 13 | legacy |
| `model_content_requests` | `model_content_requests` | 10 | 10 | app |
| `model_expense_requests` | `model_expense_requests` | 12 | 12 | app |
| `model_groups` | `model_groups` | 4 | 4 | app |
| `model_live_streams` | `model_live_streams` | 18 | 18 | app |
| `model_periods` | `model_periods` | 12 | 12 | app |
| `model_personal_events` | `model_personal_events` | 10 | 10 | app |
| `model_schedule` | `model_schedule` | 29 | 29 | app |
| `model_tasks` | `model_tasks` | 16 | 16 | app |
| `model_time_off_requests` | `model_time_off_requests` | 8 | 8 | app |
| `models` | `models` | 23 | 23 | legacy |
| `modelss` | `modelss` | 46 | 46 | app |
| `monthly_targets` | `monthly_targets` | 10 | 10 | app |
| `MSS` | `mss` | 15 | 11 | legacy |
| `notification_preferences` | `notification_preferences` | 14 | 14 | app |
| `notifications` | `notifications` | 16 | 16 | app |
| `payment_methods` | `payment_methods` | 15 | 15 | app |
| `payment_submissions` | `payment_submissions` | 18 | 18 | app |
| `Paypal Money Received` | `paypal_money_received` | 9 | 8 | legacy |
| `points_transactions` | `points_transactions` | 6 | 6 | app |
| `push_subscriptions` | `push_subscriptions` | 19 | 19 | app |
| `Rebills` | `rebills` | 8 | 8 | app |
| `Αυτοαξιολογηση` | `self_evaluations` | 11 | 10 | legacy |
| `shift_models` | `shift_models` | 16 | 16 | app |
| `shifts` | `shifts` | 23 | 23 | app |
| `spin_wheel_prizes` | `spin_wheel_prizes` | 6 | 6 | app |
| `spin_wheel_spins` | `spin_wheel_spins` | 6 | 6 | app |
| `staff_hours_summary` | `staff_hours_summary` | 10 | 10 | app |
| `staff_task_types` | `staff_task_types` | 8 | 8 | app |
| `system_settings` | `system_settings` | 3 | 3 | app |
| `users` | `users` | 38 | 38 | app |
| `va_content_assignments` | `va_content_assignments` | 15 | 15 | app |
| `va_tasks` | `va_tasks` | 16 | 16 | app |
| `weekly_availability_requests` | `weekly_availability_requests` | 12 | 12 | app |
| `weekly_availability_requests_models` | `weekly_availability_requests_models` | 14 | 14 | app |
| `weekly_availability_requests_va` | `weekly_availability_requests_va` | 12 | 12 | app |
| `weekly_program` | `weekly_program` | 22 | 22 | app |
| `weekly_program_va` | `weekly_program_va` | 22 | 22 | app |
| `whale_activity` | `whale_activity` | 11 | 11 | app |
| `whale_tags` | `whale_tags` | 4 | 4 | app |
| `Whale Tracker` | `whale_tracker` | 9 | 9 | legacy |
| `whale_transactions` | `whale_transactions` | 17 | 17 | app |
| `whales` | `whales` | 34 | 34 | app |

## Code-only tables

- `fines_and_bonuses`
- `link_ab_results`
- `link_page_analytics`
- `link_page_blocks`
- `link_pages`
- `link_redirects`
- `marketing_funnels`
- `marketing_phones`
- `marketing_platforms`
- `mass_lists`
- `model_social_accounts`
- `model_tiers`
- `of_subscribers`
- `pdf_documents`
- `pdf_templates`
- `pricing_rows`
- `pricing_specials`
- `roles`
- `shadowban_reports`
- `shift_queue`
- `sop_departments`
- `sop_feedback`
- `sop_functions`
- `sop_progress`
- `sop_quiz_attempts`
- `sop_quiz_questions`
- `sop_roles`
- `sop_signoffs`
- `tips`
- `va_task_phase_items`
- `va_task_phases`
- `video_transcripts`
- `winner_videos`

## Join tables

- `va_task_assignees`
- `va_task_models`
- `va_content_assignment_vas`
- `client_model_assignments`
- `shift_model_links`
- `custom_request_assignees`
- `sop_role_users`

## Skipped computed fields (sample)

Full list lives as SQL comments in the migration. Examples:

- `billing_cycle_revenues.fee_usd` (formula)
- `billing_cycle_revenues.cycle_period_start` (multipleLookupValues)
- `billing_cycle_revenues.cycle_period_end` (multipleLookupValues)
- `billing_cycle_revenues.fee_usd_safe` (formula)
- `billing_cycle_revenues.cycle_month_key` (formula)
- `billing_cycle_revenues.cycle_kind` (multipleLookupValues)
- `billing_cycles.amount_due` (formula)
- `billing_cycles.total_turnover_usd` (rollup)
- `billing_cycles.total_fee_usd` (rollup)
- `chatter_complaints.deadline` (formula)
- `chatter_performance.week Start` (formula)
- `chatter_performance.previous sales` (multipleLookupValues)
- `chatter_performance.sales delta` (formula)
- `chatter_performance.sales delta %` (formula)
- `chatter_performance.unlock ratio` (formula)
- `chatter_performance.golden ratio` (formula)
- `chatter_performance.ppv spam ratio` (formula)
- `chatter_performance.previous unlock ratio` (multipleLookupValues)
- `chatter_performance.unlock change %` (formula)
- `chatter_performance.unlock delta %` (formula)
- `chatter_performance.performance score` (formula)
- `chatter_performance.verdict` (formula)
- `chatter_performance.system comment` (formula)
- `chatter_performance.locked` (formula)
- `chatter_performance.lock reason` (formula)
- `chatter_performance.report long` (formula)
- `chatter_performance.Performance Tier` (formula)
- `chatter_performance.target met ?` (formula)
- `chatter_performance.weekly target` (formula)
- `chatter_performance.employee_key` (formula)
- `chatter_performance.unlock delta` (formula)
- `chatter_performance.raw data` (formula)
- `chatter_performance.week_index` (formula)
- `chatter_performance.week label` (formula)
- `chatter_performance.weekly target-formula` (formula)
- `chatter_performance.target met?` (formula)
- `chatters.age` (formula)
- `mistakes.Πρόστιμο €` (formula)
- `mss.Full Name` (multipleLookupValues)
- `mss.infloww username` (multipleLookupValues)

…and 4 more.
