-- Atomic + self-healing phase clone for recurring VA tasks.
-- Root cause (Oct 2026): app-level clone inserted phases/items one round-trip at a time,
-- and spawn skipped whenever ANY phase existed. A mid-clone abort left Phase 1 (+ empty
-- Phase 2) permanently incomplete. Prefer-smaller-source scoring then re-selected those
-- incomplete rows as clone templates, poisoning later days.
--
-- This RPC:
-- 1. Runs in a single DB transaction (complete structural heal or rollback on error)
-- 2. Inserts only MISSING phases / items by (phase_number) / (phase_id, sort_order)
-- 3. Never updates/deletes existing items (preserves completed progress)

CREATE OR REPLACE FUNCTION public.clone_va_task_phases_atomic(
  p_source_task_id text,
  p_target_task_id text,
  p_target_title text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_source_phases int := 0;
  v_target_phases int := 0;
  v_phases_created int := 0;
  v_items_created int := 0;
  v_src record;
  v_item record;
  v_tgt_phase_uuid uuid;
  v_tgt_phase_id text;
  v_new_phase_id text;
  v_title text;
  v_claim_ok boolean := false;
  v_src_phase_key text;
  v_i int;
BEGIN
  IF p_source_task_id IS NULL OR btrim(p_source_task_id) = '' THEN
    RAISE EXCEPTION 'source_task_id required';
  END IF;
  IF p_target_task_id IS NULL OR btrim(p_target_task_id) = '' THEN
    RAISE EXCEPTION 'target_task_id required';
  END IF;

  SELECT coalesce(nullif(btrim(p_target_title), ''), t.title, '')
    INTO v_title
  FROM (SELECT 1) _
  LEFT JOIN public.va_tasks t
    ON t.id::text = p_target_task_id OR t.airtable_id = p_target_task_id
  LIMIT 1;
  v_title := coalesce(v_title, '');

  BEGIN
    INSERT INTO public.va_task_clone_claims (task_id) VALUES (p_target_task_id);
    v_claim_ok := true;
  EXCEPTION WHEN unique_violation THEN
    FOR v_i IN 1..40 LOOP
      PERFORM pg_sleep(0.15);
      SELECT count(*)::int INTO v_source_phases
      FROM public.va_task_phases WHERE task_id = p_source_task_id;
      SELECT count(*)::int INTO v_target_phases
      FROM public.va_task_phases WHERE task_id = p_target_task_id;
      IF v_target_phases >= v_source_phases
         AND v_source_phases > 0
         AND NOT EXISTS (
           SELECT 1
           FROM public.va_task_phases sp
           WHERE sp.task_id = p_source_task_id
             AND EXISTS (
               SELECT 1 FROM public.va_task_phase_items si
               WHERE si.phase_id = coalesce(sp.phase_id, sp.id::text)
                  OR si.phase_id = sp.id::text
             )
             AND NOT EXISTS (
               SELECT 1
               FROM public.va_task_phases tp
               JOIN public.va_task_phase_items ti
                 ON ti.phase_id = coalesce(tp.phase_id, tp.id::text)
                 OR ti.phase_id = tp.id::text
               WHERE tp.task_id = p_target_task_id
                 AND tp.phase_number IS NOT DISTINCT FROM sp.phase_number
             )
         )
      THEN
        RETURN jsonb_build_object(
          'ok', true,
          'phases_created', 0,
          'items_created', 0,
          'source_phase_count', v_source_phases,
          'target_phase_count', v_target_phases,
          'waited', true
        );
      END IF;
    END LOOP;

    -- Steal stale claims so a crashed worker cannot block heal forever.
    DELETE FROM public.va_task_clone_claims
    WHERE task_id = p_target_task_id
      AND claimed_at < now() - interval '30 seconds';

    BEGIN
      INSERT INTO public.va_task_clone_claims (task_id) VALUES (p_target_task_id);
      v_claim_ok := true;
    EXCEPTION WHEN unique_violation THEN
      SELECT count(*)::int INTO v_source_phases
      FROM public.va_task_phases WHERE task_id = p_source_task_id;
      SELECT count(*)::int INTO v_target_phases
      FROM public.va_task_phases WHERE task_id = p_target_task_id;
      RETURN jsonb_build_object(
        'ok', false,
        'error', 'clone_in_progress',
        'phases_created', 0,
        'items_created', 0,
        'source_phase_count', v_source_phases,
        'target_phase_count', v_target_phases
      );
    END;
  END;

  BEGIN
    FOR v_src IN
      SELECT *
      FROM public.va_task_phases
      WHERE task_id = p_source_task_id
      ORDER BY phase_number NULLS LAST, created_at
    LOOP
      v_src_phase_key := coalesce(nullif(btrim(v_src.phase_id), ''), v_src.id::text);
      v_tgt_phase_uuid := NULL;
      v_tgt_phase_id := NULL;

      SELECT p.id, coalesce(nullif(btrim(p.phase_id), ''), p.id::text)
        INTO v_tgt_phase_uuid, v_tgt_phase_id
      FROM public.va_task_phases p
      WHERE p.task_id = p_target_task_id
        AND p.phase_number IS NOT DISTINCT FROM v_src.phase_number
      LIMIT 1;

      IF v_tgt_phase_uuid IS NULL THEN
        v_new_phase_id :=
          'phase_' || (extract(epoch FROM clock_timestamp()) * 1000)::bigint::text
          || '_' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 4);

        INSERT INTO public.va_task_phases (
          phase_id, task_id, task_title, phase_number, title, description,
          scheduled_time, status, assigned_va_id, assigned_va_name,
          assigned_model_id, assigned_model_name, region, created_at
        ) VALUES (
          v_new_phase_id,
          p_target_task_id,
          v_title,
          v_src.phase_number,
          v_src.title,
          v_src.description,
          v_src.scheduled_time,
          'pending',
          v_src.assigned_va_id,
          v_src.assigned_va_name,
          v_src.assigned_model_id,
          v_src.assigned_model_name,
          v_src.region,
          now()
        )
        RETURNING id, coalesce(nullif(btrim(phase_id), ''), id::text)
        INTO v_tgt_phase_uuid, v_tgt_phase_id;

        v_phases_created := v_phases_created + 1;
      END IF;

      FOR v_item IN
        SELECT *
        FROM public.va_task_phase_items si
        WHERE si.phase_id = v_src_phase_key
           OR si.phase_id = v_src.id::text
        ORDER BY si.sort_order NULLS LAST, si.created_at
      LOOP
        IF NOT EXISTS (
          SELECT 1
          FROM public.va_task_phase_items ti
          WHERE ti.phase_id = v_tgt_phase_id
            AND ti.sort_order IS NOT DISTINCT FROM v_item.sort_order
        ) THEN
          INSERT INTO public.va_task_phase_items (
            item_id, phase_id, task_id, title, description,
            requires_screenshot, status, sort_order, step_type, created_at
          ) VALUES (
            'item_' || (extract(epoch FROM clock_timestamp()) * 1000)::bigint::text
              || '_' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 4),
            v_tgt_phase_id,
            p_target_task_id,
            v_item.title,
            v_item.description,
            coalesce(v_item.requires_screenshot, false),
            'pending',
            v_item.sort_order,
            v_item.step_type,
            now()
          );
          v_items_created := v_items_created + 1;
        END IF;
      END LOOP;
    END LOOP;

    SELECT count(*)::int INTO v_source_phases
    FROM public.va_task_phases WHERE task_id = p_source_task_id;
    SELECT count(*)::int INTO v_target_phases
    FROM public.va_task_phases WHERE task_id = p_target_task_id;

    DELETE FROM public.va_task_clone_claims WHERE task_id = p_target_task_id;

    RETURN jsonb_build_object(
      'ok', true,
      'phases_created', v_phases_created,
      'items_created', v_items_created,
      'source_phase_count', v_source_phases,
      'target_phase_count', v_target_phases
    );
  EXCEPTION WHEN OTHERS THEN
    IF v_claim_ok THEN
      DELETE FROM public.va_task_clone_claims WHERE task_id = p_target_task_id;
    END IF;
    RAISE;
  END;
END;
$$;

COMMENT ON FUNCTION public.clone_va_task_phases_atomic(text, text, text) IS
  'Atomically clone/heal VA task phases+items from source→target. Inserts only missing structure; preserves existing item progress.';

GRANT EXECUTE ON FUNCTION public.clone_va_task_phases_atomic(text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.clone_va_task_phases_atomic(text, text, text) TO authenticated;
