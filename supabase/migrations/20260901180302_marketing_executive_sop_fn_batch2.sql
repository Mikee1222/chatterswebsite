-- marketing_executive SOP functions batch 2

INSERT INTO public.sop_functions (
  function_id, name, kpi, standard_type, sop_content, cadence_type, cadence_note,
  sort_order, department, sop_role, is_active, content_version, created_at, updated_at
)
SELECT
  'sop_fn_me_gr_6',
  'TikTok daily post (midday)',
  '2 TT posts/account/day· vertical 9:16 100%',
  'text',
  '**Σκοπός**
Daily TikTok posting — video από assigned iCloud Video To Upload folder (Trial ή Grid path). Δεν επιλέγεις source· ακολουθείς το assigned Task.

**Πότε**
Ανά assigned Task schedule (2 posts/account/day). Order: **Scroll → Like → Post → F4F**.

**Tools**
- iCloud → Video To Upload (assigned day/account/Trial ή Grid)
- TikTok app
- Trending sounds library (TT)

**Steps**
1. 15-min FYP scroll (algorithm warm-up).
2. Download video από assigned iCloud Video To Upload folder.
3. TikTok → + → gallery → select.
4. Add **trending sound** — όχι original IG audio αν repurposed.
5. Caption: 1-2 short lines + 3-5 niche hashtags.
6. Verify vertical 9:16.
7. Post.
8. Stay in app 1-2 minutes (active-user signal).
9. Log post ID/link στο daily sheet.
10. Repeat για 2ο post/account σύμφωνα με Task schedule.

**Time**
6-10 λεπτά ανά post.

**Common mistakes**
- Original IG audio αντί trending TT sound → no velocity push.
- Long caption → kills retention.
- Photo-only post → TT default rejection.
- Post 2 videos μέσα σε 5 λεπτά → split reach.

**Escalation**
- Trial option missing → account not eligible, ping Marketing Manager.
- Assigned folder empty → iCloud Manager.',
  'daily',
  'Ανά assigned Task schedule — 2 posts/account/day',
  6,
  ARRAY['1c6713c4-ffa4-468e-bc2f-bb972cd24182']::uuid[],
  ARRAY[r.id]::uuid[],
  true,
  1,
  now(),
  now()
FROM public.sop_roles r
WHERE r.slug = 'marketing-executive'
  AND NOT EXISTS (
    SELECT 1 FROM public.sop_functions f
    WHERE r.id = ANY(f.sop_role) AND f.sort_order = 6
  );

UPDATE public.sop_functions f SET
  name = 'TikTok daily post (midday)',
  kpi = '2 TT posts/account/day· vertical 9:16 100%',
  sop_content = '**Σκοπός**
Daily TikTok posting — video από assigned iCloud Video To Upload folder (Trial ή Grid path). Δεν επιλέγεις source· ακολουθείς το assigned Task.

**Πότε**
Ανά assigned Task schedule (2 posts/account/day). Order: **Scroll → Like → Post → F4F**.

**Tools**
- iCloud → Video To Upload (assigned day/account/Trial ή Grid)
- TikTok app
- Trending sounds library (TT)

**Steps**
1. 15-min FYP scroll (algorithm warm-up).
2. Download video από assigned iCloud Video To Upload folder.
3. TikTok → + → gallery → select.
4. Add **trending sound** — όχι original IG audio αν repurposed.
5. Caption: 1-2 short lines + 3-5 niche hashtags.
6. Verify vertical 9:16.
7. Post.
8. Stay in app 1-2 minutes (active-user signal).
9. Log post ID/link στο daily sheet.
10. Repeat για 2ο post/account σύμφωνα με Task schedule.

**Time**
6-10 λεπτά ανά post.

**Common mistakes**
- Original IG audio αντί trending TT sound → no velocity push.
- Long caption → kills retention.
- Photo-only post → TT default rejection.
- Post 2 videos μέσα σε 5 λεπτά → split reach.

**Escalation**
- Trial option missing → account not eligible, ping Marketing Manager.
- Assigned folder empty → iCloud Manager.',
  cadence_type = 'daily',
  cadence_note = 'Ανά assigned Task schedule — 2 posts/account/day',
  department = ARRAY['1c6713c4-ffa4-468e-bc2f-bb972cd24182']::uuid[],
  is_active = true,
  updated_at = now()
