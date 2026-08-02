-- =============================================================================
-- Phase 1: Initial Postgres schema (Airtable → Supabase)
-- Source: airtable-audit-report.txt (922 fields / 64 tables) + codebase inventory.
--
-- Conventions:
--   * id uuid PK DEFAULT gen_random_uuid()
--   * airtable_id text UNIQUE — Airtable rec… IDs for migration verification
--   * multipleRecordLinks → uuid[] (Phase 3: prefer join tables for hot M2M)
--   * multipleAttachments → text[] of Supabase Storage URLs
--   * singleSelect → text (check constraints in 20260803000003)
--   * formula/rollup/lookup → omitted; see views + app logic
--   * Timestamps: timestamptz (UTC); app displays Europe/Athens
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- activity_logs  (Airtable: 'activity_logs')  [app-critical]
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id text UNIQUE,
  created_time timestamptz DEFAULT now(),
  log_id text,
  actor_user_id text,
  actor_name text,
  action_type text,
  entity_type text,
  entity_id text,
  summary text,
  details text,
  created_at timestamptz,
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_activity_logs_airtable_id ON public.activity_logs (airtable_id);

-- ---------------------------------------------------------------------------
-- billing_cycle_revenues  (Airtable: 'billing_cycle_revenues')  [app-critical]
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.billing_cycle_revenues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id text UNIQUE,
  created_time timestamptz DEFAULT now(),
  auto_number numeric,
  billing_cycle uuid[],
  client uuid[],
  model uuid[],
  turnover_usd numeric,
  fee_percent numeric,
  created_at timestamptz,
  status text,
  updated_at timestamptz DEFAULT now()
);
-- skipped fee_usd (formula)
-- skipped cycle_period_start (multipleLookupValues)
-- skipped cycle_period_end (multipleLookupValues)
-- skipped fee_usd_safe (formula)
-- skipped cycle_month_key (formula)
-- skipped cycle_kind (multipleLookupValues)
-- link billing_cycle → tbl98IpgKQ1PoJPcl
-- link client → tblnCh96pH5wgFAd9
-- link model → tbllapr3hraj7KTJE
CREATE INDEX IF NOT EXISTS idx_billing_cycle_revenues_airtable_id ON public.billing_cycle_revenues (airtable_id);

-- ---------------------------------------------------------------------------
-- billing_cycles  (Airtable: 'billing_cycles')  [app-critical]
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.billing_cycles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id text UNIQUE,
  created_time timestamptz DEFAULT now(),
  auto_number numeric,
  client uuid[],
  kind text,
  period_start date,
  period_end date,
  due_date date,
  amount numeric,
  currency text,
  status text,
  proof_attachment text[],
  payment_submissions uuid[],
  invoices uuid[],
  client_notified_at timestamptz,
  model uuid[],
  model_turnover numeric,
  client_percentage numeric,
  amount_crm numeric,
  model_earnings text,
  client_percentage_snapshot numeric,
  field_currency text,
  submitted_at timestamptz,
  submission uuid[],
  billing_cycle_revenues uuid[],
  updated_at timestamptz DEFAULT now()
);
-- skipped amount_due (formula)
-- skipped total_turnover_usd (rollup)
-- skipped total_fee_usd (rollup)
-- link client → tblnCh96pH5wgFAd9
-- link payment_submissions → tblIk74ettAGHGvF7
-- link invoices → tblJSVVKaFHatpDoq
-- link model → tbllapr3hraj7KTJE
-- link submission → tblIk74ettAGHGvF7
-- link billing_cycle_revenues → tblpl7xcRsOGDp0Xq
CREATE INDEX IF NOT EXISTS idx_billing_cycles_airtable_id ON public.billing_cycles (airtable_id);

-- ---------------------------------------------------------------------------
-- calendar_events  (Airtable: 'calendar_events')  [app-critical]
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id text UNIQUE,
  created_time timestamptz DEFAULT now(),
  title text,
  start_datetime timestamptz,
  end_datetime timestamptz,
  scope text,
  client uuid[],
  notes text,
  updated_at timestamptz DEFAULT now()
);
-- link client → tblnCh96pH5wgFAd9
CREATE INDEX IF NOT EXISTS idx_calendar_events_airtable_id ON public.calendar_events (airtable_id);

-- ---------------------------------------------------------------------------
-- challenge_progress  (Airtable: 'challenge_progress')  [app-critical]
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.challenge_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id text UNIQUE,
  created_time timestamptz DEFAULT now(),
  challenge_id text,
  user_id text,
  current_value numeric,
  completed boolean,
  completed_at timestamptz,
  updated_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_challenge_progress_airtable_id ON public.challenge_progress (airtable_id);
CREATE INDEX IF NOT EXISTS idx_challenge_progress_user_id ON public.challenge_progress (user_id);

-- ---------------------------------------------------------------------------
-- challenges  (Airtable: 'challenges')  [app-critical]
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id text UNIQUE,
  created_time timestamptz DEFAULT now(),
  title text,
  description text,
  target_metric text,
  target_value numeric,
  reward_points numeric,
  start_date date,
  end_date date,
  active boolean,
  created_by text,
  assigned_users text,
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_challenges_airtable_id ON public.challenges (airtable_id);

-- ---------------------------------------------------------------------------
-- chatter_complaints  (Airtable: 'Chatter Complaints')  [LEGACY]
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.chatter_complaints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id text UNIQUE,
  created_time timestamptz DEFAULT now(),
  id_col numeric,
  status text,
  start_date date,
  type text,
  creator uuid[],
  submitted_by uuid[],
  attachments text[],
  field_72238 text,
  updated_at timestamptz DEFAULT now()
);
-- skipped deadline (formula)
-- link creator → tblCSatmon915wSUQ
-- link submitted_by → tbl5x3nbMGDEexCek
CREATE INDEX IF NOT EXISTS idx_chatter_complaints_airtable_id ON public.chatter_complaints (airtable_id);

-- ---------------------------------------------------------------------------
-- chatter_performance  (Airtable: 'Chatter Performance')  [LEGACY]
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.chatter_performance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id text UNIQUE,
  created_time timestamptz DEFAULT now(),
  employeess uuid[],
  sales numeric,
  messages_sent numeric,
  ppvs_sent numeric,
  ppvs_unlocked numeric,
  fans_chatted text,
  previous_week uuid[],
  report_long_text text,
  week_start text,
  infloww_username text,
  from_field_previous_week uuid[],
  date_time_europe_athens text,
  updated_at timestamptz DEFAULT now()
);
-- skipped week Start (formula)
-- skipped previous sales (multipleLookupValues)
-- skipped sales delta (formula)
-- skipped sales delta % (formula)
-- skipped unlock ratio (formula)
-- skipped golden ratio (formula)
-- skipped ppv spam ratio (formula)
-- skipped previous unlock ratio (multipleLookupValues)
-- skipped unlock change % (formula)
-- skipped unlock delta % (formula)
-- skipped performance score (formula)
-- skipped verdict (formula)
-- skipped system comment (formula)
-- skipped locked (formula)
-- skipped lock reason (formula)
-- skipped report long (formula)
-- skipped Performance Tier (formula)
-- skipped target met ? (formula)
-- skipped weekly target (formula)
-- skipped employee_key (formula)
-- skipped unlock delta (formula)
-- skipped raw data (formula)
-- skipped week_index (formula)
-- skipped week label (formula)
-- skipped weekly target-formula (formula)
-- skipped target met? (formula)
-- link employeess → tbl5x3nbMGDEexCek
-- link previous_week → tblNcKlUjureMsnxv
-- link from_field_previous_week → tblNcKlUjureMsnxv
CREATE INDEX IF NOT EXISTS idx_chatter_performance_airtable_id ON public.chatter_performance (airtable_id);

-- ---------------------------------------------------------------------------
-- chatter_points  (Airtable: 'chatter_points')  [app-critical]
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.chatter_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id text UNIQUE,
  created_time timestamptz DEFAULT now(),
  user_id text,
  total_points numeric,
  level text,
  streak_days numeric,
  last_active date,
  spins_available numeric,
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_chatter_points_airtable_id ON public.chatter_points (airtable_id);
CREATE INDEX IF NOT EXISTS idx_chatter_points_user_id ON public.chatter_points (user_id);

-- ---------------------------------------------------------------------------
-- chatters  (Airtable: 'Chatters')  [LEGACY]
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.chatters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id text UNIQUE,
  created_time timestamptz DEFAULT now(),
  full_name text,
  active_chatter boolean,
  infloww_username text,
  date_of_birth date,
  phone_number text,
  email text,
  telegram_username text,
  discord_username text,
  english_level text,
  contract_signed text[],
  daily_working_hours numeric,
  mss_2 uuid[],
  field_49433 uuid[],
  paypal_money_received uuid[],
  rebills uuid[],
  "select" text,
  fines_and_bonuses_legacy uuid[],
  chatting_weekly_progress text,
  employee_reports text,
  self_evaluations uuid[],
  whale_tracker uuid[],
  contract text[],
  chatter_performance uuid[],
  updated_at timestamptz DEFAULT now()
);
-- skipped age (formula)
-- link mss_2 → tblu1mldVYtBp1my4
-- link field_49433 → tblGnteKZr5e2ypww
-- link paypal_money_received → tbldaHCdmb70fiLu5
-- link rebills → tblKv2eZktPVbLRz4
-- link fines_and_bonuses_legacy → tblV4WcS1GBy5MKqu
-- link self_evaluations → tblVY72CmjGFkdoum
-- link whale_tracker → tblGPoc1db1hJDBcs
-- link chatter_performance → tblNcKlUjureMsnxv
CREATE INDEX IF NOT EXISTS idx_chatters_airtable_id ON public.chatters (airtable_id);
CREATE INDEX IF NOT EXISTS idx_chatters_email ON public.chatters (email);

