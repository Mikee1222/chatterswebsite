INSERT INTO public.sop_functions (
  function_id, name, kpi, standard_type, sop_content, cadence_type, cadence_note,
  sort_order, department, sop_role, is_active, content_version, created_at, updated_at
)
SELECT
  'sop_fn_me_us_6',
  'TikTok daily post (midday)',
  '1 TT post/account/day; 0 IG watermark incidents; vertical 9:16 100%',
  'text',
  '**Purpose**
Daily TikTok post — repurposed from IG winner (default) or recreated trend (when no IG match exists).

**When**
Daily midday window. Order: **Scroll → Like → Post → F4F**.

**Tools**
- IG (source video)
- Watermark removal tool (approved)
- TikTok app
- Trending sounds library (TT)

**Steps**
1. IP check + 20–30min FYP scroll (algorithm warm-up).
2. Pick yesterday''s IG Reel with best engagement OR find a trending format to recreate.
3. Download IG video **without watermark** (approved tool). Any other watermark = downrank.
4. TikTok → + → gallery → select.
5. Add **trending sound** — not original IG audio.
6. Caption: 1–2 short lines + 3–5 niche hashtags.
7. Verify vertical 9:16.
8. Post.
9. Stay in app 1–2 minutes (active-user signal).
10. Log post ID/link in daily sheet.

**Time**
6–10 minutes per post (includes pre-post scroll).

**Common mistakes**
- Keeping IG watermark → instant downrank.
- Original IG audio instead of trending TT sound → no velocity push.
- Long caption → kills retention.
- Photo-only post → TT default rejection.
- Posting 2 videos within 5 minutes → split reach.

**Escalation**
- Trial option missing → account not eligible, ping Marketing Manager.
- Watermark removal tool down → use alternative listed in Templates & Assets, or delay post.',
  'daily',
  'Daily midday, 1 post/account',
  6,
  ARRAY['1c6713c4-ffa4-468e-bc2f-bb972cd24182']::uuid[],
  ARRAY[r.id]::uuid[],
  true,
  1,
  now(),
  now()
FROM public.sop_roles r
WHERE r.slug = 'marketing-executives-us'
  AND NOT EXISTS (
    SELECT 1 FROM public.sop_functions f
    WHERE r.id = ANY(f.sop_role) AND f.sort_order = 6
  );

UPDATE public.sop_functions f SET
  name = 'TikTok daily post (midday)',
  kpi = '1 TT post/account/day; 0 IG watermark incidents; vertical 9:16 100%',
  sop_content = '**Purpose**
Daily TikTok post — repurposed from IG winner (default) or recreated trend (when no IG match exists).

**When**
Daily midday window. Order: **Scroll → Like → Post → F4F**.

**Tools**
- IG (source video)
- Watermark removal tool (approved)
- TikTok app
- Trending sounds library (TT)

**Steps**
1. IP check + 20–30min FYP scroll (algorithm warm-up).
2. Pick yesterday''s IG Reel with best engagement OR find a trending format to recreate.
3. Download IG video **without watermark** (approved tool). Any other watermark = downrank.
4. TikTok → + → gallery → select.
5. Add **trending sound** — not original IG audio.
6. Caption: 1–2 short lines + 3–5 niche hashtags.
7. Verify vertical 9:16.
8. Post.
9. Stay in app 1–2 minutes (active-user signal).
10. Log post ID/link in daily sheet.

**Time**
6–10 minutes per post (includes pre-post scroll).

**Common mistakes**
- Keeping IG watermark → instant downrank.
- Original IG audio instead of trending TT sound → no velocity push.
- Long caption → kills retention.
- Photo-only post → TT default rejection.
- Posting 2 videos within 5 minutes → split reach.

**Escalation**
- Trial option missing → account not eligible, ping Marketing Manager.
- Watermark removal tool down → use alternative listed in Templates & Assets, or delay post.',
  cadence_type = 'daily',
  cadence_note = 'Daily midday, 1 post/account',
  department = ARRAY['1c6713c4-ffa4-468e-bc2f-bb972cd24182']::uuid[],
  is_active = true,
  updated_at = now()