FROM public.sop_roles r
WHERE r.slug = 'marketing-executive'
  AND r.id = ANY(f.sop_role)
  AND f.sort_order = 6;


INSERT INTO public.sop_functions (
  function_id, name, kpi, standard_type, sop_content, cadence_type, cadence_note,
  sort_order, department, sop_role, is_active, content_version, created_at, updated_at
)
SELECT
  'sop_fn_me_gr_7',
  'Facebook cross-post & accept requests (daily)',
  '1 FB Reel cross-posted/day same-day, 100% legitimate friend requests accepted',
  'text',
  '**Σκοπός**
Daily FB Reel cross-post από IG (+50% distribution boost when same-day) + accept inbound friend requests. FB είναι live channel, όχι passive mirror.

**Πότε**
Καθημερινά. Order: **Cross Post → Accept Requests → Scrolling → Liking**. Min 30 min gap από IG upload στο ίδιο device.

**Tools**
- IG app (source)
- FB app

**Steps**
1. IG → find σημερινό Reel → download video στο phone.
2. FB → Reels → select video.
3. Caption: ίδιο με IG, optionally slightly different hook για FB.
4. Post.
5. Open Friend Requests → accept ΟΛΑ τα legitimate (όχι spam/non-target language/zero-photo profiles).
6. 20-30min Feed scroll, watch niche videos to completion.
7. 30-50 niche post likes με 5-sec gaps. 10-15 niche story likes.

**Time**
20-30 λεπτά (cross-post + accept + scroll).

**Common mistakes**
- Cross-post IG + FB ταυτόχρονα → FB flags as bot.
- Accept Arabic/spam requests → engagement rate tanks.
- 50 likes σε 2-minute burst → spam flag.
- Skip same-day crosspost → lose distribution boost.

**Escalation**
- FB locks accept feature → Marketing Manager (possible feature restriction).
- Friend requests stuck at 0 inbound για 3+ μέρες → re-engage groups (separate SOP).',
  'daily',
  'Καθημερινά, min 30min μετά το IG post',
  7,
  ARRAY['1c6713c4-ffa4-468e-bc2f-bb972cd24182']::uuid[],
  ARRAY[r.id]::uuid[],
  true,
  1,
  now(),
  now()
FROM public.sop_roles r
WHERE r.slug = 'marketing-executive'
  AND NOT EXISTS (
    SELECT 1 FROM public.sop_functions f
    WHERE r.id = ANY(f.sop_role) AND f.sort_order = 7
  );

UPDATE public.sop_functions f SET
  name = 'Facebook cross-post & accept requests (daily)',
  kpi = '1 FB Reel cross-posted/day same-day, 100% legitimate friend requests accepted',
  sop_content = '**Σκοπός**
Daily FB Reel cross-post από IG (+50% distribution boost when same-day) + accept inbound friend requests. FB είναι live channel, όχι passive mirror.

**Πότε**
Καθημερινά. Order: **Cross Post → Accept Requests → Scrolling → Liking**. Min 30 min gap από IG upload στο ίδιο device.

**Tools**
- IG app (source)
- FB app

**Steps**
1. IG → find σημερινό Reel → download video στο phone.
2. FB → Reels → select video.
3. Caption: ίδιο με IG, optionally slightly different hook για FB.
4. Post.
5. Open Friend Requests → accept ΟΛΑ τα legitimate (όχι spam/non-target language/zero-photo profiles).
6. 20-30min Feed scroll, watch niche videos to completion.
7. 30-50 niche post likes με 5-sec gaps. 10-15 niche story likes.

**Time**
20-30 λεπτά (cross-post + accept + scroll).

**Common mistakes**
- Cross-post IG + FB ταυτόχρονα → FB flags as bot.
- Accept Arabic/spam requests → engagement rate tanks.
- 50 likes σε 2-minute burst → spam flag.
- Skip same-day crosspost → lose distribution boost.