-- ---------------------------------------------------------------------------
-- chatters_apply_form  (Airtable: 'Chatters Apply Form')  [LEGACY]
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.chatters_apply_form (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id text UNIQUE,
  created_time timestamptz DEFAULT now(),
  full_name text,
  telegram_discord_username text,
  phone_number text,
  country_city text,
  date_of_birth date,
  instagram text,
  english_knowlegde text,
  you_can_work text,
  how_many_hours_you_can_work_per_day text,
  you_are_able_to_work text,
  do_you_have_experience_with_onlyfans_or_chatting_if_yes_for_how_long text,
  what_do_you_think_a_fan_is_really_looking_for_on_onlyfans text,
  why_do_you_want_to_work_as_a_chatter text,
  what_are_your_monthly_income_goals text,
  do_you_have_a_stable_internet_connection_and_a_computer text,
  typing_speed text,
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_chatters_apply_form_airtable_id ON public.chatters_apply_form (airtable_id);

-- ---------------------------------------------------------------------------
-- client_models  (Airtable: 'client_models')  [app-critical]
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.client_models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id text UNIQUE,
  created_time timestamptz DEFAULT now(),
  name text,
  client uuid[],
  model uuid[],
  updated_at timestamptz DEFAULT now()
);
-- link client → tblnCh96pH5wgFAd9
-- link model → tbllapr3hraj7KTJE
CREATE INDEX IF NOT EXISTS idx_client_models_airtable_id ON public.client_models (airtable_id);

-- ---------------------------------------------------------------------------
-- clients  (Airtable: 'clients')  [app-critical]
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id text UNIQUE,
  created_time timestamptz DEFAULT now(),
  company_name text,
  display_name text,
  email text,
  password text,
  status text,
  client_models uuid[],
  calendar_events uuid[],
  payment_methods uuid[],
  billing_cycles uuid[],
  user_type text,
  payment_submissions uuid[],
  invoices uuid[],
  push_subscriptions text,
  affiliate_code text,
  referred_by text,
  affiliate_active boolean,
  affiliates_earnings text,
  affiliates_earnings_2 text,
  model_earnings text,
  is_admin boolean,
  client_percentage numeric,
  billing_cycles_2 text,
  net_profit_goal numeric,
  role text,
  portal_access boolean,
  billing_cycle_revenues uuid[],
  updated_at timestamptz DEFAULT now()
);
-- link client_models → tblE0XaQPW2ZDrURg
-- link calendar_events → tblkKdMUIyZIgNjJz
-- link payment_methods → tblelOgtZEirJe1U8
-- link billing_cycles → tbl98IpgKQ1PoJPcl
-- link payment_submissions → tblIk74ettAGHGvF7
-- link invoices → tblJSVVKaFHatpDoq
-- link billing_cycle_revenues → tblpl7xcRsOGDp0Xq
CREATE INDEX IF NOT EXISTS idx_clients_airtable_id ON public.clients (airtable_id);
CREATE INDEX IF NOT EXISTS idx_clients_email ON public.clients (email);

-- ---------------------------------------------------------------------------
-- creators  (Airtable: 'Creators')  [LEGACY]
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.creators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id text UNIQUE,
  created_time timestamptz DEFAULT now(),
  creator_name text,
  creator_of text,
  team text,
  subscription_status text,
  field_70659 uuid[],
  mss uuid[],
  creator_info text,
  customs text,
  paypal_money_received uuid[],
  rebills uuid[],
  whale_tracker uuid[],
  content uuid[],
  updated_at timestamptz DEFAULT now()
);
-- link field_70659 → tblGnteKZr5e2ypww
-- link mss → tblu1mldVYtBp1my4
-- link paypal_money_received → tbldaHCdmb70fiLu5
-- link rebills → tblKv2eZktPVbLRz4
-- link whale_tracker → tblGPoc1db1hJDBcs
-- link content → tbllSrBluMw81VFmK
CREATE INDEX IF NOT EXISTS idx_creators_airtable_id ON public.creators (airtable_id);

-- ---------------------------------------------------------------------------
-- custom_requests  (Airtable: 'custom_requests')  [app-critical]
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.custom_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id text UNIQUE,
  created_time timestamptz DEFAULT now(),
  request_id text,
  chatter_id text,
  model_name text,
  description text,
  fan_username text,
  custom_type text,
  price text,
  priority text,
  status text,
  created_at timestamptz,
  chatter uuid[],
  model uuid[],
  chatter_name text,
  model_schedule uuid[],
  requested_by_chatter uuid[],
  assigned_model uuid[],
  request_title text,
  request_details text,
  deadline_requested text,
  admin_status text,
  model_status text,
  model_scheduled_date timestamptz,
  model_scheduled_start timestamptz,
  model_scheduled_end timestamptz,
  admin_notes text,
  model_notes text,
  linked_schedule_item uuid[],
  whale_username text,
  request_title_col text,
  decline_reason text,
  uploaded_at timestamptz,
  uploaded_by_model boolean,
  model_id text,
  assigned_va text,
  updated_at timestamptz
);
-- link chatter → tblm9n6NKVWPWNAxT
-- link model → tblXckkhp23s267ea
-- link model_schedule → tblSoPUR2txXT5vhH
-- link requested_by_chatter → tblm9n6NKVWPWNAxT
-- link assigned_model → tblXckkhp23s267ea
-- link linked_schedule_item → tblSoPUR2txXT5vhH
CREATE INDEX IF NOT EXISTS idx_custom_requests_airtable_id ON public.custom_requests (airtable_id);
CREATE INDEX IF NOT EXISTS idx_custom_requests_model_id ON public.custom_requests (model_id);

-- ---------------------------------------------------------------------------
-- earnings_config  (Airtable: 'earnings_config')  [app-critical]
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.earnings_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id text UNIQUE,
  created_time timestamptz DEFAULT now(),
  model_id text,
  agency_cut_percent text,
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_earnings_config_airtable_id ON public.earnings_config (airtable_id);
CREATE INDEX IF NOT EXISTS idx_earnings_config_model_id ON public.earnings_config (model_id);

-- ---------------------------------------------------------------------------
-- feedback  (Airtable: 'feedback')  [app-critical]
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id text UNIQUE,
  created_time timestamptz DEFAULT now(),
  feedback_id text,
  user_id text,
  user_name text,
  user_role text,
  type text,
  page text,
  title text,
  description text,
  screenshots text[],
  status text,
  admin_notes text,
  created_at timestamptz,
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_feedback_airtable_id ON public.feedback (airtable_id);
CREATE INDEX IF NOT EXISTS idx_feedback_user_id ON public.feedback (user_id);

-- ---------------------------------------------------------------------------
-- feedback_cc  (Airtable: 'FeedBackcc')  [LEGACY]
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.feedback_cc (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id text UNIQUE,
  created_time timestamptz DEFAULT now(),
  client_name text,
  "1" text,
  chatting_agency text,
  chatting text,
  agency text,
  field_1375 text,
  field_19201 text[],
  "1_10_creator" text,
  field_31578 text,
  field_16159 text,
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_feedback_cc_airtable_id ON public.feedback_cc (airtable_id);

-- ---------------------------------------------------------------------------
-- fines_and_bonuses_legacy  (Airtable: 'Fines & Bonuses')  [app-critical]
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.fines_and_bonuses_legacy (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id text UNIQUE,
  created_time timestamptz DEFAULT now(),
  name numeric,
  chatters uuid[],
  fine_or_bonus text,
  amount numeric,
  reason text,
  date date,
  updated_at timestamptz DEFAULT now()
);
-- link chatters → tbl5x3nbMGDEexCek
CREATE INDEX IF NOT EXISTS idx_fines_and_bonuses_legacy_airtable_id ON public.fines_and_bonuses_legacy (airtable_id);

-- ---------------------------------------------------------------------------
-- invoices  (Airtable: 'invoices')  [app-critical]
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id text UNIQUE,
  created_time timestamptz DEFAULT now(),
  name text,
  billing_cycle uuid[],
  client uuid[],
  invoice_number text,
  sent_to_email text,
  sent_at timestamptz,
  attachment text[],
  viewed_at timestamptz,
  updated_at timestamptz DEFAULT now()
);
-- link billing_cycle → tbl98IpgKQ1PoJPcl
-- link client → tblnCh96pH5wgFAd9
CREATE INDEX IF NOT EXISTS idx_invoices_airtable_id ON public.invoices (airtable_id);

-- ---------------------------------------------------------------------------
-- mistakes  (Airtable: 'Mistakes')  [app-critical]
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.mistakes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id text UNIQUE,
  created_time timestamptz DEFAULT now(),
  mistake_name text,
  points numeric,
  mss uuid[],
  updated_at timestamptz DEFAULT now()
);
-- skipped Πρόστιμο € (formula)
-- link mss → tblu1mldVYtBp1my4
CREATE INDEX IF NOT EXISTS idx_mistakes_airtable_id ON public.mistakes (airtable_id);