FROM public.sop_roles r
WHERE r.slug = 'marketing-executives-us'
  AND r.id = ANY(f.sop_role)
  AND f.sort_order = 6;



INSERT INTO public.sop_functions (
  function_id, name, kpi, standard_type, sop_content, cadence_type, cadence_note,
  sort_order, department, sop_role, is_active, content_version, created_at, updated_at
)
SELECT
  'sop_fn_me_us_7',
  'Facebook cross-post & accept requests (daily)',
  '1 FB Reel cross-posted/day same-day; 100% of legitimate friend requests accepted',
  'text',
  '**Purpose**
Daily FB Reel cross-post from IG (+50% distribution boost when same-day) + accept inbound friend requests. FB is a live channel, not a passive mirror.

**When**
Daily. Order: **IP Check → Cross Post → Accept Requests → Scrolling → Liking**. Min 30 min gap from IG upload on the same device.

**Tools**
- IG app (source)
- FB app
- WhatIsMyIp.com

**Steps**
1. IG → find today''s Reel → download video to phone.
2. IP check **before** switching apps. IP must differ from what you used for IG upload.
3. FB → Reels → select video.
4. Caption: same as IG, optionally slightly different hook for FB.
5. Post.
6. Open Friend Requests → accept ALL legitimate (not spam/non-target language/zero-photo profiles).
7. 20–30min Feed scroll; watch niche videos to completion.
8. 30–50 niche post likes with 5-sec gaps. 10–15 niche story likes.

**Time**
20–30 minutes (cross-post + accept + scroll).

**Common mistakes**
- Cross-posting IG + FB simultaneously → FB flags as bot.
- Using Wi-Fi to save data → accounts linked via IP.
- Accepting Arabic/spam requests → engagement rate tanks.
- 50 likes in a 2-minute burst → spam flag.
- Skipping same-day crosspost → lose distribution boost.

**Escalation**
- FB locks accept feature → Marketing Manager (possible feature restriction).
- Friend requests stuck at 0 inbound for 3+ days → re-engage groups (separate SOP).',
  'daily',
  'Daily, min 30min after IG post',
  7,
  ARRAY['1c6713c4-ffa4-468e-bc2f-bb972cd24182']::uuid[],
  ARRAY[r.id]::uuid[],
  true,
  1,
  now(),
  now()
FROM public.sop_roles r
WHERE r.slug = 'marketing-executives-us'
  AND NOT EXISTS (
    SELECT 1 FROM public.sop_functions f
    WHERE r.id = ANY(f.sop_role) AND f.sort_order = 7
  );

UPDATE public.sop_functions f SET
  name = 'Facebook cross-post & accept requests (daily)',
  kpi = '1 FB Reel cross-posted/day same-day; 100% of legitimate friend requests accepted',
  sop_content = '**Purpose**
Daily FB Reel cross-post from IG (+50% distribution boost when same-day) + accept inbound friend requests. FB is a live channel, not a passive mirror.

**When**
Daily. Order: **IP Check → Cross Post → Accept Requests → Scrolling → Liking**. Min 30 min gap from IG upload on the same device.

**Tools**
- IG app (source)
- FB app
- WhatIsMyIp.com

**Steps**
1. IG → find today''s Reel → download video to phone.
2. IP check **before** switching apps. IP must differ from what you used for IG upload.
3. FB → Reels → select video.
4. Caption: same as IG, optionally slightly different hook for FB.
5. Post.
6. Open Friend Requests → accept ALL legitimate (not spam/non-target language/zero-photo profiles).
7. 20–30min Feed scroll; watch niche videos to completion.
8. 30–50 niche post likes with 5-sec gaps. 10–15 niche story likes.

**Time**
20–30 minutes (cross-post + accept + scroll).

**Common mistakes**
- Cross-posting IG + FB simultaneously → FB flags as bot.
- Using Wi-Fi to save data → accounts linked via IP.
- Accepting Arabic/spam requests → engagement rate tanks.
- 50 likes in a 2-minute burst → spam flag.
- Skipping same-day crosspost → lose distribution boost.

