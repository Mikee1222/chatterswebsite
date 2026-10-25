-- Per-form position title + editable Shortlisted/Hired approval message templates (EN/EL).
-- Service-role only (RLS already enabled on application_forms; no anon/authenticated grants).

ALTER TABLE public.application_forms
  ADD COLUMN IF NOT EXISTS position_title text,
  ADD COLUMN IF NOT EXISTS approval_message_templates jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.application_forms.position_title IS
  'Human role label for approval messages (e.g. Chatter, Marketing Executive). Null = neutral wording.';

COMMENT ON COLUMN public.application_forms.approval_message_templates IS
  'Per-status per-language templates: { shortlisted: { en, el }, hired: { en, el } }. Placeholders: {name}, {position}, {form_title}.';

-- Seed Chatters form
UPDATE public.application_forms
SET
  position_title = 'Chatter',
  approval_message_templates = jsonb_build_object(
    'shortlisted', jsonb_build_object(
      'en', $tmpl$Hi {name}! 🎉 Great news — you've been shortlisted for the {position} role at Gunzo Agency!

I was really impressed with your application and I'd love to hop on a quick call to go over the next steps. I'll reach out shortly with a time that works.

If you have any questions in the meantime, feel free to reply here.

Best regards,
The Gunzo Agency Team$tmpl$,
      'el', $tmpl$Γεια σου {name}! 🎉 Έχουμε πολύ καλά νέα — προκριθήκες για τη θέση {position} στο Gunzo Agency!

Μου έκανε πολύ καλή εντύπωση η αίτησή σου και θα ήθελα να κάνουμε μια σύντομη κλήση για τα επόμενα βήματα. Θα επικοινωνήσω σύντομα μαζί σου για ώρα που σε βολεύει.

Αν έχεις οποιαδήποτε απορία μέχρι τότε, μη διστάσεις να μου γράψεις.

Με εκτίμηση,
Η ομάδα του Gunzo Agency$tmpl$
    ),
    'hired', jsonb_build_object(
      'en', $tmpl$Hi {name}! 🎉 Welcome to the Gunzo Agency team! I'm really excited to have you on board as a {position}.

I'll be sending over your account details separately, and we'll get you set up and ready to start. Looking forward to working with you!$tmpl$,
      'el', $tmpl$Γεια σου {name}! 🎉 Καλώς ήρθες στην ομάδα του Gunzo Agency! Χαίρομαι ιδιαίτερα που θα είσαι μαζί μας ως {position}.

Θα σου στείλω τα στοιχεία του λογαριασμού σου ξεχωριστά και θα σε βοηθήσουμε να είσαι έτοιμος/η να ξεκινήσεις. Ανυπομονώ να δουλέψουμε μαζί!$tmpl$
    )
  ),
  updated_at = now()
WHERE slug = 'new-chatters-apply-form';

-- Seed VA / Marketing Executive forms (form title stays "New VA Application"; job is Marketing Executive)
UPDATE public.application_forms
SET
  position_title = 'Marketing Executive',
  approval_message_templates = jsonb_build_object(
    'shortlisted', jsonb_build_object(
      'en', $tmpl$Hi {name}! 🎉 Great news — you've been shortlisted for the {position} role at Gunzo Agency!

I was really impressed with your application and I'd love to hop on a quick call to go over the next steps. I'll reach out shortly with a time that works.

If you have any questions in the meantime, feel free to reply here.

Best regards,
The Gunzo Agency Team$tmpl$,
      'el', $tmpl$Γεια σου {name}! 🎉 Έχουμε πολύ καλά νέα — προκριθήκες για τη θέση {position} στο Gunzo Agency!

Μου έκανε πολύ καλή εντύπωση η αίτησή σου και θα ήθελα να κάνουμε μια σύντομη κλήση για τα επόμενα βήματα. Θα επικοινωνήσω σύντομα μαζί σου για ώρα που σε βολεύει.

Αν έχεις οποιαδήποτε απορία μέχρι τότε, μη διστάσεις να μου γράψεις.

Με εκτίμηση,
Η ομάδα του Gunzo Agency$tmpl$
    ),
    'hired', jsonb_build_object(
      'en', $tmpl$Hi {name}! 🎉 Welcome to the Gunzo Agency team! I'm really excited to have you on board as a {position}.

I'll be sending over your account details separately, and we'll get you set up and ready to start. Looking forward to working with you!$tmpl$,
      'el', $tmpl$Γεια σου {name}! 🎉 Καλώς ήρθες στην ομάδα του Gunzo Agency! Χαίρομαι ιδιαίτερα που θα είσαι μαζί μας ως {position}.

Θα σου στείλω τα στοιχεία του λογαριασμού σου ξεχωριστά και θα σε βοηθήσουμε να είσαι έτοιμος/η να ξεκινήσεις. Ανυπομονώ να δουλέψουμε μαζί!$tmpl$
    )
  ),
  updated_at = now()
WHERE slug IN ('new-va-application', 'new-va-application-copy');