**Escalation**
- FB locks accept feature → Marketing Manager (possible feature restriction).
- Friend requests stuck at 0 inbound για 3+ μέρες → re-engage groups (separate SOP).',
  cadence_type = 'daily',
  cadence_note = 'Καθημερινά, min 30min μετά το IG post',
  department = ARRAY['1c6713c4-ffa4-468e-bc2f-bb972cd24182']::uuid[],
  is_active = true,
  updated_at = now()
FROM public.sop_roles r
WHERE r.slug = 'marketing-executive'
  AND r.id = ANY(f.sop_role)
  AND f.sort_order = 7;


INSERT INTO public.sop_functions (
  function_id, name, kpi, standard_type, sop_content, cadence_type, cadence_note,
  sort_order, department, sop_role, is_active, content_version, created_at, updated_at
)
SELECT
  'sop_fn_me_gr_8',
  'Daily Stories cadence (lifestyle slots)',
  '2 lifestyle/engagement stories/day· 100% mix· 0 explicit story bans',
  'text',
  '**Σκοπός**
Daily IG stories — closest touchpoint με audience. 2 lifestyle/engagement stories/day. Builds trust + warms audience πριν το CTA story.

**Πότε**
Καθημερινά, 2 stories spread across the day. Never batch. CTA story ακολουθεί weekly Link A/B schedule (model_story_link_config): Δευτέρα Link A, Τετάρτη Link B, Παρασκευή Highlights redirect, Σάββατο Link A.

**Tools**
- iCloud → Stories To Upload → Daily (assigned week/day)
- Templates & Assets channel (ready stickers/copy)
- IG app

**Steps**
1. Story 1 (morning/midday): lifestyle ή activity — coffee, gym, walk, outfit.
2. Story 2 (afternoon/evening): engagement sticker — poll, quiz, "this or that" ή suggestive tease (όχι explicit).
3. Reshare today''s Reel στο story **μέσα στην 1η ώρα** του Reel post (velocity signal).
4. At least 2 stories/week με poll ή quiz sticker (boosts engagement rank).
5. Reply σε story replies <30 min ανά reply.

**Time**
10-15 λεπτά spread across day.

**Common mistakes**
- Batch και τα 2 stories morning → low read-rate.
- Explicit story → ban risk + downrank.
- Story replies αγνοούνται >30 min → χάνεις conversion window.

**Escalation**
- Link sticker unavailable → **Highlight redirect** (standard fallback — ποτέ bio για CTA). Ping Marketing Manager.
- 3 consecutive days με 0 story views → possible shadowban, escalate.',
  'daily',
  'Καθημερινά, 2 stories spread across day (creator local time)',
  8,
  ARRAY['1c6713c4-ffa4-468e-bc2f-bb972cd24182']::uuid[],
  ARRAY[r.id]::uuid[],
  true,
  1,
  now(),
  now()
FROM public.sop_roles r
WHERE r.slug = 'marketing-executive'
  AND NOT EXISTS (
    SELECT 1 FROM public.sop_functions f
    WHERE r.id = ANY(f.sop_role) AND f.sort_order = 8
  );

UPDATE public.sop_functions f SET
  name = 'Daily Stories cadence (lifestyle slots)',
  kpi = '2 lifestyle/engagement stories/day· 100% mix· 0 explicit story bans',
  sop_content = '**Σκοπός**
Daily IG stories — closest touchpoint με audience. 2 lifestyle/engagement stories/day. Builds trust + warms audience πριν το CTA story.

**Πότε**
Καθημερινά, 2 stories spread across the day. Never batch. CTA story ακολουθεί weekly Link A/B schedule (model_story_link_config): Δευτέρα Link A, Τετάρτη Link B, Παρασκευή Highlights redirect, Σάββατο Link A.

**Tools**
- iCloud → Stories To Upload → Daily (assigned week/day)
- Templates & Assets channel (ready stickers/copy)
- IG app

**Steps**
1. Story 1 (morning/midday): lifestyle ή activity — coffee, gym, walk, outfit.
2. Story 2 (afternoon/evening): engagement sticker — poll, quiz, "this or that" ή suggestive tease (όχι explicit).
3. Reshare today''s Reel στο story **μέσα στην 1η ώρα** του Reel post (velocity signal).
4. At least 2 stories/week με poll ή quiz sticker (boosts engagement rank).
5. Reply σε story replies <30 min ανά reply.