-- ---------------------------------------------------------------------------
-- model_content_legacy  (Airtable: 'Model Content')  [LEGACY]
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.model_content_legacy (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id text UNIQUE,
  created_time timestamptz DEFAULT now(),
  field_60496 text,
  creator uuid[],
  sextapes text,
  "3_scripts_with_6_photos" text,
  "20_pussy_photos" text,
  "20_asshole_photos" text,
  "20_outdoor_photos" text,
  "20_bathroom_photos" text,
  "20_feet_pictures" text,
  "10_photos_videos_for_posting" text,
  night_script text,
  morning_script text,
  mistress_content_humiliaton_and_roasting_videos text,
  updated_at timestamptz DEFAULT now()
);
-- link creator → tblCSatmon915wSUQ
CREATE INDEX IF NOT EXISTS idx_model_content_legacy_airtable_id ON public.model_content_legacy (airtable_id);

-- ---------------------------------------------------------------------------
-- model_content_requests  (Airtable: 'model_content_requests')  [app-critical]
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.model_content_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id text UNIQUE,
  created_time timestamptz DEFAULT now(),
  request_id text,
  model_id uuid[],
  model_user_id text,
  type text,
  title text,
  description text,
  status text,
  admin_notes text,
  created_at timestamptz,
  updated_at timestamptz
);
-- link model_id → tblXckkhp23s267ea
CREATE INDEX IF NOT EXISTS idx_model_content_requests_airtable_id ON public.model_content_requests (airtable_id);
CREATE INDEX IF NOT EXISTS idx_model_content_requests_model_id ON public.model_content_requests (model_id);

-- ---------------------------------------------------------------------------
-- model_expense_requests  (Airtable: 'model_expense_requests')  [app-critical]
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.model_expense_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id text UNIQUE,
  created_time timestamptz DEFAULT now(),
  request_id text,
  model_id uuid[],
  model_user_id text,
  va_content_assignment_id text,
  assignment_title text,
  type text,
  airbnb_link text,
  notes text,
  status text,
  admin_notes text,
  created_at timestamptz,
  updated_at timestamptz
);
-- link model_id → tblXckkhp23s267ea
CREATE INDEX IF NOT EXISTS idx_model_expense_requests_airtable_id ON public.model_expense_requests (airtable_id);
CREATE INDEX IF NOT EXISTS idx_model_expense_requests_model_id ON public.model_expense_requests (model_id);

-- ---------------------------------------------------------------------------
-- model_groups  (Airtable: 'model_groups')  [app-critical]
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.model_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id text UNIQUE,
  created_time timestamptz DEFAULT now(),
  name text,
  model_ids uuid[],
  description text,
  created_at timestamptz,
  updated_at timestamptz DEFAULT now()
);
-- link model_ids → tblXckkhp23s267ea
CREATE INDEX IF NOT EXISTS idx_model_groups_airtable_id ON public.model_groups (airtable_id);

-- ---------------------------------------------------------------------------
-- model_live_streams  (Airtable: 'model_live_streams')  [app-critical]
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.model_live_streams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id text UNIQUE,
  created_time timestamptz DEFAULT now(),
  live_id text,
  model uuid[],
  date timestamptz,
  week_start timestamptz,
  title text,
  planned_start timestamptz,
  planned_end timestamptz,
  actual_start timestamptz,
  actual_end timestamptz,
  status text,
  platform text,
  details_en text,
  details_es text,
  notes text,
  linked_schedule_item uuid[],
  created_at timestamptz,
  updated_at timestamptz,
  details text
);
-- link model → tblXckkhp23s267ea
-- link linked_schedule_item → tblSoPUR2txXT5vhH
CREATE INDEX IF NOT EXISTS idx_model_live_streams_airtable_id ON public.model_live_streams (airtable_id);

-- ---------------------------------------------------------------------------
-- model_periods  (Airtable: 'model_periods')  [app-critical]
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.model_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id text UNIQUE,
  created_time timestamptz DEFAULT now(),
  start_date date,
  model_id uuid[],
  end_date date,
  cycle_length_days numeric,
  period_length_days numeric,
  notes text,
  logged_by text,
  created_at timestamptz,
  predicted_next_date date,
  came_early boolean,
  tracking_enabled boolean,
  missed_period boolean,
  updated_at timestamptz DEFAULT now()
);
-- link model_id → tblXckkhp23s267ea
CREATE INDEX IF NOT EXISTS idx_model_periods_airtable_id ON public.model_periods (airtable_id);
CREATE INDEX IF NOT EXISTS idx_model_periods_model_id ON public.model_periods (model_id);

-- ---------------------------------------------------------------------------
-- model_personal_events  (Airtable: 'model_personal_events')  [app-critical]
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.model_personal_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id text UNIQUE,
  created_time timestamptz DEFAULT now(),
  event_id text,
  model_id uuid[],
  model_user_id text,
  event_type text,
  custom_label text,
  event_date date,
  event_time text,
  notes text,
  reminder_sent boolean,
  created_at timestamptz,
  updated_at timestamptz DEFAULT now()
);
-- link model_id → tblXckkhp23s267ea
CREATE INDEX IF NOT EXISTS idx_model_personal_events_airtable_id ON public.model_personal_events (airtable_id);
CREATE INDEX IF NOT EXISTS idx_model_personal_events_model_id ON public.model_personal_events (model_id);

-- ---------------------------------------------------------------------------
-- model_schedule  (Airtable: 'model_schedule')  [app-critical]
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.model_schedule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id text UNIQUE,
  created_time timestamptz DEFAULT now(),
  schedule_id text,
  week_start date,
  title text,
  priority text,
  status text,
  details text,
  instructions_en text,
  instructions text,
  instructions_es text,
  linked_task_group uuid[],
  linked_custom_request uuid[],
  created_at timestamptz,
  updated_at timestamptz,
  chatter uuid[],
  models uuid[],
  model_name text,
  day text,
  start_time timestamptz,
  end_time timestamptz,
  notes text,
  item_type text,
  date timestamptz,
  duration_minutes numeric,
  created_by uuid[],
  model_tasks uuid[],
  model_live_streams uuid[],
  custom_requests uuid[],
  model uuid[],
  model_id text
);
-- link linked_task_group → tblWxHzLGvXy91Ryl
-- link linked_custom_request → tbl0IdhdPF5n51HVR
-- link chatter → tblm9n6NKVWPWNAxT
-- link models → tblXckkhp23s267ea
-- link created_by → tblm9n6NKVWPWNAxT
-- link model_tasks → tblWxHzLGvXy91Ryl
-- link model_live_streams → tbllNt5zYT9GwmW9L
-- link custom_requests → tbl0IdhdPF5n51HVR
-- link model → tblXckkhp23s267ea
CREATE INDEX IF NOT EXISTS idx_model_schedule_airtable_id ON public.model_schedule (airtable_id);
CREATE INDEX IF NOT EXISTS idx_model_schedule_model_id ON public.model_schedule (model_id);

-- ---------------------------------------------------------------------------
-- model_tasks  (Airtable: 'model_tasks')  [app-critical]
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.model_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id text UNIQUE,
  created_time timestamptz DEFAULT now(),
  task_id text,
  model uuid[],
  schedule_item uuid[],
  date date,
  task_type text,
  title text,
  description_en text,
  description_es text,
  is_required boolean,
  task_status text,
  completed_at timestamptz,
  completion_notes text,
  sort_order numeric,
  created_at timestamptz,
  updated_at timestamptz,
  model_schedule uuid[]
);
-- link model → tblXckkhp23s267ea
-- link schedule_item → tblSoPUR2txXT5vhH
-- link model_schedule → tblSoPUR2txXT5vhH
CREATE INDEX IF NOT EXISTS idx_model_tasks_airtable_id ON public.model_tasks (airtable_id);
CREATE INDEX IF NOT EXISTS idx_model_tasks_task_id ON public.model_tasks (task_id);

-- ---------------------------------------------------------------------------
-- model_time_off_requests  (Airtable: 'model_time_off_requests')  [app-critical]
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.model_time_off_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id text UNIQUE,
  created_time timestamptz DEFAULT now(),
  request_id text,
  model uuid[],
  model_name text,
  start_date date,
  end_date date,
  reason text,
  status text,
  created_at timestamptz,
  updated_at timestamptz DEFAULT now()
);
-- link model → tbllapr3hraj7KTJE
CREATE INDEX IF NOT EXISTS idx_model_time_off_requests_airtable_id ON public.model_time_off_requests (airtable_id);

-- ---------------------------------------------------------------------------
-- models  (Airtable: 'models')  [LEGACY]
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id text UNIQUE,
  created_time timestamptz DEFAULT now(),
  model_name text,
  status text,
  client_models uuid[],
  model_earnings text,
  billing_cycles uuid[],
  billing_cycle_revenues uuid[],
  created_at timestamptz,
  updated_at timestamptz,
  model_id text,
  platform text,
  current_status text,
  current_chatter_id text,
  current_chatter_name text,
  current_shift_id text,
  entered_at timestamptz,
  last_chatter_id text,
  last_chatter_name text,
  last_exit_at timestamptz,
  priority text,
  notes text,
  va_content_assignments text,
  model_schedule text,
  model_time_off_requests uuid[]
);
-- link client_models → tblE0XaQPW2ZDrURg
-- link billing_cycles → tbl98IpgKQ1PoJPcl
-- link billing_cycle_revenues → tblpl7xcRsOGDp0Xq
-- link model_time_off_requests → tblHkNpNdpImBEAJd
CREATE INDEX IF NOT EXISTS idx_models_airtable_id ON public.models (airtable_id);
CREATE INDEX IF NOT EXISTS idx_models_model_id ON public.models (model_id);

