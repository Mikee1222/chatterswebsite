-- =============================================================================
-- Phase 1: critical check constraints + Storage buckets for attachments.
-- notification event_type list synced from lib/notifications-schema.ts
-- (+ admin variants from lib/notification-admin-variants.ts). Keep in sync.
-- =============================================================================

ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_event_type_check;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_event_type_check
  CHECK (
    event_type IS NULL OR event_type IN (
      'shift_started',
      'shift_ended',
      'shift_late',
      'shift_no_show',
      'model_became_free',
      'model_taken',
      'model_live_started',
      'model_live_ended',
      'whale_registered',
      'whale_assigned',
      'custom_request_created',
      'custom_request_updated',
      'period_3_day_reminder',
      'period_predicted_day',
      'period_confirmed_early',
      'period_overdue',
      'period_prediction_reset',
      'system_alert',
      'task_shift_started',
      'task_shift_ended',
      'task_completed',
      'task_overdue',
      'tasks_not_started',
      'va_task_reminder',
      'va_task_assigned',
      'phase_task_completed',
      'phase_completed',
      'phase_overdue',
      'all_phases_completed',
      'model_content_request_created',
      'model_content_request_reviewed',
      'billing_due_reminder',
      'va_content_scheduled',
      'va_content_completed',
      'custom_request_uploaded',
      'chatter_mistake',
      'chatter_mistake_reviewed',
      'fine_issued',
      'bonus_awarded',
      'fine_bonus_reviewed',
      'shadowban_report',
      'shadowban_submitted',
      'shadowban_resolved',
      'shadowban_lifted_reported',
      'sop_quiz_passed',
      'sop_quiz_failed',
      'schedule_published',
      'winner_video_approved',
      'winner_video_rejected',
      'spin_result',
      'login_new_device',
      'password_changed',
      'payment_rejected',
      'winner_video_submitted',
      'research_assigned_to_creative',
      'creative_script_submitted',
      'creative_script_approved',
      'creative_script_rejected',
      'creative_script_resubmitted',
      'spot_check_logged',
      'spot_check_status_changed',
      'tip_approved',
      'tip_rejected',
      'rebill_verified',
      'rebill_rejected',
      'model_schedule_created',
      'feedback_submitted',
      'rebill_submitted',
      'extra_revenue_submitted',
      'expense_submitted',
      'time_off_requested',
      'period_logged',
      'shift_started_admin',
      'shift_ended_admin',
      'shift_late_admin',
      'shift_no_show_admin',
      'shift_overtime_admin',
      'shift_running_long_admin',
      'chatter_no_models_admin',
      'break_started_admin',
      'break_ended_admin',
      'break_exceeded_admin',
      'break_too_long_admin',
      'task_started_admin',
      'task_finished_admin',
      'task_shift_started_admin',
      'task_shift_ended_admin',
      'task_completed_admin',
      'task_overdue_admin',
      'tasks_not_started_admin',
      'phase_task_completed_admin',
      'phase_completed_admin',
      'phase_overdue_admin',
      'all_phases_completed_admin',
      'model_became_free_admin',
      'model_taken_admin',
      'model_live_started_admin',
      'model_live_ended_admin',
      'model_missed_live_admin',
      'model_content_completed_admin',
      'model_content_scheduled_admin',
      'va_content_assigned_admin',
      'va_content_scheduled_admin',
      'va_content_completed_admin',
      'custom_request_uploaded_admin',
      'whale_registered_admin',
      'whale_assigned_admin',
      'whale_followup_admin',
      'whale_spent_admin',
      'whale_session_submitted_admin',
      'custom_request_created_admin',
      'custom_request_updated_admin',
      'custom_request_submitted_admin',
      'custom_status_changed_admin',
      'custom_approved_admin',
      'custom_rejected_admin',
      'custom_declined_admin',
      'custom_edited_admin',
      'custom_uploaded_admin',
      'custom_scheduled_admin',
      'custom_deadline_approaching_admin',
      'custom_overdue_admin',
      'form_submitted_admin',
      'schedule_updated_admin',
      'availability_submitted_admin',
      'user_created_admin',
      'points_awarded_admin',
      'level_up_admin',
      'challenge_completed_admin',
      'spin_result_admin',
      'sop_academy_training_complete_admin',
      'sop_academy_signed_off_admin',
      'payment_submitted_admin',
      'billing_payment_submitted_admin',
      'expense_approved_admin',
      'expense_rejected_admin',
      'chatter_mistake_admin',
      'chatter_mistake_reviewed_admin',
      'fine_issued_admin',
      'bonus_awarded_admin',
      'fine_bonus_reviewed_admin',
      'shadowban_report_admin',
      'shadowban_submitted_admin',
      'shadowban_resolved_admin',
      'shadowban_lifted_reported_admin',
      'period_overdue_admin',
      'billing_cycle_announced_admin',
      'sop_quiz_passed_admin',
      'schedule_published_admin'
    )
  );

-- Common status / role checks (NULL allowed for partial rows during migration)
ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users
  ADD CONSTRAINT users_role_check
  CHECK (role IS NULL OR role IN (
    'admin','manager','chatter','virtual_assistant','model','client'
  ));

ALTER TABLE public.va_tasks
  DROP CONSTRAINT IF EXISTS va_tasks_status_check;
ALTER TABLE public.va_tasks
  ADD CONSTRAINT va_tasks_status_check
  CHECK (status IS NULL OR status IN ('pending','in_progress','done','skipped'));

ALTER TABLE public.feedback
  DROP CONSTRAINT IF EXISTS feedback_status_check;
ALTER TABLE public.feedback
  ADD CONSTRAINT feedback_status_check
  CHECK (status IS NULL OR status IN ('new','in_review','resolved','wont_fix'));

-- Storage buckets (attachments previously in Airtable multipleAttachments)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('attachments', 'attachments', false, 52428800, NULL),
  ('feedback-screenshots', 'feedback-screenshots', false, 20971520, ARRAY['image/png','image/jpeg','image/webp','image/gif']),
  ('payment-proofs', 'payment-proofs', false, 52428800, NULL),
  ('link-page-assets', 'link-page-assets', true, 20971520, ARRAY['image/png','image/jpeg','image/webp','image/gif','image/svg+xml']),
  ('sop-files', 'sop-files', false, 104857600, NULL),
  ('winner-videos', 'winner-videos', false, 524288000, NULL)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  DROP POLICY IF EXISTS "service_role_attachments_all" ON storage.objects;
  CREATE POLICY "service_role_attachments_all"
    ON storage.objects
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

  DROP POLICY IF EXISTS "public_read_link_page_assets" ON storage.objects;
  CREATE POLICY "public_read_link_page_assets"
    ON storage.objects
    FOR SELECT
    TO anon, authenticated
    USING (bucket_id = 'link-page-assets');
EXCEPTION
  WHEN undefined_table THEN
    RAISE NOTICE 'storage.objects not present — skip storage policies (apply on Supabase)';
  WHEN undefined_object THEN
    RAISE NOTICE 'storage roles/policies skipped';
END $$;