**Time**
10-15 λεπτά spread across day.

**Common mistakes**
- Batch και τα 2 stories morning → low read-rate.
- Explicit story → ban risk + downrank.
- Story replies αγνοούνται >30 min → χάνεις conversion window.

**Escalation**
- Link sticker unavailable → **Highlight redirect** (standard fallback — ποτέ bio για CTA). Ping Marketing Manager.
- 3 consecutive days με 0 story views → possible shadowban, escalate.',
  cadence_type = 'daily',
  cadence_note = 'Καθημερινά, 2 stories spread across day (creator local time)',
  department = ARRAY['1c6713c4-ffa4-468e-bc2f-bb972cd24182']::uuid[],
  is_active = true,
  updated_at = now()
FROM public.sop_roles r
WHERE r.slug = 'marketing-executive'
  AND r.id = ANY(f.sop_role)
  AND f.sort_order = 8;


INSERT INTO public.sop_functions (
  function_id, name, kpi, standard_type, sop_content, cadence_type, cadence_note,
  sort_order, department, sop_role, is_active, content_version, created_at, updated_at
)
SELECT
  'sop_fn_me_gr_9',
  'Evening CTA story με link sticker',
  '1 CTA story/day posted στο 19:00-23:00 window, 100% link verified post-publish, 0 explicit ban incidents',
  'text',
  '**Σκοπός**
The main daily CTA push — evening story με link sticker, sexy αλλά όχι explicit, curiosity-driven, drives clicks → OnlyFans funnel.

**Πότε**
Ανά weekly Link A/B schedule (model_story_link_config): Δευτέρα Link A, Τετάρτη Link B, Παρασκευή Highlights redirect, Σάββατο Link A. 1 CTA story στο assigned slot (επιπλέον των 2 lifestyle stories).

**Tools**
- iCloud → Stories To Upload → CTA (assigned week/day)
- OF link ή landing URL (clipboard ready)
- IG app

**Steps**
2. Tap **+** → Camera → upload approved photo.
3. Swipe up → sticker bar → **Link** sticker → paste link.
4. Caption: **max 3 λέξεις** + 1-3 emojis. Examples: "my secrets" / "ξέρεις πού" / "exclusive".
5. Position link sticker — όχι covering face/body/outfit reveal.
6. Tap Done → upload.
7. **Post-publish:** open το story → tap το link → verify ότι ανοίγει σωστή σελίδα. Broken → delete + repost.
8. Rotate wording daily — never το ίδιο caption 2 μέρες σε σειρά.

**Photo rules**
- Sexy clothes / lingerie covered / body-con / silhouette / mirror selfie — ΟΚ.
- Topless / explicit / nude — NEVER (OF only).
- Soft warm lighting, clean background, head-to-waist ή full body framing.

**Banned wording**
"OnlyFans", "OF", "nudes", "sexting", "porn", "xxx", "link in bio", "sugar daddy", "hookup".

**Time**
5-8 λεπτά.

**Common mistakes**
- Raw link χωρίς caption → zero context → zero clicks.
- Same caption κάθε μέρα → pattern-flag as bot.
- Caption >3 λέξεις → drop-off.
- Posting πριν 19:00 → off-peak, reach tanks.
- Link sticker covers face → broken visual.
- Forget να verify το link post-publish → broken funnel για 4h.

**Escalation**
- Link sticker unavailable → **Highlight redirect** (standard fallback — ποτέ bio για CTA). Escalate στο Marketing Manager.
- Story removed by IG → screenshot + Marketing Manager (content review).',
  'daily',
  'Καθημερινά 19:00-23:00, 1 story',
  9,
  ARRAY['1c6713c4-ffa4-468e-bc2f-bb972cd24182']::uuid[],
  ARRAY[r.id]::uuid[],
  true,
  1,
  now(),
  now()
FROM public.sop_roles r
WHERE r.slug = 'marketing-executive'
  AND NOT EXISTS (
    SELECT 1 FROM public.sop_functions f
    WHERE r.id = ANY(f.sop_role) AND f.sort_order = 9
  );