**Escalation**
- FB locks accept feature → Marketing Manager (possible feature restriction).
- Friend requests stuck at 0 inbound for 3+ days → re-engage groups (separate SOP).',
  cadence_type = 'daily',
  cadence_note = 'Daily, min 30min after IG post',
  department = ARRAY['1c6713c4-ffa4-468e-bc2f-bb972cd24182']::uuid[],
  is_active = true,
  updated_at = now()
FROM public.sop_roles r
WHERE r.slug = 'marketing-executives-us'
  AND r.id = ANY(f.sop_role)
  AND f.sort_order = 7;



INSERT INTO public.sop_functions (
  function_id, name, kpi, standard_type, sop_content, cadence_type, cadence_note,
  sort_order, department, sop_role, is_active, content_version, created_at, updated_at
)
SELECT
  'sop_fn_me_us_8',
  'Daily Stories cadence (lifestyle slots)',
  '3–5 stories/day delivered; 100% mix (lifestyle + engagement); 0 explicit story bans',
  'text',
  '**Purpose**
Daily IG stories — closest touchpoint with the audience. Mix lifestyle + activity + engagement sticker. Builds trust + warms audience before the evening CTA story.

**When**
Daily, 3–5 stories spread across morning / midday / afternoon / evening. Never batch.

**Tools**
- iCloud (story-approved photos)
- Templates & Assets channel (ready stickers/copy)
- IG app

**Steps**
1. Morning slot (8:00–11:00 AM local): soft lifestyle — coffee, breakfast, gym mirror selfie.
2. Midday slot (12:00–3:00 PM local): activity — gym set, food, walk, outfit.
3. Afternoon slot (4:00–6:00 PM local): engagement sticker — poll, quiz, "this or that".
4. Evening slot (7:00–10:00 PM local): suggestive tease (but not explicit). Low-light selfie, outfit reveal.
5. Reshare today''s Reel to story **within the 1st hour** of the Reel post (velocity signal).
6. At least 2 stories/week with poll or quiz sticker (boosts engagement rank).
7. Reply to story replies within 30 min per reply.
8. Stop at 5 stories/day max — past 5, read-rate collapses.

**Time**
15–25 minutes spread across the day (3–5 min per slot).

**Common mistakes**
- Batching all 5 stories in the morning → 80% never get seen.
- Explicit story → ban risk + downrank.
- No CTA story all day — leaves Evening CTA SOP without buildup.
- Story replies ignored >30 min → miss conversion window.

**Escalation**
- Link sticker unavailable → bio-only CTA today, ping Marketing Manager (possible feature restriction).
- 3 consecutive days with 0 story views → possible shadowban, escalate.',
  'daily',
  'Daily, 3–5 stories spread morning/midday/evening (creator local US time)',
  8,
  ARRAY['1c6713c4-ffa4-468e-bc2f-bb972cd24182']::uuid[],
  ARRAY[r.id]::uuid[],
  true,
  1,
  now(),
  now()
FROM public.sop_roles r
WHERE r.slug = 'marketing-executives-us'
  AND NOT EXISTS (
    SELECT 1 FROM public.sop_functions f
    WHERE r.id = ANY(f.sop_role) AND f.sort_order = 8
  );

UPDATE public.sop_functions f SET
  name = 'Daily Stories cadence (lifestyle slots)',
  kpi = '3–5 stories/day delivered; 100% mix (lifestyle + engagement); 0 explicit story bans',
  sop_content = '**Purpose**
Daily IG stories — closest touchpoint with the audience. Mix lifestyle + activity + engagement sticker. Builds trust + warms audience before the evening CTA story.

**When**
Daily, 3–5 stories spread across morning / midday / afternoon / evening. Never batch.

**Tools**
- iCloud (story-approved photos)
- Templates & Assets channel (ready stickers/copy)
- IG app

