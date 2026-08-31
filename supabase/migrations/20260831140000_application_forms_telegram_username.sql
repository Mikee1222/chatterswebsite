-- Add required Telegram username question to New Chatters Apply Form and New VA Application.
-- Inserts after Discord username when present; idempotent per form.

DO $$
DECLARE
  form_rec record;
  anchor_order integer;
  telegram_exists boolean;
BEGIN
  FOR form_rec IN
    SELECT id FROM public.application_forms
    WHERE slug IN ('new-chatters-apply-form', 'new-va-application')
  LOOP
    SELECT EXISTS(
      SELECT 1 FROM public.application_form_questions
      WHERE form_id = form_rec.id
        AND question_text ILIKE 'Telegram username%'
    ) INTO telegram_exists;

    IF telegram_exists THEN
      CONTINUE;
    END IF;

    SELECT display_order INTO anchor_order
    FROM public.application_form_questions
    WHERE form_id = form_rec.id
      AND question_text ILIKE 'Discord username%'
    ORDER BY display_order
    LIMIT 1;

    IF anchor_order IS NULL THEN
      SELECT display_order INTO anchor_order
      FROM public.application_form_questions
      WHERE form_id = form_rec.id
        AND question_text ILIKE 'Full Name%'
      ORDER BY display_order
      LIMIT 1;
    END IF;

    IF anchor_order IS NULL THEN
      SELECT COALESCE(MAX(display_order), -1) INTO anchor_order
      FROM public.application_form_questions
      WHERE form_id = form_rec.id;
    END IF;

    UPDATE public.application_form_questions
    SET display_order = display_order + 1,
        updated_at = now()
    WHERE form_id = form_rec.id
      AND display_order > anchor_order;

    INSERT INTO public.application_form_questions (
      form_id,
      question_text,
      question_text_el,
      question_type,
      options,
      options_el,
      is_required,
      display_order,
      created_at,
      updated_at
    ) VALUES (
      form_rec.id,
      'Telegram username (e.g. @username)',
      'Telegram username (π.χ. @username)',
      'short_text',
      '[]'::jsonb,
      '[]'::jsonb,
      true,
      anchor_order + 1,
      now(),
      now()
    );
  END LOOP;
END $$;