UPDATE public.sop_functions f SET
  name = 'Evening CTA story με link sticker',
  kpi = '1 CTA story/day posted στο 19:00-23:00 window, 100% link verified post-publish, 0 explicit ban incidents',
  sop_content = '**Σκοπός**
The main daily CTA push — evening story με link sticker, sexy αλλά όχι explicit, curiosity-driven, drives clicks → OnlyFans funnel.

**Πότε**
Ανά weekly Link A/B schedule (model_story_link_config): Δευτέρα Link A, Τετάρτη Link B, Παρασκευή Highlights redirect, Σάββατο Link A. 1 CTA story στο assigned slot (επιπλέον των 2 lifestyle stories).

**Tools**
- iCloud → Stories To Upload → CTA (assigned week/day)
- OF link ή landing URL (clipboard ready)
- IG app

**Steps**
2. Tap **+** → Camera → upload approved photo.
3. Swipe up → sticker bar → **Link** sticker → paste link.
4. Caption: **max 3 λέξεις** + 1-3 emojis. Examples: "my secrets" / "ξέρεις πού" / "exclusive".
5. Position link sticker — όχι covering face/body/outfit reveal.
6. Tap Done → upload.
7. **Post-publish:** open το story → tap το link → verify ότι ανοίγει σωστή σελίδα. Broken → delete + repost.
8. Rotate wording daily — never το ίδιο caption 2 μέρες σε σειρά.

**Photo rules**
- Sexy clothes / lingerie covered / body-con / silhouette / mirror selfie — ΟΚ.
- Topless / explicit / nude — NEVER (OF only).
- Soft warm lighting, clean background, head-to-waist ή full body framing.

**Banned wording**
"OnlyFans", "OF", "nudes", "sexting", "porn", "xxx", "link in bio", "sugar daddy", "hookup".

**Time**
5-8 λεπτά.

**Common mistakes**
- Raw link χωρίς caption → zero context → zero clicks.
- Same caption κάθε μέρα → pattern-flag as bot.
- Caption >3 λέξεις → drop-off.
- Posting πριν 19:00 → off-peak, reach tanks.
- Link sticker covers face → broken visual.
- Forget να verify το link post-publish → broken funnel για 4h.

**Escalation**
- Link sticker unavailable → **Highlight redirect** (standard fallback — ποτέ bio για CTA). Escalate στο Marketing Manager.
- Story removed by IG → screenshot + Marketing Manager (content review).',
  cadence_type = 'daily',
  cadence_note = 'Καθημερινά 19:00-23:00, 1 story',
  department = ARRAY['1c6713c4-ffa4-468e-bc2f-bb972cd24182']::uuid[],
  is_active = true,
  updated_at = now()
FROM public.sop_roles r
WHERE r.slug = 'marketing-executive'
  AND r.id = ANY(f.sop_role)
  AND f.sort_order = 9;


INSERT INTO public.sop_functions (
  function_id, name, kpi, standard_type, sop_content, cadence_type, cadence_note,
  sort_order, department, sop_role, is_active, content_version, created_at, updated_at
)
SELECT
  'sop_fn_me_gr_10',
  'Comment replies (own posts, 30-min window)',
  'Top-liked comments answered <30min 100%, all comments <2h 100%, 0 banned replies',
  'text',
  '**Σκοπός**
Reply σε όλα τα inbound comments στα posts του creator. Engagement velocity στις πρώτες 30'' = strongest signal για viral push.

**Πότε**
Καθημερινά. **Top-liked comments: <30 min** από upload. Rest: <2h. Goal: 3+ reply thread → migrate σε DMs.

**Tools**
- IG/TT/FB app
- Account Master voice brief (creator tone)
- Reply category framework (8 categories)

**Steps**
1. Open post → tap comments → sort by Most Liked.
2. **Top comments first**: identify category (emoji-only / compliment / question / video positive / video negative / hate-troll / repeat high-intent / spam).
3. Write reply per category:
   - Emoji-only → playful + question back ("σου άρεσα;")
   - Compliment → confident playful ("έχω και καλύτερα")
   - Question → partial answer + mystery ("ξέρεις πού να με βρεις")
   - Video negative → flip με sharp irony, never anger
   - Hate/troll → 1 ironic line max, ή ignore
   - Spam/dick pic → hide/delete, no engagement