**Steps**
1. Morning slot (8:00–11:00 AM local): soft lifestyle — coffee, breakfast, gym mirror selfie.
2. Midday slot (12:00–3:00 PM local): activity — gym set, food, walk, outfit.
3. Afternoon slot (4:00–6:00 PM local): engagement sticker — poll, quiz, "this or that".
4. Evening slot (7:00–10:00 PM local): suggestive tease (but not explicit). Low-light selfie, outfit reveal.
5. Reshare today''s Reel to story **within the 1st hour** of the Reel post (velocity signal).
6. At least 2 stories/week with poll or quiz sticker (boosts engagement rank).
7. Reply to story replies within 30 min per reply.
8. Stop at 5 stories/day max — past 5, read-rate collapses.

**Time**
15–25 minutes spread across the day (3–5 min per slot).

**Common mistakes**
- Batching all 5 stories in the morning → 80% never get seen.
- Explicit story → ban risk + downrank.
- No CTA story all day — leaves Evening CTA SOP without buildup.
- Story replies ignored >30 min → miss conversion window.

**Escalation**
- Link sticker unavailable → bio-only CTA today, ping Marketing Manager (possible feature restriction).
- 3 consecutive days with 0 story views → possible shadowban, escalate.',
  cadence_type = 'daily',
  cadence_note = 'Daily, 3–5 stories spread morning/midday/evening (creator local US time)',
  department = ARRAY['1c6713c4-ffa4-468e-bc2f-bb972cd24182']::uuid[],
  is_active = true,
  updated_at = now()
FROM public.sop_roles r
WHERE r.slug = 'marketing-executives-us'
  AND r.id = ANY(f.sop_role)
  AND f.sort_order = 8;



INSERT INTO public.sop_functions (
  function_id, name, kpi, standard_type, sop_content, cadence_type, cadence_note,
  sort_order, department, sop_role, is_active, content_version, created_at, updated_at
)
SELECT
  'sop_fn_me_us_9',
  'Evening CTA story with link sticker',
  '1 CTA story/day posted in 7:00–11:00 PM local window; 100% link verified post-publish; 0 explicit ban incidents',
  'text',
  '**Purpose**
The main daily CTA push — evening story with link sticker, sexy but not explicit, curiosity-driven, drives clicks → OnlyFans funnel.

**When**
Daily **7:00–11:00 PM** in the creator''s local US time zone. 1 story/day (in addition to the 3–5 lifestyle slots).

**Tools**
- iCloud (approved CTA photo)
- OF link or landing URL (clipboard ready)
- IG app

**Steps**
1. IP check first.
2. Tap **+** → Camera → upload approved photo.
3. Swipe up → sticker bar → **Link** sticker → paste link.
4. Caption: **max 3 words** + 1–3 emojis. Examples: "my secrets" / "you know where" / "exclusive".
5. Position link sticker — do not cover face/body/outfit reveal.
6. Tap Done → upload.
7. **Post-publish:** open the story → tap the link → verify it opens the correct page. Broken → delete + repost.
8. Rotate wording daily — never the same caption 2 days in a row.

**Photo rules**
- Sexy clothes / lingerie covered / body-con / silhouette / mirror selfie — OK.
- Topless / explicit / nude — NEVER (OF only).
- Soft warm lighting, clean background, head-to-waist or full body framing.

**Banned wording**
"OnlyFans", "OF", "nudes", "sexting", "porn", "xxx", "link in bio", "sugar daddy", "hookup".

**Time**
5–8 minutes.

**Common mistakes**
- Raw link without caption → zero context → zero clicks.
- Same caption every day → pattern-flag as bot.
- Caption >3 words → drop-off.
- Posting before 7:00 PM local → off-peak, reach tanks.
- Link sticker covers face → broken visual.
- Forgetting to verify link post-publish → broken funnel for 4h.

**Escalation**
- Link sticker unavailable on this account → bio-driven CTA, escalate (verified account or Marketing Manager approval needed).
- Story removed by IG → screenshot + Marketing Manager (content review).',
  'daily',
  'Daily 7:00–11:00 PM local, 1 story',
  9,
  ARRAY['1c6713c4-ffa4-468e-bc2f-bb972cd24182']::uuid[],
  ARRAY[r.id]::uuid[],
  true,
  1,
  now(),
  now()