-- ---------------------------------------------------------------------------
-- modelss  (Airtable: 'modelss')  [app-critical]
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.modelss (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id text UNIQUE,
  created_time timestamptz DEFAULT now(),
  model_id text,
  model_name text,
  platform text,
  status text,
  current_status text,
  current_chatter_id text,
  current_chatter_name text,
  current_shift_id text,
  entered_at timestamptz,
  last_chatter_id text,
  last_chatter_name text,
  last_exit_at timestamptz,
  priority text,
  notes text,
  created_at timestamptz,
  updated_at timestamptz,
  current_chatter uuid[],
  last_chatter uuid[],
  whales uuid[],
  whale_transactions uuid[],
  shift_models uuid[],
  custom_requests uuid[],
  weekly_program_mistake text,
  weekly_program text,
  weekly_program_mistake_copy uuid[],
  weekly_program_copy uuid[],
  current_chatter_copy uuid[],
  language_default text,
  timezone text,
  weekly_program_va_copy uuid[],
  weekly_program_va_copy_col uuid[],
  model_tasks uuid[],
  model_live_streams uuid[],
  custom_requests_2 uuid[],
  model_schedule uuid[],
  model_periods uuid[],
  last_period_start date,
  avg_cycle_length numeric,
  avg_period_length numeric,
  period_notes text,
  va_content_assignments uuid[],
  period_tracking_enabled boolean,
  model_content_requests uuid[],
  model_expense_requests uuid[],
  model_personal_events uuid[],
  model_groups uuid[]
);
-- link current_chatter → tblm9n6NKVWPWNAxT
-- link last_chatter → tblm9n6NKVWPWNAxT
-- link whales → tblMtye52iPMLsQa5
-- link whale_transactions → tbl5wI9QGTkNYaLkK
-- link shift_models → tblVsf0val8pVtw8b
-- link custom_requests → tbl0IdhdPF5n51HVR
-- link weekly_program_mistake_copy → tbl6oe86r99tJDg1V
-- link weekly_program_copy → tblM3NZiH9TfNthVN
-- link current_chatter_copy → tblm9n6NKVWPWNAxT
-- link weekly_program_va_copy → tblCofIJ5B92hVVxD
-- link weekly_program_va_copy_col → tblSoPUR2txXT5vhH
-- link model_tasks → tblWxHzLGvXy91Ryl
-- link model_live_streams → tbllNt5zYT9GwmW9L
-- link custom_requests_2 → tbl0IdhdPF5n51HVR
-- link model_schedule → tblSoPUR2txXT5vhH
-- link model_periods → tblsThmVHwYAa4mxV
-- link va_content_assignments → tbllyG1vAesYuacnr
-- link model_content_requests → tblN1fROxwWJ5eTII
-- link model_expense_requests → tbltVfVfIfs0076U8
-- link model_personal_events → tblvPLFiLzKLtqKU3
-- link model_groups → tblccO5nIbwmdvcQN
CREATE INDEX IF NOT EXISTS idx_modelss_airtable_id ON public.modelss (airtable_id);
CREATE INDEX IF NOT EXISTS idx_modelss_model_id ON public.modelss (model_id);

-- ---------------------------------------------------------------------------
-- monthly_targets  (Airtable: 'monthly_targets')  [app-critical]
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.monthly_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id text UNIQUE,
  created_time timestamptz DEFAULT now(),
  target_id text,
  month_key text,
  team_member uuid[],
  team_member_name text,
  role text,
  target_amount_usd numeric,
  is_active boolean,
  notes text,
  created_at timestamptz,
  updated_at timestamptz
);
-- link team_member → tblm9n6NKVWPWNAxT
CREATE INDEX IF NOT EXISTS idx_monthly_targets_airtable_id ON public.monthly_targets (airtable_id);

-- ---------------------------------------------------------------------------
-- mss  (Airtable: 'MSS')  [LEGACY]
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.mss (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id text UNIQUE,
  created_time timestamptz DEFAULT now(),
  mistake_id numeric,
  screenshot text[],
  creator uuid[],
  subscriber_name text,
  chatter uuid[],
  mistakes uuid[],
  mistake_date_and_time timestamptz,
  field_12311 text,
  checked boolean,
  sent_to_chatters boolean,
  evi_s_mistake boolean,
  updated_at timestamptz DEFAULT now()
);
-- skipped Full Name (multipleLookupValues)
-- skipped infloww username (multipleLookupValues)
-- skipped Points (multipleLookupValues)
-- skipped Πρόστιμο € (multipleLookupValues)
-- link creator → tblCSatmon915wSUQ
-- link chatter → tbl5x3nbMGDEexCek
-- link mistakes → tblLkdOOfeElTDUqr
CREATE INDEX IF NOT EXISTS idx_mss_airtable_id ON public.mss (airtable_id);

-- ---------------------------------------------------------------------------
-- notification_preferences  (Airtable: 'notification_preferences')  [app-critical]
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id text UNIQUE,
  created_time timestamptz DEFAULT now(),
  preference_id text,
  user_id text,
  push_enabled boolean,
  in_app_enabled boolean,
  critical_only boolean,
  whale_alerts boolean,
  shift_alerts boolean,
  model_alerts boolean,
  system_alerts boolean,
  task_alerts boolean,
  quiet_hours_start text,
  quiet_hours_end text,
  mute_all boolean,
  updated_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_notification_preferences_airtable_id ON public.notification_preferences (airtable_id);
CREATE INDEX IF NOT EXISTS idx_notification_preferences_user_id ON public.notification_preferences (user_id);

-- ---------------------------------------------------------------------------
-- notifications  (Airtable: 'notifications')  [app-critical]
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id text UNIQUE,
  created_time timestamptz DEFAULT now(),
  notification_id text,
  user_id text,
  title text,
  body text,
  type text,
  category text,
  priority text,
  attachments text[],
  entity_type text,
  entity_id text,
  is_read boolean,
  read_at date,
  delivery_status text,
  created_at timestamptz,
  event_type text,
  metadata text,
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notifications_airtable_id ON public.notifications (airtable_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications (user_id);

-- ---------------------------------------------------------------------------
-- payment_methods  (Airtable: 'payment_methods')  [app-critical]
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payment_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id text UNIQUE,
  created_time timestamptz DEFAULT now(),
  label text,
  details text,
  type text,
  scope text,
  network text,
  is_available boolean,
  client uuid[],
  payment_submissions uuid[],
  invoices text,
  open_url text,
  fallback_url text,
  beneficiary text,
  iban text,
  bic text,
  wallet_address text,
  updated_at timestamptz DEFAULT now()
);
-- link client → tblnCh96pH5wgFAd9
-- link payment_submissions → tblIk74ettAGHGvF7
CREATE INDEX IF NOT EXISTS idx_payment_methods_airtable_id ON public.payment_methods (airtable_id);

-- ---------------------------------------------------------------------------
-- payment_submissions  (Airtable: 'payment_submissions')  [app-critical]
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payment_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id text UNIQUE,
  created_time timestamptz DEFAULT now(),
  name text,
  billing_cycle uuid[],
  client uuid[],
  selected_payment_method uuid[],
  submitted_amount numeric,
  submitted_currency text,
  submitted_datetime timestamptz,
  reference_id text,
  note text,
  proof_url text,
  proof_attachment text[],
  status text,
  kind text,
  admin_note text,
  client_seen_at timestamptz,
  kind_col text,
  submitted_at date,
  billing_cycles uuid[],
  updated_at timestamptz DEFAULT now()
);
-- link billing_cycle → tbl98IpgKQ1PoJPcl
-- link client → tblnCh96pH5wgFAd9
-- link selected_payment_method → tblelOgtZEirJe1U8
-- link billing_cycles → tbl98IpgKQ1PoJPcl
CREATE INDEX IF NOT EXISTS idx_payment_submissions_airtable_id ON public.payment_submissions (airtable_id);

-- ---------------------------------------------------------------------------
-- paypal_money_received  (Airtable: 'Paypal Money Received')  [LEGACY]
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.paypal_money_received (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id text UNIQUE,
  created_time timestamptz DEFAULT now(),
  anount numeric,
  creator uuid[],
  chatters uuid[],
  date timestamptz,
  bank text,
  email_revtag text,
  print_screen text[],
  field_6 text,
  updated_at timestamptz DEFAULT now()
);
-- skipped Created By (createdBy)
-- link creator → tblCSatmon915wSUQ
-- link chatters → tbl5x3nbMGDEexCek
CREATE INDEX IF NOT EXISTS idx_paypal_money_received_airtable_id ON public.paypal_money_received (airtable_id);

-- ---------------------------------------------------------------------------
-- points_transactions  (Airtable: 'points_transactions')  [app-critical]
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.points_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id text UNIQUE,
  created_time timestamptz DEFAULT now(),
  user_id text,
  points numeric,
  reason text,
  category text,
  reference_id text,
  created_at timestamptz,
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_points_transactions_airtable_id ON public.points_transactions (airtable_id);
CREATE INDEX IF NOT EXISTS idx_points_transactions_user_id ON public.points_transactions (user_id);

