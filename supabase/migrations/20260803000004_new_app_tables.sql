-- =============================================================================
-- Phase 1 follow-up: newly discovered Airtable tables + core-table column gaps
-- Project: wagfkuxkrgsencartqtx
-- Conventions match 20260803000001_init_schema.sql
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Core table column gaps (added to Airtable after Phase 1 audit)
-- ---------------------------------------------------------------------------

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS secondary_role text,
  ADD COLUMN IF NOT EXISTS va_type text,
  ADD COLUMN IF NOT EXISTS telegram_username text,
  ADD COLUMN IF NOT EXISTS last_login_user_agent text,
  ADD COLUMN IF NOT EXISTS compensation_type text,
  ADD COLUMN IF NOT EXISTS compensation_value numeric,
  ADD COLUMN IF NOT EXISTS contract_attachments text[],
  ADD COLUMN IF NOT EXISTS collaboration_start_date date,
  ADD COLUMN IF NOT EXISTS collaboration_end_date date,
  ADD COLUMN IF NOT EXISTS phones uuid[],
  ADD COLUMN IF NOT EXISTS sop_roles uuid[],
  ADD COLUMN IF NOT EXISTS sop_progress uuid[],
  ADD COLUMN IF NOT EXISTS sop_signoffs uuid[],
  ADD COLUMN IF NOT EXISTS sop_quiz_attempts uuid[],
  ADD COLUMN IF NOT EXISTS sop_feedback uuid[];

ALTER TABLE public.modelss
  ADD COLUMN IF NOT EXISTS of_user_id text,
  ADD COLUMN IF NOT EXISTS team text,
  ADD COLUMN IF NOT EXISTS paypal_email text,
  ADD COLUMN IF NOT EXISTS paypal_link text,
  ADD COLUMN IF NOT EXISTS revolut_tag text,
  ADD COLUMN IF NOT EXISTS payment_notes text,
  ADD COLUMN IF NOT EXISTS payment_threshold_eur numeric,
  ADD COLUMN IF NOT EXISTS client_models uuid[],
  ADD COLUMN IF NOT EXISTS billing_cycle_revenues uuid[],
  ADD COLUMN IF NOT EXISTS billing_cycles uuid[];

ALTER TABLE public.shifts
  ADD COLUMN IF NOT EXISTS worked_minutes numeric;

-- ---------------------------------------------------------------------------
-- mistake_reasons  (Airtable: 'mistake_reasons')
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.mistake_reasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id text UNIQUE,
  created_time timestamptz DEFAULT now(),
  reason_id text,
  label text,
  category text,
  points_deduction numeric,
  active boolean,
  sort_order numeric,
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mistake_reasons_airtable_id ON public.mistake_reasons (airtable_id);
CREATE INDEX IF NOT EXISTS idx_mistake_reasons_reason_id ON public.mistake_reasons (reason_id);

-- ---------------------------------------------------------------------------
-- chatter_mistakes  (Airtable: 'chatter_mistakes')
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.chatter_mistakes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id text UNIQUE,
  created_time timestamptz DEFAULT now(),
  mistake_id text,
  va_id text,
  va_name text,
  chatter_id text,
  chatter_name text,
  model_id text,
  model_name text,
  sub_username text,
  mistake_date timestamptz,
  reason_id text,
  reason_label text,
  reason_category text,
  explanation text,
  screenshot text[],
  status text,
  admin_notes text,
  admin_id text,
  reviewed_at timestamptz,
  points_deducted numeric,
  created_at timestamptz,
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_chatter_mistakes_airtable_id ON public.chatter_mistakes (airtable_id);
CREATE INDEX IF NOT EXISTS idx_chatter_mistakes_chatter_id ON public.chatter_mistakes (chatter_id);
CREATE INDEX IF NOT EXISTS idx_chatter_mistakes_status ON public.chatter_mistakes (status);

