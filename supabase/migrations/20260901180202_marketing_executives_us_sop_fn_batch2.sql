-- marketing_executives_us SOP functions batch 2

INSERT INTO public.sop_functions (
  function_id, name, kpi, standard_type, sop_content, cadence_type, cadence_note,
  sort_order, department, sop_role, is_active, content_version, created_at, updated_at
)
SELECT
  'sop_fn_me_us_6',
  'TikTok daily post',
  '2 TT posts/account/day; vertical 9:16 100%',
  'text',
  '**Purpose**
Daily TikTok posting — video from assigned iCloud Video To Upload folder (Trial or Grid path). You do not pick the source; follow the assigned Task.

**When**
Per assigned Task schedule (2 posts/account/day). Order: **Scroll → Like → Post → F4F**.

**Tools**
- iCloud → Video To Upload (assigned day/account/Trial or Grid)
- TikTok app
- Trending sounds library (TT)

**Steps**
1. 15-min FYP scroll (algorithm warm-up).
2. Download video from assigned iCloud Video To Upload folder.
3. TikTok → + → gallery → select.
4. Add **trending sound** — not original IG audio if repurposed.
5. Caption: 1–2 short lines + 3–5 niche hashtags.
6. Verify vertical 9:16.
7. Post.
8. Stay in app 1–2 minutes (active-user signal).
9. Log post ID/link in daily sheet.
10. Repeat for 2nd post/account per Task schedule.

**Time**
6–10 minutes per post.

**Common mistakes**
- Original IG audio instead of trending TT sound → no velocity push.
- Long caption → kills retention.
- Photo-only post → TT default rejection.
- Posting 2 videos within 5 minutes → split reach.

**Escalation**
- Trial option missing → account not eligible, ping Marketing Manager.
- Assigned folder empty → iCloud Manager.',
  'daily',
  'Per assigned Task schedule — 2 posts/account/day',
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
  name = 'TikTok daily post',
  kpi = '2 TT posts/account/day; vertical 9:16 100%',
  sop_content = '**Purpose**
Daily TikTok posting — video from assigned iCloud Video To Upload folder (Trial or Grid path). You do not pick the source; follow the assigned Task.

**When**
Per assigned Task schedule (2 posts/account/day). Order: **Scroll → Like → Post → F4F**.

**Tools**
- iCloud → Video To Upload (assigned day/account/Trial or Grid)
- TikTok app
- Trending sounds library (TT)

**Steps**
1. 15-min FYP scroll (algorithm warm-up).
2. Download video from assigned iCloud Video To Upload folder.
3. TikTok → + → gallery → select.
4. Add **trending sound** — not original IG audio if repurposed.
5. Caption: 1–2 short lines + 3–5 niche hashtags.
6. Verify vertical 9:16.
7. Post.
8. Stay in app 1–2 minutes (active-user signal).
9. Log post ID/link in daily sheet.
10. Repeat for 2nd post/account per Task schedule.

**Time**
6–10 minutes per post.

**Common mistakes**
- Original IG audio instead of trending TT sound → no velocity push.
- Long caption → kills retention.
- Photo-only post → TT default rejection.
- Posting 2 videos within 5 minutes → split reach.

**Escalation**
- Trial option missing → account not eligible, ping Marketing Manager.
- Assigned folder empty → iCloud Manager.',
  cadence_type = 'daily',
  cadence_note = 'Per assigned Task schedule — 2 posts/account/day',
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
Daily. Order: **Cross Post → Accept Requests → Scrolling → Liking**. Min 30 min gap from IG upload on the same device.

**Tools**
- IG app (source)
- FB app

**Steps**
1. IG → find today''s Reel → download video to phone.
2. FB → Reels → select video.
3. Caption: same as IG, optionally slightly different hook for FB.
4. Post.
5. Open Friend Requests → accept ALL legitimate (not spam/non-target language/zero-photo profiles).
6. 20–30min Feed scroll; watch niche videos to completion.
7. 30–50 niche post likes with 5-sec gaps. 10–15 niche story likes.

**Time**
20–30 minutes (cross-post + accept + scroll).

**Common mistakes**
- Cross-posting IG + FB simultaneously → FB flags as bot.
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
Daily. Order: **Cross Post → Accept Requests → Scrolling → Liking**. Min 30 min gap from IG upload on the same device.

**Tools**
- IG app (source)
- FB app

**Steps**
1. IG → find today''s Reel → download video to phone.
2. FB → Reels → select video.
3. Caption: same as IG, optionally slightly different hook for FB.
4. Post.
5. Open Friend Requests → accept ALL legitimate (not spam/non-target language/zero-photo profiles).
6. 20–30min Feed scroll; watch niche videos to completion.
7. 30–50 niche post likes with 5-sec gaps. 10–15 niche story likes.

**Time**
20–30 minutes (cross-post + accept + scroll).

**Common mistakes**
- Cross-posting IG + FB simultaneously → FB flags as bot.
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
  '2 lifestyle/engagement stories/day delivered; 100% mix; 0 explicit story bans',
  'text',
  '**Purpose**
Daily IG stories — closest touchpoint with the audience. 2 lifestyle/engagement stories/day. Builds trust + warms audience before the CTA story.

**When**
Daily, 2 stories spread across the day. Never batch. CTA story follows weekly Link A/B schedule (model_story_link_config): Monday Link A, Wednesday Link B, Friday Highlights redirect, Saturday Link A.