-- ---------------------------------------------------------------------------
-- push_subscriptions  (Airtable: 'push_subscriptions')  [app-critical]
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id text UNIQUE,
  created_time timestamptz DEFAULT now(),
  subscription_id text,
  user_id text,
  device_label text,
  endpoint text,
  p256dh text,
  auth text,
  platform text,
  browser text,
  is_active boolean,
  last_seen_at date,
  created_at timestamptz,
  updated_at timestamptz,
  user_agent text,
  role text,
  actor_user_id text,
  actor_name text,
  event_type text,
  category text,
  metadata text
);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_airtable_id ON public.push_subscriptions (airtable_id);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON public.push_subscriptions (user_id);

-- ---------------------------------------------------------------------------
-- rebills  (Airtable: 'Rebills')  [app-critical]
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.rebills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id text UNIQUE,
  created_time timestamptz DEFAULT now(),
  id_col numeric,
  chatter uuid[],
  creator uuid[],
  sub_name text,
  date_time timestamptz,
  screenshot text[],
  price numeric,
  checked boolean,
  updated_at timestamptz DEFAULT now()
);
-- link chatter → tbl5x3nbMGDEexCek
-- link creator → tblCSatmon915wSUQ
CREATE INDEX IF NOT EXISTS idx_rebills_airtable_id ON public.rebills (airtable_id);

-- ---------------------------------------------------------------------------
-- self_evaluations  (Airtable: 'Αυτοαξιολογηση')  [LEGACY]
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.self_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id text UNIQUE,
  created_time timestamptz DEFAULT now(),
  week date,
  chatter uuid[],
  field_95172 text,
  field_78104 text,
  field_36878 text,
  field_86052 text,
  field_66070 text,
  conversion text,
  field_83762 text,
  field_31503 text,
  updated_at timestamptz DEFAULT now()
);
-- skipped End of week (formula)
-- link chatter → tbl5x3nbMGDEexCek
CREATE INDEX IF NOT EXISTS idx_self_evaluations_airtable_id ON public.self_evaluations (airtable_id);

-- ---------------------------------------------------------------------------
-- shift_models  (Airtable: 'shift_models')  [app-critical]
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.shift_models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id text UNIQUE,
  created_time timestamptz DEFAULT now(),
  shift_model_id text,
  shift_id text,
  chatter_id text,
  chatter_name text,
  model_id text,
  model_name text,
  entered_at timestamptz,
  left_at timestamptz,
  status text,
  session_minutes numeric,
  notes text,
  created_at timestamptz,
  break_minutes numeric,
  chatter uuid[],
  model uuid[],
  shift uuid[],
  updated_at timestamptz DEFAULT now()
);
-- link chatter → tblm9n6NKVWPWNAxT
-- link model → tblXckkhp23s267ea
-- link shift → tblDPIrjV0yf0EFb9
CREATE INDEX IF NOT EXISTS idx_shift_models_airtable_id ON public.shift_models (airtable_id);
CREATE INDEX IF NOT EXISTS idx_shift_models_model_id ON public.shift_models (model_id);
CREATE INDEX IF NOT EXISTS idx_shift_models_shift_id ON public.shift_models (shift_id);

-- ---------------------------------------------------------------------------
-- shifts  (Airtable: 'shifts')  [app-critical]
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id text UNIQUE,
  created_time timestamptz DEFAULT now(),
  shift_id text,
  chatter_id text,
  chatter_name text,
  week_start date,
  date date,
  scheduled_shift text,
  start_time timestamptz,
  end_time timestamptz,
  status text,
  models_count numeric,
  total_minutes numeric,
  notes text,
  created_at timestamptz,
  updated_at timestamptz,
  staff_role text,
  shift_type text,
  task_label text,
  total_hours_decimal numeric,
  break_minutes numeric,
  chatter uuid[],
  shift_models uuid[],
  break_started_at text,
  break_reminder_at text
);
-- link chatter → tblm9n6NKVWPWNAxT
-- link shift_models → tblVsf0val8pVtw8b
CREATE INDEX IF NOT EXISTS idx_shifts_airtable_id ON public.shifts (airtable_id);
CREATE INDEX IF NOT EXISTS idx_shifts_shift_id ON public.shifts (shift_id);

-- ---------------------------------------------------------------------------
-- spin_wheel_prizes  (Airtable: 'spin_wheel_prizes')  [app-critical]
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.spin_wheel_prizes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id text UNIQUE,
  created_time timestamptz DEFAULT now(),
  label text,
  prize_type text,
  prize_value text,
  probability numeric,
  active boolean,
  color text,
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_spin_wheel_prizes_airtable_id ON public.spin_wheel_prizes (airtable_id);

-- ---------------------------------------------------------------------------
-- spin_wheel_spins  (Airtable: 'spin_wheel_spins')  [app-critical]
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.spin_wheel_spins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id text UNIQUE,
  created_time timestamptz DEFAULT now(),
  user_id text,
  prize_id text,
  prize_label text,
  created_at timestamptz,
  claimed boolean,
  claim_note text,
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_spin_wheel_spins_airtable_id ON public.spin_wheel_spins (airtable_id);
CREATE INDEX IF NOT EXISTS idx_spin_wheel_spins_user_id ON public.spin_wheel_spins (user_id);

-- ---------------------------------------------------------------------------
-- staff_hours_summary  (Airtable: 'staff_hours_summary')  [app-critical]
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.staff_hours_summary (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id text UNIQUE,
  created_time timestamptz DEFAULT now(),
  summary_id text,
  user_id text,
  full_name text,
  role text,
  week_start date,
  month_key text,
  total_minutes numeric,
  total_hours_decimal numeric,
  shifts_count numeric,
  last_calculated_at timestamptz,
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_staff_hours_summary_airtable_id ON public.staff_hours_summary (airtable_id);
CREATE INDEX IF NOT EXISTS idx_staff_hours_summary_user_id ON public.staff_hours_summary (user_id);

-- ---------------------------------------------------------------------------
-- staff_task_types  (Airtable: 'staff_task_types')  [app-critical]
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.staff_task_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id text UNIQUE,
  created_time timestamptz DEFAULT now(),
  task_type_id text,
  task_key text,
  task_label text,
  applies_to_role text,
  is_active boolean,
  sort_order numeric,
  description text,
  created_at timestamptz,
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_staff_task_types_airtable_id ON public.staff_task_types (airtable_id);

-- ---------------------------------------------------------------------------
-- system_settings  (Airtable: 'system_settings')  [app-critical]
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.system_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id text UNIQUE,
  created_time timestamptz DEFAULT now(),
  setting_key text,
  setting_value text,
  description text,
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_system_settings_airtable_id ON public.system_settings (airtable_id);

-- ---------------------------------------------------------------------------
-- users  (Airtable: 'users')  [app-critical]
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id text UNIQUE,
  created_time timestamptz DEFAULT now(),
  user_id text,
  full_name text,
  email text,
  role text,
  status text,
  can_login boolean,
  weekly_target_hours numeric,
  notes text,
  created_at timestamptz,
  updated_at timestamptz,
  password_hash text,
  modelss uuid[],
  modelss_2 uuid[],
  linked_model uuid[],
  whales uuid[],
  whale_transactions uuid[],
  whale_activity uuid[],
  shifts uuid[],
  shift_models uuid[],
  custom_requests uuid[],
  weekly_program text,
  weekly_program_copy text,
  weekly_program_mistake_copy uuid[],
  weekly_availability_requests uuid[],
  monthly_targets uuid[],
  weekly_program_copy_col uuid[],
  weekly_availability_requests_copy uuid[],
  language_preference text,
  timezone text,
  weekly_program_va_copy text,
  weekly_program_va_copy_col uuid[],
  model_schedule uuid[],
  custom_requests_2 uuid[],
  va_tasks uuid[],
  va_tasks_col uuid[],
  whales_2 uuid[],
  va_content_assignments uuid[],
  language_default text
);
-- link modelss → tblXckkhp23s267ea
-- link modelss_2 → tblXckkhp23s267ea
-- link linked_model → tblXckkhp23s267ea
-- link whales → tblMtye52iPMLsQa5
-- link whale_transactions → tbl5wI9QGTkNYaLkK
-- link whale_activity → tblteNyg03UaCGkjo
-- link shifts → tblDPIrjV0yf0EFb9
-- link shift_models → tblVsf0val8pVtw8b
-- link custom_requests → tbl0IdhdPF5n51HVR
-- link weekly_program_mistake_copy → tbl6oe86r99tJDg1V
-- link weekly_availability_requests → tbl2GYAeL04TnSZfg
-- link monthly_targets → tblS0zfpPNxqQHAbd
-- link weekly_program_copy_col → tblM3NZiH9TfNthVN
-- link weekly_availability_requests_copy → tblO9HNabWLGbxH8W
-- link weekly_program_va_copy_col → tblSoPUR2txXT5vhH
-- link model_schedule → tblSoPUR2txXT5vhH
-- link custom_requests_2 → tbl0IdhdPF5n51HVR
-- link va_tasks → tblKfeKunLvqesH8j
-- link va_tasks_col → tblKfeKunLvqesH8j
-- link whales_2 → tblMtye52iPMLsQa5
-- link va_content_assignments → tbllyG1vAesYuacnr
CREATE INDEX IF NOT EXISTS idx_users_airtable_id ON public.users (airtable_id);
CREATE INDEX IF NOT EXISTS idx_users_user_id ON public.users (user_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users (email);

-- ---------------------------------------------------------------------------
-- va_content_assignments  (Airtable: 'va_content_assignments')  [app-critical]
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.va_content_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id text UNIQUE,
  created_time timestamptz DEFAULT now(),
  assignment_id text,
  va uuid[],
  model uuid[],
  title text,
  description text,
  content_type text,
  file_url text,
  file_attachment text[],
  deadline timestamptz,
  scheduled_date timestamptz,
  status text,
  priority text,
  model_notes text,
  va_notes text,
  completed_at timestamptz,
  updated_at timestamptz DEFAULT now()
);
-- link va → tblm9n6NKVWPWNAxT
-- link model → tblXckkhp23s267ea
CREATE INDEX IF NOT EXISTS idx_va_content_assignments_airtable_id ON public.va_content_assignments (airtable_id);