FROM public.sop_roles r
WHERE r.slug = 'marketing-executives-us'
  AND NOT EXISTS (
    SELECT 1 FROM public.sop_functions f
    WHERE r.id = ANY(f.sop_role) AND f.sort_order = 9
  );

UPDATE public.sop_functions f SET
  name = 'Evening CTA story with link sticker',
  kpi = '1 CTA story/day posted in 7:00–11:00 PM local window; 100% link verified post-publish; 0 explicit ban incidents',
  sop_content = '**Purpose**
The main daily CTA push — evening story with link sticker, sexy but not explicit, curiosity-driven, drives clicks → OnlyFans funnel.

**When**
Daily **7:00–11:00 PM** in the creator''s local US time zone. 1 story/day (in addition to the 3–5 lifestyle slots).

**Tools**
- iCloud (approved CTA photo)
- OF link or landing URL (clipboard ready)
- IG app

**Steps**
1. IP check first.
2. Tap **+** → Camera → upload approved photo.
3. Swipe up → sticker bar → **Link** sticker → paste link.
4. Caption: **max 3 words** + 1–3 emojis. Examples: "my secrets" / "you know where" / "exclusive".
5. Position link sticker — do not cover face/body/outfit reveal.
6. Tap Done → upload.
7. **Post-publish:** open the story → tap the link → verify it opens the correct page. Broken → delete + repost.
8. Rotate wording daily — never the same caption 2 days in a row.

**Photo rules**
- Sexy clothes / lingerie covered / body-con / silhouette / mirror selfie — OK.
- Topless / explicit / nude — NEVER (OF only).
- Soft warm lighting, clean background, head-to-waist or full body framing.

**Banned wording**
"OnlyFans", "OF", "nudes", "sexting", "porn", "xxx", "link in bio", "sugar daddy", "hookup".

**Time**
5–8 minutes.

**Common mistakes**
- Raw link without caption → zero context → zero clicks.
- Same caption every day → pattern-flag as bot.
- Caption >3 words → drop-off.
- Posting before 7:00 PM local → off-peak, reach tanks.
- Link sticker covers face → broken visual.
- Forgetting to verify link post-publish → broken funnel for 4h.

**Escalation**
- Link sticker unavailable on this account → bio-driven CTA, escalate (verified account or Marketing Manager approval needed).
- Story removed by IG → screenshot + Marketing Manager (content review).',
  cadence_type = 'daily',
  cadence_note = 'Daily 7:00–11:00 PM local, 1 story',
  department = ARRAY['1c6713c4-ffa4-468e-bc2f-bb972cd24182']::uuid[],
  is_active = true,
  updated_at = now()
FROM public.sop_roles r
WHERE r.slug = 'marketing-executives-us'
  AND r.id = ANY(f.sop_role)
  AND f.sort_order = 9;



INSERT INTO public.sop_functions (
  function_id, name, kpi, standard_type, sop_content, cadence_type, cadence_note,
  sort_order, department, sop_role, is_active, content_version, created_at, updated_at
)
SELECT
  'sop_fn_me_us_10',
  'Comment replies (own posts, 30-min window)',
  'Top-liked comments answered <30min 100%; all comments <2h 100%; 0 banned replies',
  'text',
  '**Purpose**
Reply to all inbound comments on the creator''s posts. Engagement velocity in the first 30 minutes = strongest signal for viral push.

**When**
Daily. **Top-liked comments: <30 min** from upload. Rest: <2h. Goal: 3+ reply thread → migrate to DMs.

**Tools**
- IG/TT/FB app
- Account Master voice brief (creator tone)
- Reply category framework (8 categories)

**Steps**
1. Open post → tap comments → sort by Most Liked.
2. **Top comments first**: identify category (emoji-only / compliment / question / video positive / video negative / hate-troll / repeat high-intent / spam).
3. Write reply per category:
   - Emoji-only → playful + question back ("did you like it?")
   - Compliment → confident playful ("I''ve got even better ones")
   - Question → partial answer + mystery ("you know where to find me")
   - Video negative → flip with sharp irony, never anger
   - Hate/troll → 1 ironic line max, or ignore
   - Spam/dick pic → hide/delete, no engagement