**Tools**
- iCloud → Stories To Upload → Daily (assigned week/day)
- Templates & Assets channel (ready stickers/copy)
- IG app

**Steps**
1. Story 1 (morning/midday): lifestyle or activity — coffee, gym, walk, outfit.
2. Story 2 (afternoon/evening): engagement sticker — poll, quiz, "this or that" or suggestive tease (not explicit).
3. Reshare today''s Reel to story **within the 1st hour** of the Reel post (velocity signal).
4. At least 2 stories/week with poll or quiz sticker (boosts engagement rank).
5. Reply to story replies within 30 min per reply.

**Time**
10–15 minutes spread across the day.

**Common mistakes**
- Batching both stories in the morning → low read-rate.
- Explicit story → ban risk + downrank.
- Story replies ignored >30 min → miss conversion window.

**Escalation**
- Link sticker unavailable → **Highlight redirect** (standard fallback — never bio for CTA). Ping Marketing Manager.
- 3 consecutive days with 0 story views → possible shadowban, escalate.',
  'daily',
  'Daily, 2 stories spread across day (creator local US time)',
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
  kpi = '2 lifestyle/engagement stories/day delivered; 100% mix; 0 explicit story bans',
  sop_content = '**Purpose**
Daily IG stories — closest touchpoint with the audience. 2 lifestyle/engagement stories/day. Builds trust + warms audience before the CTA story.

**When**
Daily, 2 stories spread across the day. Never batch. CTA story follows weekly Link A/B schedule (model_story_link_config): Monday Link A, Wednesday Link B, Friday Highlights redirect, Saturday Link A.

**Tools**
- iCloud → Stories To Upload → Daily (assigned week/day)
- Templates & Assets channel (ready stickers/copy)
- IG app

**Steps**
1. Story 1 (morning/midday): lifestyle or activity — coffee, gym, walk, outfit.
2. Story 2 (afternoon/evening): engagement sticker — poll, quiz, "this or that" or suggestive tease (not explicit).
3. Reshare today''s Reel to story **within the 1st hour** of the Reel post (velocity signal).
4. At least 2 stories/week with poll or quiz sticker (boosts engagement rank).
5. Reply to story replies within 30 min per reply.

**Time**
10–15 minutes spread across the day.

**Common mistakes**
- Batching both stories in the morning → low read-rate.
- Explicit story → ban risk + downrank.
- Story replies ignored >30 min → miss conversion window.

**Escalation**
- Link sticker unavailable → **Highlight redirect** (standard fallback — never bio for CTA). Ping Marketing Manager.
- 3 consecutive days with 0 story views → possible shadowban, escalate.',
  cadence_type = 'daily',
  cadence_note = 'Daily, 2 stories spread across day (creator local US time)',
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
  '1 CTA story/day per weekly Link A/B schedule; 100% link verified post-publish; 0 explicit ban incidents',
  'text',
  '**Purpose**
The main daily CTA push — evening story with link sticker, sexy but not explicit, curiosity-driven, drives clicks → OnlyFans funnel.

**When**
Per weekly Link A/B schedule (model_story_link_config): Monday Link A, Wednesday Link B, Friday Highlights redirect, Saturday Link A. 1 CTA story on the assigned slot (in addition to the 2 lifestyle stories).

**Tools**
- iCloud → Stories To Upload → CTA (assigned week/day)
- OF link or landing URL (clipboard ready)
- IG app

**Steps**
2. Tap **+** → Camera → upload approved photo.
3. Swipe up → sticker bar → **Link** sticker → paste link per weekly schedule (Link A or Link B from model_story_link_config).
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
- Link sticker unavailable → **Highlight redirect** (standard fallback — never bio for CTA). Escalate to Marketing Manager.
- Story removed by IG → screenshot + Marketing Manager (content review).',
  'daily',
  'Per weekly Link A/B schedule (model_story_link_config): Monday Link A, Wednesday Link B, Friday Highlights redirect, Saturday Link A — 1 CTA story on assigned slot',
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
  kpi = '1 CTA story/day per weekly Link A/B schedule; 100% link verified post-publish; 0 explicit ban incidents',
  sop_content = '**Purpose**
The main daily CTA push — evening story with link sticker, sexy but not explicit, curiosity-driven, drives clicks → OnlyFans funnel.

**When**
Per weekly Link A/B schedule (model_story_link_config): Monday Link A, Wednesday Link B, Friday Highlights redirect, Saturday Link A. 1 CTA story on the assigned slot (in addition to the 2 lifestyle stories).

**Tools**
- iCloud → Stories To Upload → CTA (assigned week/day)
- OF link or landing URL (clipboard ready)
- IG app

**Steps**
2. Tap **+** → Camera → upload approved photo.
3. Swipe up → sticker bar → **Link** sticker → paste link per weekly schedule (Link A or Link B from model_story_link_config).
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
- Link sticker unavailable → **Highlight redirect** (standard fallback — never bio for CTA). Escalate to Marketing Manager.
- Story removed by IG → screenshot + Marketing Manager (content review).',
  cadence_type = 'daily',
  cadence_note = 'Per weekly Link A/B schedule (model_story_link_config): Monday Link A, Wednesday Link B, Friday Highlights redirect, Saturday Link A — 1 CTA story on assigned slot',
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