-- ---------------------------------------------------------------------------
-- model_funnel_links  (Airtable: 'model_funnel_links')
-- Replaces removed marketing_funnels (kept empty for historical schema only)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.model_funnel_links (
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
CREATE INDEX IF NOT EXISTS idx_model_funnel_links_airtable_id ON public.model_funnel_links (airtable_id);
CREATE INDEX IF NOT EXISTS idx_model_funnel_links_model_id ON public.model_funnel_links (model_id);

-- ---------------------------------------------------------------------------
-- task_templates  (Airtable: 'task_templates')
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.task_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id text UNIQUE,
  created_time timestamptz DEFAULT now(),
  template_id text,
  name text,
  description text,
  category text,
  is_active boolean,
  created_at timestamptz,
  task_template_phases uuid[],
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_task_templates_airtable_id ON public.task_templates (airtable_id);
CREATE INDEX IF NOT EXISTS idx_task_templates_template_id ON public.task_templates (template_id);

-- ---------------------------------------------------------------------------
-- task_template_phases  (Airtable: 'task_template_phases')
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.task_template_phases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id text UNIQUE,
  created_time timestamptz DEFAULT now(),
  phase_template_id text,
  template uuid[],
  phase_number numeric,
  title text,
  description text,
  task_template_items uuid[],
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_task_template_phases_airtable_id ON public.task_template_phases (airtable_id);

-- ---------------------------------------------------------------------------
-- task_template_items  (Airtable: 'task_template_items')
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.task_template_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id text UNIQUE,
  created_time timestamptz DEFAULT now(),
  item_template_id text,
  phase_template uuid[],
  title text,
  description text,
  requires_screenshot boolean,
  sort_order numeric,
  step_type text,
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_task_template_items_airtable_id ON public.task_template_items (airtable_id);

-- ---------------------------------------------------------------------------
-- marketing_daily_reviews  (Airtable: 'marketing_daily_reviews')
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.marketing_daily_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id text UNIQUE,
  created_time timestamptz DEFAULT now(),
  review_label text,
  review_date date,
  overall_kpis_reviewed text[],
  account_compliance_vs_master text[],
  top_performer_name text,
  top_performer_id text,
  issues_found text,
  actions_assigned text,
  time_spent_minutes numeric,
  manager_name text,
  attachments text[],
  marketing_exec_audits uuid[],
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_marketing_daily_reviews_airtable_id ON public.marketing_daily_reviews (airtable_id);
CREATE INDEX IF NOT EXISTS idx_marketing_daily_reviews_review_date ON public.marketing_daily_reviews (review_date);

-- ---------------------------------------------------------------------------
-- marketing_spot_checks  (Airtable: 'marketing_spot_checks')
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.marketing_spot_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id text UNIQUE,
  created_time timestamptz DEFAULT now(),
  subject text,
  "timestamp" timestamptz,
  manager_name text,
  manager_id text,
  type text,
  exec_va_name text,
  exec_va_id text,
  creator_name text,
  creator_id text,
  what_was_wrong text,
  action_taken text,
  status text,
  resolution_time numeric,
  attachments text[],
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_marketing_spot_checks_airtable_id ON public.marketing_spot_checks (airtable_id);

-- ---------------------------------------------------------------------------
-- marketing_exec_audits  (Airtable: 'marketing_exec_audits')
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.marketing_exec_audits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id text UNIQUE,
  created_time timestamptz DEFAULT now(),
  audit_label text,
  daily_review uuid[],
  exec_va_name text,
  exec_va_id text,
  reviewing_day date,
  phase1_on_time boolean,
  phase2_on_time boolean,
  screenshots_authentic boolean,
  posting_compliance boolean,
  engagement_looks_real boolean,
  issues_found text,
  actions_taken text,
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_marketing_exec_audits_airtable_id ON public.marketing_exec_audits (airtable_id);

-- ---------------------------------------------------------------------------
-- creator_assignments  (Airtable: 'creator_assignments')
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.creator_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id text UNIQUE,
  created_time timestamptz DEFAULT now(),
  assignment_id text,
  user_id text,
  user_name text,
  role text,
  creator_model_id text,
  creator_name text,
  is_active boolean,
  created_at timestamptz,
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_creator_assignments_airtable_id ON public.creator_assignments (airtable_id);
CREATE INDEX IF NOT EXISTS idx_creator_assignments_user_id ON public.creator_assignments (user_id);
CREATE INDEX IF NOT EXISTS idx_creator_assignments_creator_model_id ON public.creator_assignments (creator_model_id);

-- ---------------------------------------------------------------------------
-- research_bunches  (Airtable: 'research_bunches')
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.research_bunches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id text UNIQUE,
  created_time timestamptz DEFAULT now(),
  bunch_id text,
  creator_model_id text,
  creator_name text,
  researcher_user_id text,
  researcher_name text,
  week text,
  status text,
  qa_by_user_id text,
  qa_by_name text,
  submitted_at timestamptz,
  approved_at timestamptz,
  created_at timestamptz,
  target_research numeric,
  target_winner numeric,
  deadline timestamptz,
  assigned_at timestamptz,
  created_by_name text,
  film_type text,
  qa_note text,
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_research_bunches_airtable_id ON public.research_bunches (airtable_id);
CREATE INDEX IF NOT EXISTS idx_research_bunches_bunch_id ON public.research_bunches (bunch_id);
CREATE INDEX IF NOT EXISTS idx_research_bunches_status ON public.research_bunches (status);

-- ---------------------------------------------------------------------------
-- research_ideas  (Airtable: 'research_ideas')
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.research_ideas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id text UNIQUE,
  created_time timestamptz DEFAULT now(),
  idea_id text,
  bunch_id text,
  platform text,
  idea_text text,
  reference_link text,
  checked boolean,
  qa_note text,
  spawned_item_id text,
  created_at timestamptz,
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_research_ideas_airtable_id ON public.research_ideas (airtable_id);
CREATE INDEX IF NOT EXISTS idx_research_ideas_bunch_id ON public.research_ideas (bunch_id);

-- ---------------------------------------------------------------------------
-- content_items  (Airtable: 'content_items')
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.content_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id text UNIQUE,
  created_time timestamptz DEFAULT now(),
  item_id text,
  title text,
  creator_model_id text,
  creator_name text,
  week text,
  source text,
  research_idea_id text,
  winner_video_id text,
  stage text,
  status text,
  assignee_user_id text,
  assignee_name text,
  script_status text,
  script_text text,
  script_video_type text,
  film_type text,
  raw_link text,
  edited_link text,
  post_link text,
  posted_at timestamptz,
  views numeric,
  became_winner boolean,
  stage_entered_at timestamptz,
  priority text,
  notes text,
  created_at timestamptz,
  updated_at timestamptz,
  assigned_at timestamptz,
  deadline timestamptz,
  reference_link text
);
CREATE INDEX IF NOT EXISTS idx_content_items_airtable_id ON public.content_items (airtable_id);
CREATE INDEX IF NOT EXISTS idx_content_items_item_id ON public.content_items (item_id);
CREATE INDEX IF NOT EXISTS idx_content_items_stage ON public.content_items (stage);
CREATE INDEX IF NOT EXISTS idx_content_items_status ON public.content_items (status);

-- ---------------------------------------------------------------------------
-- content_item_events  (Airtable: 'content_item_events')
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.content_item_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  airtable_id text UNIQUE,
  created_time timestamptz DEFAULT now(),
  event_id text,
  item_id text,
  stage text,
  action text,
  actor_user_id text,
  actor_name text,
  "at" timestamptz,
  duration_seconds numeric,
  note text,
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_content_item_events_airtable_id ON public.content_item_events (airtable_id);
CREATE INDEX IF NOT EXISTS idx_content_item_events_item_id ON public.content_item_events (item_id);

-- RLS: enable + revoke anon/authenticated (same as Phase 1)
DO $$
DECLARE
  r text;
BEGIN
  FOREACH r IN ARRAY ARRAY[
    'mistake_reasons',
    'chatter_mistakes',
    'model_funnel_links',
    'task_templates',
    'task_template_phases',
    'task_template_items',
    'marketing_daily_reviews',
    'marketing_spot_checks',
    'marketing_exec_audits',
    'creator_assignments',
    'research_bunches',
    'research_ideas',
    'content_items',
    'content_item_events'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r);
    BEGIN
      EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon, authenticated', r);
    EXCEPTION WHEN undefined_object THEN
      NULL;
    END;
  END LOOP;
END $$;