4. Like the original comment after your reply (doubles engagement signal).
5. Pin the best comment for extra reach.
6. 3+ replies from same user → migrate to DMs (Conversion Funnel SOP).

**Banned replies**
"Thanks" / "yes" / "no" / "haha" / emoji-only / defensive explanations / "block" threats / explaining what OnlyFans is.

**Time**
15–30 minutes per post (scales with engagement volume).

**Common mistakes**
- One-word replies → closes thread, kills algorithm signal.
- Copy-paste identical reply on different comments → pattern flag.
- Engaging trolls with anger → gives them reach.
- Skipping top-liked in the first 30 minutes → lose viral window.
- Forgetting to like the comment back → half engagement signal.

**Escalation**
- Mass hate from coordinated group → screenshot + Marketing Manager.
- Doxxing/personal threat → COO + Head of Account Defense immediately.',
  'daily',
  'Daily, per new post — top comments <30min, rest <2h',
  10,
  ARRAY['1c6713c4-ffa4-468e-bc2f-bb972cd24182']::uuid[],
  ARRAY[r.id]::uuid[],
  true,
  1,
  now(),
  now()
FROM public.sop_roles r
WHERE r.slug = 'marketing-executives-us'
  AND NOT EXISTS (
    SELECT 1 FROM public.sop_functions f
    WHERE r.id = ANY(f.sop_role) AND f.sort_order = 10
  );

UPDATE public.sop_functions f SET
  name = 'Comment replies (own posts, 30-min window)',
  kpi = 'Top-liked comments answered <30min 100%; all comments <2h 100%; 0 banned replies',
  sop_content = '**Purpose**
Reply to all inbound comments on the creator''s posts. Engagement velocity in the first 30 minutes = strongest signal for viral push.

**When**
Daily. **Top-liked comments: <30 min** from upload. Rest: <2h. Goal: 3+ reply thread → migrate to DMs.

**Tools**
- IG/TT/FB app
- Account Master voice brief (creator tone)
- Reply category framework (8 categories)

**Steps**
1. Open post → tap comments → sort by Most Liked.
2. **Top comments first**: identify category (emoji-only / compliment / question / video positive / video negative / hate-troll / repeat high-intent / spam).
3. Write reply per category:
   - Emoji-only → playful + question back ("did you like it?")
   - Compliment → confident playful ("I''ve got even better ones")
   - Question → partial answer + mystery ("you know where to find me")
   - Video negative → flip with sharp irony, never anger
   - Hate/troll → 1 ironic line max, or ignore
   - Spam/dick pic → hide/delete, no engagement
4. Like the original comment after your reply (doubles engagement signal).
5. Pin the best comment for extra reach.
6. 3+ replies from same user → migrate to DMs (Conversion Funnel SOP).

**Banned replies**
"Thanks" / "yes" / "no" / "haha" / emoji-only / defensive explanations / "block" threats / explaining what OnlyFans is.

**Time**
15–30 minutes per post (scales with engagement volume).

**Common mistakes**
- One-word replies → closes thread, kills algorithm signal.
- Copy-paste identical reply on different comments → pattern flag.
- Engaging trolls with anger → gives them reach.
- Skipping top-liked in the first 30 minutes → lose viral window.
- Forgetting to like the comment back → half engagement signal.

**Escalation**
- Mass hate from coordinated group → screenshot + Marketing Manager.
- Doxxing/personal threat → COO + Head of Account Defense immediately.',
  cadence_type = 'daily',
  cadence_note = 'Daily, per new post — top comments <30min, rest <2h',
  department = ARRAY['1c6713c4-ffa4-468e-bc2f-bb972cd24182']::uuid[],
  is_active = true,
  updated_at = now()
FROM public.sop_roles r
WHERE r.slug = 'marketing-executives-us'
  AND r.id = ANY(f.sop_role)
  AND f.sort_order = 10;