4. Like το original comment μετά το reply (doubles engagement signal).
5. Pin το best comment για extra reach.
6. 3+ replies από ίδιο user → migrate σε DMs (Conversion Funnel SOP).

**Banned replies**
"Ευχαριστώ" / "ναι" / "όχι" / "χαχα" / emoji-only / defensive explanations / "block" threats / explanation what OnlyFans is.

**Time**
15-30 λεπτά per post (κλιμακώνεται με engagement volume).

**Common mistakes**
- One-word replies → closes thread, kills algorithm signal.
- Copy-paste identical reply σε διαφορετικά comments → pattern flag.
- Engage τους trolls με anger → δίνεις τους reach.
- Skip top-liked στις πρώτες 30'' → lose viral window.
- Forget να like το comment back → half engagement signal.

**Escalation**
- Mass hate from coordinated group → screenshot + Marketing Manager.
- Doxxing/personal threat → COO + Head of Account Defense immediately.',
  'daily',
  'Καθημερινά, ανά νέο post — top comments <30min, rest <2h',
  10,
  ARRAY['1c6713c4-ffa4-468e-bc2f-bb972cd24182']::uuid[],
  ARRAY[r.id]::uuid[],
  true,
  1,
  now(),
  now()
FROM public.sop_roles r
WHERE r.slug = 'marketing-executive'
  AND NOT EXISTS (
    SELECT 1 FROM public.sop_functions f
    WHERE r.id = ANY(f.sop_role) AND f.sort_order = 10
  );

UPDATE public.sop_functions f SET
  name = 'Comment replies (own posts, 30-min window)',
  kpi = 'Top-liked comments answered <30min 100%, all comments <2h 100%, 0 banned replies',
  sop_content = '**Σκοπός**
Reply σε όλα τα inbound comments στα posts του creator. Engagement velocity στις πρώτες 30'' = strongest signal για viral push.

**Πότε**
Καθημερινά. **Top-liked comments: <30 min** από upload. Rest: <2h. Goal: 3+ reply thread → migrate σε DMs.

**Tools**
- IG/TT/FB app
- Account Master voice brief (creator tone)
- Reply category framework (8 categories)

**Steps**
1. Open post → tap comments → sort by Most Liked.
2. **Top comments first**: identify category (emoji-only / compliment / question / video positive / video negative / hate-troll / repeat high-intent / spam).
3. Write reply per category:
   - Emoji-only → playful + question back ("σου άρεσα;")
   - Compliment → confident playful ("έχω και καλύτερα")
   - Question → partial answer + mystery ("ξέρεις πού να με βρεις")
   - Video negative → flip με sharp irony, never anger
   - Hate/troll → 1 ironic line max, ή ignore
   - Spam/dick pic → hide/delete, no engagement
4. Like το original comment μετά το reply (doubles engagement signal).
5. Pin το best comment για extra reach.
6. 3+ replies από ίδιο user → migrate σε DMs (Conversion Funnel SOP).

**Banned replies**
"Ευχαριστώ" / "ναι" / "όχι" / "χαχα" / emoji-only / defensive explanations / "block" threats / explanation what OnlyFans is.

**Time**
15-30 λεπτά per post (κλιμακώνεται με engagement volume).

**Common mistakes**
- One-word replies → closes thread, kills algorithm signal.
- Copy-paste identical reply σε διαφορετικά comments → pattern flag.
- Engage τους trolls με anger → δίνεις τους reach.
- Skip top-liked στις πρώτες 30'' → lose viral window.
- Forget να like το comment back → half engagement signal.

**Escalation**
- Mass hate from coordinated group → screenshot + Marketing Manager.
- Doxxing/personal threat → COO + Head of Account Defense immediately.',
  cadence_type = 'daily',
  cadence_note = 'Καθημερινά, ανά νέο post — top comments <30min, rest <2h',
  department = ARRAY['1c6713c4-ffa4-468e-bc2f-bb972cd24182']::uuid[],
  is_active = true,
  updated_at = now()
FROM public.sop_roles r
WHERE r.slug = 'marketing-executive'
  AND r.id = ANY(f.sop_role)
  AND f.sort_order = 10;


