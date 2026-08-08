-- Phase 1 RLS: service-role only (matches 20260806240000_winner_video_sourcing.sql
-- and 20260803000002_rls_service_role.sql). These tables were added after the
-- blanket RLS pass and were flagged by Supabase advisors as missing RLS.

ALTER TABLE public.filming_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.icloud_folder_entries ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  BEGIN
    REVOKE ALL ON TABLE public.filming_schedule FROM anon, authenticated;
    REVOKE ALL ON TABLE public.icloud_folder_entries FROM anon, authenticated;
  EXCEPTION WHEN undefined_object THEN
    NULL;
  END;
END $$;