-- ---------------------------------------------------------------------------
-- va_tasks  (Airtable: 'va_tasks')  [app-critical]
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.va_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id text UNIQUE,
  created_time timestamptz DEFAULT now(),
  title text,
  description text,
  assigned_to uuid[],
  assigned_by uuid[],
  status text,
  priority text,
  due_date timestamptz,
  is_recurring boolean,
  recurrence_type text,
  recurrence_days text[],
  recurrence_interval numeric,
  recurrence_end_date date,
  reminder_minutes_before numeric,
  completed_at timestamptz,
  completed_notes text,
  created_at timestamptz,
  updated_at timestamptz DEFAULT now()
);
-- link assigned_to → tblm9n6NKVWPWNAxT
-- link assigned_by → tblm9n6NKVWPWNAxT
CREATE INDEX IF NOT EXISTS idx_va_tasks_airtable_id ON public.va_tasks (airtable_id);

-- ---------------------------------------------------------------------------
-- weekly_availability_requests  (Airtable: 'weekly_availability_requests')  [app-critical]
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.weekly_availability_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id text UNIQUE,
  created_time timestamptz DEFAULT now(),
  request_id text,
  week_start timestamptz,
  chatter uuid[],
  status text,
  chatter_name text,
  day text,
  shift_type text,
  custom_start_time timestamptz,
  custom_end_time timestamptz,
  notes text,
  created_at timestamptz,
  entry_type text,
  updated_at timestamptz DEFAULT now()
);
-- link chatter → tblm9n6NKVWPWNAxT
CREATE INDEX IF NOT EXISTS idx_weekly_availability_requests_airtable_id ON public.weekly_availability_requests (airtable_id);

-- ---------------------------------------------------------------------------
-- weekly_availability_requests_models  (Airtable: 'weekly_availability_requests_models')  [app-critical]
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.weekly_availability_requests_models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id text UNIQUE,
  created_time timestamptz DEFAULT now(),
  request_id text,
  week_start date,
  weekly_notes text,
  created_at timestamptz,
  updated_at timestamptz,
  status text,
  model uuid[],
  model_name text,
  day text,
  start_time timestamptz,
  end_time timestamptz,
  notes text,
  entry_type text,
  availability_windows text
);
-- link model → tblXckkhp23s267ea
CREATE INDEX IF NOT EXISTS idx_weekly_availability_requests_models_airtable_id ON public.weekly_availability_requests_models (airtable_id);

-- ---------------------------------------------------------------------------
-- weekly_availability_requests_va  (Airtable: 'weekly_availability_requests_va')  [app-critical]
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.weekly_availability_requests_va (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id text UNIQUE,
  created_time timestamptz DEFAULT now(),
  request_id text,
  week_start date,
  chatter uuid[],
  status text,
  chatter_name text,
  day text,
  shift_type text,
  custom_start_time timestamptz,
  custom_end_time timestamptz,
  notes text,
  created_at timestamptz,
  entry_type text,
  updated_at timestamptz DEFAULT now()
);
-- link chatter → tblm9n6NKVWPWNAxT
CREATE INDEX IF NOT EXISTS idx_weekly_availability_requests_va_airtable_id ON public.weekly_availability_requests_va (airtable_id);

-- ---------------------------------------------------------------------------
-- weekly_program  (Airtable: 'weekly_program')  [app-critical]
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.weekly_program (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id text UNIQUE,
  created_time timestamptz DEFAULT now(),
  program_id text,
  week_start timestamptz,
  chatter_id text,
  chatter_name text,
  monday_shift text,
  tuesday_shift text,
  wednesday_shift text,
  thursday_shift text,
  friday_shift text,
  saturday_shift text,
  sunday_shift text,
  weekly_notes text,
  created_at timestamptz,
  updated_at timestamptz,
  chatter uuid[],
  models uuid[],
  model_name text,
  day text,
  start_time timestamptz,
  end_time timestamptz,
  notes text,
  shift_type text
);
-- link chatter → tblm9n6NKVWPWNAxT
-- link models → tblXckkhp23s267ea
CREATE INDEX IF NOT EXISTS idx_weekly_program_airtable_id ON public.weekly_program (airtable_id);

-- ---------------------------------------------------------------------------
-- weekly_program_va  (Airtable: 'weekly_program_va')  [app-critical]
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.weekly_program_va (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id text UNIQUE,
  created_time timestamptz DEFAULT now(),
  program_id text,
  week_start date,
  chatter_id text,
  chatter_name text,
  monday_shift text,
  tuesday_shift text,
  wednesday_shift text,
  thursday_shift text,
  friday_shift text,
  saturday_shift text,
  sunday_shift text,
  weekly_notes text,
  created_at timestamptz,
  updated_at timestamptz,
  chatter uuid[],
  models uuid[],
  model_name text,
  day text,
  start_time timestamptz,
  end_time timestamptz,
  notes text,
  shift_type text
);
-- link chatter → tblm9n6NKVWPWNAxT
-- link models → tblXckkhp23s267ea
CREATE INDEX IF NOT EXISTS idx_weekly_program_va_airtable_id ON public.weekly_program_va (airtable_id);

-- ---------------------------------------------------------------------------
-- whale_activity  (Airtable: 'whale_activity')  [app-critical]
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.whale_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id text UNIQUE,
  created_time timestamptz DEFAULT now(),
  activity_id text,
  whale_id text,
  whale_username text,
  chatter_id text,
  chatter_name text,
  action_type text,
  summary text,
  details text,
  created_at timestamptz,
  whale uuid[],
  chatter uuid[],
  updated_at timestamptz DEFAULT now()
);
-- link whale → tblMtye52iPMLsQa5
-- link chatter → tblm9n6NKVWPWNAxT
CREATE INDEX IF NOT EXISTS idx_whale_activity_airtable_id ON public.whale_activity (airtable_id);
CREATE INDEX IF NOT EXISTS idx_whale_activity_whale_id ON public.whale_activity (whale_id);

-- ---------------------------------------------------------------------------
-- whale_tags  (Airtable: 'whale_tags')  [app-critical]
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.whale_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id text UNIQUE,
  created_time timestamptz DEFAULT now(),
  tag_id text,
  tag_name text,
  tag_color text,
  description text,
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_whale_tags_airtable_id ON public.whale_tags (airtable_id);

-- ---------------------------------------------------------------------------
-- whale_tracker  (Airtable: 'Whale Tracker')  [LEGACY]
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.whale_tracker (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id text UNIQUE,
  created_time timestamptz DEFAULT now(),
  whale_username text,
  chatter_submited uuid[],
  creator uuid[],
  date_added date,
  status text[],
  attachments text[],
  last_checked date,
  relationship_status text[],
  hours_usually_active text[],
  updated_at timestamptz DEFAULT now()
);
-- link chatter_submited → tbl5x3nbMGDEexCek
-- link creator → tblCSatmon915wSUQ
CREATE INDEX IF NOT EXISTS idx_whale_tracker_airtable_id ON public.whale_tracker (airtable_id);

-- ---------------------------------------------------------------------------
-- whale_transactions  (Airtable: 'whale_transactions')  [app-critical]
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.whale_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id text UNIQUE,
  created_time timestamptz DEFAULT now(),
  transaction_id text,
  whale_id text,
  whale_username text,
  date timestamptz,
  amount numeric,
  currency text,
  type text,
  note text,
  created_at timestamptz,
  chatter_id text,
  chatter_name text,
  model_name text,
  time text,
  session_length_minutes numeric,
  whale uuid[],
  chatter uuid[],
  model uuid[],
  updated_at timestamptz DEFAULT now()
);
-- link whale → tblMtye52iPMLsQa5
-- link chatter → tblm9n6NKVWPWNAxT
-- link model → tblXckkhp23s267ea
CREATE INDEX IF NOT EXISTS idx_whale_transactions_airtable_id ON public.whale_transactions (airtable_id);
CREATE INDEX IF NOT EXISTS idx_whale_transactions_whale_id ON public.whale_transactions (whale_id);

-- ---------------------------------------------------------------------------
-- whales  (Airtable: 'whales')  [app-critical]
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.whales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id text UNIQUE,
  created_time timestamptz DEFAULT now(),
  whale_id text,
  username text,
  assigned_chatter_name text,
  assigned_model_name text,
  hours_active text[],
  platform text,
  assigned_chatter_id text,
  relationship_status text,
  active_hours_start text,
  active_hours_end text,
  timezone text,
  country text,
  language text,
  spend_level text,
  total_spent numeric,
  last_spent_amount numeric,
  last_spent_date timestamptz,
  last_contact_date timestamptz,
  next_followup timestamptz,
  response_speed text,
  personality_type text,
  preferences text,
  red_flags text,
  retention_risk text,
  status text,
  notes text,
  created_at timestamptz,
  updated_at timestamptz,
  last_updated_by text,
  assigned_chatter uuid[],
  assigned_model uuid[],
  whale_transactions uuid[],
  whale_activity uuid[],
  added_by uuid[]
);
-- link assigned_chatter → tblm9n6NKVWPWNAxT
-- link assigned_model → tblXckkhp23s267ea
-- link whale_transactions → tbl5wI9QGTkNYaLkK
-- link whale_activity → tblteNyg03UaCGkjo
-- link added_by → tblm9n6NKVWPWNAxT
CREATE INDEX IF NOT EXISTS idx_whales_airtable_id ON public.whales (airtable_id);
CREATE INDEX IF NOT EXISTS idx_whales_whale_id ON public.whales (whale_id);


-- =============================================================================
-- Code-only tables (referenced in services/scripts; absent from audit dump)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id text UNIQUE,
  created_time timestamptz DEFAULT now(),
  role_id text,
  label text,
  description text,
  permissions text,
  notification_defaults text,
  is_system_role boolean,
  color text,
  created_at timestamptz,
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_roles_airtable_id ON public.roles (airtable_id);

CREATE TABLE IF NOT EXISTS public.fines_and_bonuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id text UNIQUE,
  created_time timestamptz DEFAULT now(),
  entry_id text,
  user_id text,
  user_name text,
  user_role text,
  type text,
  amount numeric,
  reason text,
  notes text,
  month text,
  admin_id text,
  admin_name text,
  created_at timestamptz,
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_fines_and_bonuses_airtable_id ON public.fines_and_bonuses (airtable_id);

CREATE TABLE IF NOT EXISTS public.of_subscribers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id text UNIQUE,
  created_time timestamptz DEFAULT now(),
  of_user_id numeric,
  of_account_id text,
  model_name text,
  display_name text,
  username text,
  subscribed_at timestamptz,
  expires_at timestamptz,
  last_synced_at timestamptz,
  total_spent numeric,
  category text,
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_of_subscribers_airtable_id ON public.of_subscribers (airtable_id);

CREATE TABLE IF NOT EXISTS public.model_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id text UNIQUE,
  created_time timestamptz DEFAULT now(),
  model_name text,
  tier text,
  is_active boolean,
  sort_order numeric,
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_model_tiers_airtable_id ON public.model_tiers (airtable_id);

CREATE TABLE IF NOT EXISTS public.mass_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id text UNIQUE,
  created_time timestamptz DEFAULT now(),
  name text,
  emoji text,
  type text,
  description text,
  is_different_mass boolean,
  applies_to_all_models boolean,
  model_names text,
  is_active boolean,
  sort_order numeric,
  created_at timestamptz,
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mass_lists_airtable_id ON public.mass_lists (airtable_id);

CREATE TABLE IF NOT EXISTS public.link_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id text UNIQUE,
  created_time timestamptz DEFAULT now(),
  page_id text,
  model_id text,
  slug text,
  status text,
  title text,
  bio text,
  profile_photo_url text,
  background_type text,
  background_value text,
  theme text,
  primary_color text,
  accent_color text,
  font text,
  custom_domain text,
  show_powered_by boolean,
  meta_description text,
  verified boolean,
  ab_test_enabled boolean,
  ab_variant_id text,
  ab_test_name text,
  ab_winner text,
  ab_started_at timestamptz,
  meta_pixel_id text,
  tiktok_pixel_id text,
  cookie_notice_enabled boolean,
  cookie_notice_text text,
  bio_color text,
  name_color text,
  created_at timestamptz,
  updated_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_link_pages_airtable_id ON public.link_pages (airtable_id);

CREATE TABLE IF NOT EXISTS public.link_page_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id text UNIQUE,
  created_time timestamptz DEFAULT now(),
  block_id text,
  page_id text,
  block_type text,
  sort_order numeric,
  is_visible boolean,
  label text,
  url text,
  icon text,
  sublabel text,
  style text,
  platform text,
  custom_button_color text,
  photo_urls text,
  countdown_target timestamptz,
  heading_text text,
  created_at timestamptz,
  updated_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_link_page_blocks_airtable_id ON public.link_page_blocks (airtable_id);

CREATE TABLE IF NOT EXISTS public.link_redirects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id text UNIQUE,
  created_time timestamptz DEFAULT now(),
  redirect_id text,
  page_id text,
  slug text,
  destination_url text,
  label text,
  click_count numeric,
  is_active boolean,
  created_at timestamptz,
  updated_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_link_redirects_airtable_id ON public.link_redirects (airtable_id);

CREATE TABLE IF NOT EXISTS public.link_ab_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id text UNIQUE,
  created_time timestamptz DEFAULT now(),
  event_id text,
  page_id text,
  variant text,
  event_type text,
  session_id text,
  block_id text,
  timestamp timestamptz,
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_link_ab_results_airtable_id ON public.link_ab_results (airtable_id);

CREATE TABLE IF NOT EXISTS public.link_page_analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id text UNIQUE,
  created_time timestamptz DEFAULT now(),
  event_id text,
  page_id text,
  block_id text,
  event_type text,
  ip_address text,
  country text,
  city text,
  region text,
  device_type text,
  browser text,
  os text,
  referrer text,
  user_agent text,
  session_id text,
  visitor_id text,
  is_new_visitor boolean,
  is_new_session boolean,
  timestamp timestamptz,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_link_page_analytics_airtable_id ON public.link_page_analytics (airtable_id);

CREATE TABLE IF NOT EXISTS public.va_task_phases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id text UNIQUE,
  created_time timestamptz DEFAULT now(),
  phase_id text,
  task_id text,
  task_title text,
  phase_number numeric,
  title text,
  description text,
  scheduled_time timestamptz,
  start_time timestamptz,
  end_time timestamptz,
  status text,
  assigned_va_id text,
  assigned_va_name text,
  assigned_model_id text,
  assigned_model_name text,
  region text,
  completed_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_va_task_phases_airtable_id ON public.va_task_phases (airtable_id);

CREATE TABLE IF NOT EXISTS public.va_task_phase_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id text UNIQUE,
  created_time timestamptz DEFAULT now(),
  item_id text,
  phase_id text,
  task_id text,
  title text,
  description text,
  requires_screenshot boolean,
  screenshot text[],
  status text,
  completed_by_va_id text,
  completed_by_va_name text,
  completed_at timestamptz,
  sort_order numeric,
  step_type text,
  created_at timestamptz,
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_va_task_phase_items_airtable_id ON public.va_task_phase_items (airtable_id);

CREATE TABLE IF NOT EXISTS public.shift_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id text UNIQUE,
  created_time timestamptz DEFAULT now(),
  queue_id text,
  chatter_id text,
  chatter_name text,
  selected_model_ids text,
  selected_model_names text,
  status text,
  queue_type text,
  target_shift_id text,
  waiting_for_shift_id text,
  waiting_for_chatter_name text,
  created_at timestamptz,
  started_at timestamptz,
  cancelled_at timestamptz,
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_shift_queue_airtable_id ON public.shift_queue (airtable_id);

CREATE TABLE IF NOT EXISTS public.pricing_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id text UNIQUE,
  created_time timestamptz DEFAULT now(),
  row_key text,
  model_tier text,
  spender_tier text,
  video_number numeric,
  price_normal text,
  price_negotiation text,
  description text,
  notes text,
  is_active boolean,
  sort_order numeric,
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pricing_rows_airtable_id ON public.pricing_rows (airtable_id);

CREATE TABLE IF NOT EXISTS public.pricing_specials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id text UNIQUE,
  created_time timestamptz DEFAULT now(),
  label text,
  price_normal text,
  price_negotiation text,
  description text,
  models_applicable text,
  is_active boolean,
  sort_order numeric,
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pricing_specials_airtable_id ON public.pricing_specials (airtable_id);

CREATE TABLE IF NOT EXISTS public.pdf_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id text UNIQUE,
  created_time timestamptz DEFAULT now(),
  template_id text,
  name text,
  description text,
  default_sections text,
  template_config text,
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pdf_templates_airtable_id ON public.pdf_templates (airtable_id);

CREATE TABLE IF NOT EXISTS public.pdf_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id text UNIQUE,
  created_time timestamptz DEFAULT now(),
  title text,
  subtitle text,
  template text,
  sections text,
  meta_fields text,
  created_by text,
  file_url text,
  created_at timestamptz,
  style text,
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pdf_documents_airtable_id ON public.pdf_documents (airtable_id);

CREATE TABLE IF NOT EXISTS public.winner_videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id text UNIQUE,
  created_time timestamptz DEFAULT now(),
  video_id text,
  reference_model_id text,
  reference_model_name text,
  video_link text,
  note text,
  submitted_by_name text,
  submitted_by_id text,
  submitted_at timestamptz,
  status text,
  rejection_reason text,
  reviewed_by_name text,
  reviewed_at timestamptz,
  assigned_creator_name text,
  recreation_deadline timestamptz,
  recreation_link text,
  views_at_submission numeric,
  screenshot text[],
  video_file text[],
  transcript text,
  script_status text,
  script_video_type text,
  script_text text,
  script_submitted_by_name text,
  script_submitted_by_id text,
  script_submitted_at timestamptz,
  script_reviewed_by_name text,
  script_reviewed_at timestamptz,
  script_rejection_reason text,
  content_type text,
  assigned_creative_name text,
  assigned_creative_id text,
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_winner_videos_airtable_id ON public.winner_videos (airtable_id);

CREATE TABLE IF NOT EXISTS public.video_transcripts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id text UNIQUE,
  created_time timestamptz DEFAULT now(),
  label text,
  video_file text[],
  uploaded_by_name text,
  uploaded_by_id text,
  status text,
  transcript text,
  language text,
  duration_seconds numeric,
  created_at timestamptz,
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_video_transcripts_airtable_id ON public.video_transcripts (airtable_id);

CREATE TABLE IF NOT EXISTS public.sop_departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id text UNIQUE,
  created_time timestamptz DEFAULT now(),
  department_id text,
  name text,
  color text,
  sort_order numeric,
  is_active boolean,
  created_at timestamptz,
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sop_departments_airtable_id ON public.sop_departments (airtable_id);

CREATE TABLE IF NOT EXISTS public.sop_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id text UNIQUE,
  created_time timestamptz DEFAULT now(),
  role_id text,
  name text,
  slug text,
  description text,
  icon text,
  color text,
  department uuid[],
  auth_roles text[],
  assigned_users uuid[],
  academy_mode boolean,
  sort_order numeric,
  is_active boolean,
  created_at timestamptz,
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sop_roles_airtable_id ON public.sop_roles (airtable_id);

CREATE TABLE IF NOT EXISTS public.sop_functions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id text UNIQUE,
  created_time timestamptz DEFAULT now(),
  function_id text,
  sop_role uuid[],
  name text,
  department uuid[],
  kpi text,
  standard_type text,
  sop_content text,
  sop_file_url text,
  sop_file_name text,
  loom_url text,
  cadence_type text,
  cadence_note text,
  sort_order numeric,
  is_active boolean,
  content_version numeric,
  created_at timestamptz,
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sop_functions_airtable_id ON public.sop_functions (airtable_id);

CREATE TABLE IF NOT EXISTS public.sop_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id text UNIQUE,
  created_time timestamptz DEFAULT now(),
  progress_id text,
  user_ref uuid[],
  sop_function uuid[],
  sop_role uuid[],
  completed_at timestamptz,
  completed_version numeric,
  quiz_score numeric,
  created_at timestamptz,
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sop_progress_airtable_id ON public.sop_progress (airtable_id);

CREATE TABLE IF NOT EXISTS public.sop_quiz_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id text UNIQUE,
  created_time timestamptz DEFAULT now(),
  question_id text,
  sop_function uuid[],
  question text,
  option_a text,
  option_b text,
  option_c text,
  option_d text,
  correct_option text,
  sort_order numeric,
  is_active boolean,
  created_at timestamptz,
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sop_quiz_questions_airtable_id ON public.sop_quiz_questions (airtable_id);

CREATE TABLE IF NOT EXISTS public.sop_quiz_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id text UNIQUE,
  created_time timestamptz DEFAULT now(),
  attempt_id text,
  user_ref uuid[],
  sop_function uuid[],
  sop_role uuid[],
  score numeric,
  passed boolean,
  wrong_count numeric,
  created_at timestamptz,
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sop_quiz_attempts_airtable_id ON public.sop_quiz_attempts (airtable_id);

CREATE TABLE IF NOT EXISTS public.sop_signoffs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id text UNIQUE,
  created_time timestamptz DEFAULT now(),
  signoff_id text,
  user_ref uuid[],
  sop_role uuid[],
  signed_at timestamptz,
  statement text,
  created_at timestamptz,
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sop_signoffs_airtable_id ON public.sop_signoffs (airtable_id);

CREATE TABLE IF NOT EXISTS public.sop_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id text UNIQUE,
  created_time timestamptz DEFAULT now(),
  feedback_id text,
  user_ref uuid[],
  sop_function uuid[],
  sop_role uuid[],
  helpful text,
  comment text,
  created_at timestamptz,
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sop_feedback_airtable_id ON public.sop_feedback (airtable_id);

CREATE TABLE IF NOT EXISTS public.model_social_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id text UNIQUE,
  created_time timestamptz DEFAULT now(),
  account_id text,
  model_id text,
  model_name text,
  platform text,
  account_link text,
  username text,
  account_type text,
  region text,
  assigned_va_id text,
  assigned_va_name text,
  notes text,
  active boolean,
  last_updated timestamptz,
  created_at timestamptz,
  account_status text,
  shadowban_reported_at timestamptz,
  shadowban_reported_by text,
  shadowban_screenshot text[],
  account_password text,
  linked_phone uuid[],
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_model_social_accounts_airtable_id ON public.model_social_accounts (airtable_id);

CREATE TABLE IF NOT EXISTS public.marketing_phones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id text UNIQUE,
  created_time timestamptz DEFAULT now(),
  device_name text,
  icloud_email text,
  icloud_password text,
  recovery_email text,
  recovery_phone text,
  assigned_va uuid[],
  phone_photos text[],
  notes text,
  active boolean,
  created_at timestamptz,
  file_links text,
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_marketing_phones_airtable_id ON public.marketing_phones (airtable_id);

CREATE TABLE IF NOT EXISTS public.shadowban_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id text UNIQUE,
  created_time timestamptz DEFAULT now(),
  report_id text,
  account_id text,
  model_id text,
  model_name text,
  platform text,
  username text,
  reported_by_id text,
  reported_by_name text,
  reported_by_role text,
  report_type text,
  screenshot text[],
  notes text,
  status text,
  reviewed_by text,
  created_at timestamptz,
  reviewed_at timestamptz,
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_shadowban_reports_airtable_id ON public.shadowban_reports (airtable_id);

CREATE TABLE IF NOT EXISTS public.marketing_funnels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id text UNIQUE,
  created_time timestamptz DEFAULT now(),
  funnel_id text,
  model_id text,
  model_name text,
  label text,
  url text,
  platform text,
  region text,
  active boolean,
  created_at timestamptz,
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_marketing_funnels_airtable_id ON public.marketing_funnels (airtable_id);

CREATE TABLE IF NOT EXISTS public.marketing_platforms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id text UNIQUE,
  created_time timestamptz DEFAULT now(),
  platform_id text,
  name text,
  icon text,
  color text,
  active boolean,
  sort_order numeric,
  created_at timestamptz,
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_marketing_platforms_airtable_id ON public.marketing_platforms (airtable_id);

CREATE TABLE IF NOT EXISTS public.tips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id text UNIQUE,
  created_time timestamptz DEFAULT now(),
  tip_id text,
  chatter_id text,
  chatter_name text,
  model_id text,
  model_name text,
  amount numeric,
  currency text,
  note text,
  created_at timestamptz,
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tips_airtable_id ON public.tips (airtable_id);


-- =============================================================================
-- Normalized join tables (kill Airtable ARRAYJOIN primary-field slug bugs)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.va_task_assignees (
  task_id uuid NOT NULL REFERENCES public.va_tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.va_task_models (
  task_id uuid NOT NULL REFERENCES public.va_tasks(id) ON DELETE CASCADE,
  model_id uuid NOT NULL REFERENCES public.modelss(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, model_id)
);

CREATE TABLE IF NOT EXISTS public.va_content_assignment_vas (
  assignment_id uuid NOT NULL REFERENCES public.va_content_assignments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  PRIMARY KEY (assignment_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.client_model_assignments (
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  model_id uuid NOT NULL REFERENCES public.modelss(id) ON DELETE CASCADE,
  PRIMARY KEY (client_id, model_id)
);

CREATE TABLE IF NOT EXISTS public.shift_model_links (
  shift_id uuid NOT NULL REFERENCES public.shifts(id) ON DELETE CASCADE,
  model_id uuid NOT NULL REFERENCES public.modelss(id) ON DELETE CASCADE,
  PRIMARY KEY (shift_id, model_id)
);

CREATE TABLE IF NOT EXISTS public.custom_request_assignees (
  request_id uuid NOT NULL REFERENCES public.custom_requests(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  PRIMARY KEY (request_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.sop_role_users (
  sop_role_id uuid NOT NULL REFERENCES public.sop_roles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  PRIMARY KEY (sop_role_id, user_id)
);

CREATE TABLE IF NOT EXISTS public._airtable_id_map (
  airtable_id text PRIMARY KEY,
  table_name text NOT NULL,
  supabase_id uuid NOT NULL,
  migrated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_airtable_id_map_table ON public._airtable_id_map (table_name);

-- Fee recomputation (replaces Airtable fee_usd formula)
CREATE OR REPLACE VIEW public.v_billing_cycle_revenues AS
SELECT
  r.*,
  CASE
    WHEN r.fee_percent IS NULL OR r.turnover_usd IS NULL THEN NULL
    ELSE round(r.turnover_usd * r.fee_percent / 100.0, 2)
  END AS fee_usd_computed
FROM public.billing_cycle_revenues r;

CREATE OR REPLACE VIEW public.v_billing_cycle_revenue_totals AS
SELECT
  unnest(billing_cycle) AS billing_cycle_id,
  SUM(turnover_usd) AS total_turnover_usd,
  SUM(CASE
    WHEN fee_percent IS NULL OR turnover_usd IS NULL THEN 0
    ELSE turnover_usd * fee_percent / 100.0
  END) AS total_fee_usd
FROM public.billing_cycle_revenues
WHERE billing_cycle IS NOT NULL AND cardinality(billing_cycle) > 0
GROUP BY 1;
