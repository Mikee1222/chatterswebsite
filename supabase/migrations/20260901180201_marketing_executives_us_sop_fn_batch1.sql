-- marketing_executives_us SOP functions batch 1

INSERT INTO public.sop_functions (
  function_id, name, kpi, standard_type, sop_content, cadence_type, cadence_note,
  sort_order, department, sop_role, is_active, content_version, created_at, updated_at
)
SELECT
  'sop_fn_me_us_1',
  'Account status check (morning)',
  '100% of sessions start with Account Status check; 0 incidents from missed status review',
  'text',
  '**Purpose**
Before you touch any account, confirm Account Status is green on every handle you will work today. The device is farm-controlled — no IP management needed on your end.

**When**
First task of every session, and again each time you switch accounts on the same device.

**Tools**
- Phone (work device — assigned hardware)
- IG/FB/TT app → Settings → Account Status

**Steps**
1. Confirm the device is on mobile data — Wi-Fi OFF, eSIM/VPN/Proxy OFF.
2. Open each account you will work → Settings → Account Status. All sections must be green.
3. If you see an orange flag → screenshot immediately + ping Marketing Manager. Do NOT start posting/engagement until you have guidance.
4. Log in the daily sheet: timestamp + status per account.

**Time**
2–3 minutes (scales with number of accounts on the device).

**Common mistakes**
- Skipping Account Status to save time — most bans start from an ignored orange flag.
- Continuing to post with an orange flag — accelerates shadowban/disable.
- Turning on Wi-Fi "just for 2 minutes" — security violation.

**Escalation**
- Orange on Account Status → Marketing Manager + screenshot.
- Action block popup → STOP likes/follows/comments; continue only posting/stories/DM replies; report.',
  'daily',
  'Daily, before every session — first task',
  1,
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
    WHERE r.id = ANY(f.sop_role) AND f.sort_order = 1
  );

UPDATE public.sop_functions f SET
  name = 'Account status check (morning)',
  kpi = '100% of sessions start with Account Status check; 0 incidents from missed status review',
  sop_content = '**Purpose**
Before you touch any account, confirm Account Status is green on every handle you will work today. The device is farm-controlled — no IP management needed on your end.

**When**
First task of every session, and again each time you switch accounts on the same device.

**Tools**
- Phone (work device — assigned hardware)
- IG/FB/TT app → Settings → Account Status

**Steps**
1. Confirm the device is on mobile data — Wi-Fi OFF, eSIM/VPN/Proxy OFF.
2. Open each account you will work → Settings → Account Status. All sections must be green.
3. If you see an orange flag → screenshot immediately + ping Marketing Manager. Do NOT start posting/engagement until you have guidance.
4. Log in the daily sheet: timestamp + status per account.

**Time**
2–3 minutes (scales with number of accounts on the device).

**Common mistakes**
- Skipping Account Status to save time — most bans start from an ignored orange flag.
- Continuing to post with an orange flag — accelerates shadowban/disable.
- Turning on Wi-Fi "just for 2 minutes" — security violation.

**Escalation**
- Orange on Account Status → Marketing Manager + screenshot.
- Action block popup → STOP likes/follows/comments; continue only posting/stories/DM replies; report.',
  cadence_type = 'daily',
  cadence_note = 'Daily, before every session — first task',
  department = ARRAY['1c6713c4-ffa4-468e-bc2f-bb972cd24182']::uuid[],
  is_active = true,
  updated_at = now()
FROM public.sop_roles r
WHERE r.slug = 'marketing-executives-us'
  AND r.id = ANY(f.sop_role)
  AND f.sort_order = 1;


INSERT INTO public.sop_functions (
  function_id, name, kpi, standard_type, sop_content, cadence_type, cadence_note,
  sort_order, department, sop_role, is_active, content_version, created_at, updated_at
)
SELECT
  'sop_fn_me_us_2',
  'Master Account check & device assignment verify (morning)',
  '0 cross-device incidents; 100% of posts made from the correct assigned device',
  'text',
  '**Purpose**
Before you post for any creator, verify the Master Account spec (template, bio, highlights) and that you are on the **correct device** for that specific handle. Cross-contamination = mass-ban risk.

**When**
Daily, before posting for each creator (and again if you switch creators mid-shift).

**Tools**
- Account Master Reference (Notion)
- Device-to-creator mapping sheet (from Head of Account Defense)
- Password manager

**Steps**
1. Open Account Master Reference and find your creator.
2. Confirm you are holding the **assigned device** for that creator. Different device = STOP, ping Head of Account Defense.
3. Cross-check bio + profile pic + highlights on the live account vs template. If anything does not match (random highlight, wrong PFP) → flag Marketing Manager.
4. Confirm there is no connection in Meta Account Center with unauthorized handles.
5. Quick scan: highlights stale? (>2 weeks no update) → add to weekly maintenance list.
6. Confirm credentials are accessible from the password manager (not plain text, not a sticky note).

**Time**
2–3 minutes per creator/account.

**Common mistakes**
- Posting from a personal phone "just once" → instant cross-link.
- Profile pic identical to another creator account → Meta fingerprint match.
- Skipping Master check when it "looks OK" — drift happens silently.
- Logging into a personal Apple ID on the work device → mass-ban risk.

**Escalation**
- Wrong device → Head of Account Defense + STOP.
- Meta Account Center shows unauthorized link → Marketing Manager immediately.
- Stale highlights >2 weeks → add to weekly task, not a blocker.',
  'daily',
  'Daily before posting, per creator you will work',
  2,
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
    WHERE r.id = ANY(f.sop_role) AND f.sort_order = 2
  );

UPDATE public.sop_functions f SET
  name = 'Master Account check & device assignment verify (morning)',
  kpi = '0 cross-device incidents; 100% of posts made from the correct assigned device',
  sop_content = '**Purpose**
Before you post for any creator, verify the Master Account spec (template, bio, highlights) and that you are on the **correct device** for that specific handle. Cross-contamination = mass-ban risk.

**When**
Daily, before posting for each creator (and again if you switch creators mid-shift).

**Tools**
- Account Master Reference (Notion)
- Device-to-creator mapping sheet (from Head of Account Defense)
- Password manager

**Steps**
1. Open Account Master Reference and find your creator.
2. Confirm you are holding the **assigned device** for that creator. Different device = STOP, ping Head of Account Defense.
3. Cross-check bio + profile pic + highlights on the live account vs template. If anything does not match (random highlight, wrong PFP) → flag Marketing Manager.
4. Confirm there is no connection in Meta Account Center with unauthorized handles.
5. Quick scan: highlights stale? (>2 weeks no update) → add to weekly maintenance list.
6. Confirm credentials are accessible from the password manager (not plain text, not a sticky note).

**Time**
2–3 minutes per creator/account.

**Common mistakes**
- Posting from a personal phone "just once" → instant cross-link.
- Profile pic identical to another creator account → Meta fingerprint match.
- Skipping Master check when it "looks OK" — drift happens silently.
- Logging into a personal Apple ID on the work device → mass-ban risk.

**Escalation**
- Wrong device → Head of Account Defense + STOP.
- Meta Account Center shows unauthorized link → Marketing Manager immediately.
- Stale highlights >2 weeks → add to weekly task, not a blocker.',
  cadence_type = 'daily',
  cadence_note = 'Daily before posting, per creator you will work',
  department = ARRAY['1c6713c4-ffa4-468e-bc2f-bb972cd24182']::uuid[],
  is_active = true,
  updated_at = now()
FROM public.sop_roles r
WHERE r.slug = 'marketing-executives-us'
  AND r.id = ANY(f.sop_role)
  AND f.sort_order = 2;


INSERT INTO public.sop_functions (
  function_id, name, kpi, standard_type, sop_content, cadence_type, cadence_note,
  sort_order, department, sop_role, is_active, content_version, created_at, updated_at
)
SELECT
  'sop_fn_me_us_3',
  'iCloud content pull & Templates & Assets check (morning)',
  '100% of today''s briefs/files identified before noon local time; 0 posting delays due to missing assets',
  'text',
  '**Purpose**
Gather all content assets you need for the day: today''s brief from Content Director, video files in iCloud, and templates from the Templates & Assets channel.

**When**
Daily morning, after Account Status check, before you start posting.

**Tools**
- iCloud folders per creator:
  - **Social Media Posts:** Model → Content to Upload → Social Media Posts → Year → Month → Carousel 1, 2…
  - **Stories:** Model → Content to Upload → Stories To Upload → CTA or Daily → Year → Month → Week → Day (weeks 1–7, 8–15, etc.)
  - **Videos:** Model → Content to Upload → Video To Upload → Year → Month → Week → Day → Main Account or Secondary Account → Trial or Grid
- Telegram → Templates & Assets channel
- Discord → today''s brief / caption drop from Marketing Manager

**Steps**
1. Open Discord/Telegram → check today''s brief: captions, hooks, posting concepts.
2. Open iCloud → `Model → Content to Upload → Video To Upload → … → Trial or Grid` → identify videos in Video To Upload path (Main/Secondary → Trial or Grid).
3. Open `Model → Content to Upload → Video To Upload → … → Trial` — if not ready, ping iCloud Manager.
4. Open Templates & Assets channel — pull ready stories/captions before building from scratch.
5. Pre-check: all videos are 9:16 vertical.
6. Mental plan: which post goes where, what time (creator''s US local time zone), which account.

**Time**
10–15 minutes.

**Common mistakes**
- Building from scratch when a template exists — duplicate effort + inconsistent voice.
- Not checking iCloud before posting → discover missing brief at noon.
- Re-using a file already marked posted in Grid/Trial folder → duplicate detection penalty.

**Escalation**
- Missing brief for the day after 10:00 AM local → ping Marketing Manager + Content Director.
- Trial subfolder empty → iCloud Manager.
- Template gap (no caption fits) → flag in Questions channel.',
  'daily',
  'Daily morning, before posting',
  3,
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
    WHERE r.id = ANY(f.sop_role) AND f.sort_order = 3
  );

UPDATE public.sop_functions f SET
  name = 'iCloud content pull & Templates & Assets check (morning)',
  kpi = '100% of today''s briefs/files identified before noon local time; 0 posting delays due to missing assets',
  sop_content = '**Purpose**
Gather all content assets you need for the day: today''s brief from Content Director, video files in iCloud, and templates from the Templates & Assets channel.

**When**
Daily morning, after Account Status check, before you start posting.

**Tools**
- iCloud folders per creator:
  - **Social Media Posts:** Model → Content to Upload → Social Media Posts → Year → Month → Carousel 1, 2…
  - **Stories:** Model → Content to Upload → Stories To Upload → CTA or Daily → Year → Month → Week → Day (weeks 1–7, 8–15, etc.)
  - **Videos:** Model → Content to Upload → Video To Upload → Year → Month → Week → Day → Main Account or Secondary Account → Trial or Grid
- Telegram → Templates & Assets channel
- Discord → today''s brief / caption drop from Marketing Manager

**Steps**
1. Open Discord/Telegram → check today''s brief: captions, hooks, posting concepts.
2. Open iCloud → `Model → Content to Upload → Video To Upload → … → Trial or Grid` → identify videos in Video To Upload path (Main/Secondary → Trial or Grid).
3. Open `Model → Content to Upload → Video To Upload → … → Trial` — if not ready, ping iCloud Manager.
4. Open Templates & Assets channel — pull ready stories/captions before building from scratch.
5. Pre-check: all videos are 9:16 vertical.
6. Mental plan: which post goes where, what time (creator''s US local time zone), which account.

**Time**
10–15 minutes.

**Common mistakes**
- Building from scratch when a template exists — duplicate effort + inconsistent voice.
- Not checking iCloud before posting → discover missing brief at noon.
- Re-using a file already marked posted in Grid/Trial folder → duplicate detection penalty.

**Escalation**
- Missing brief for the day after 10:00 AM local → ping Marketing Manager + Content Director.
- Trial subfolder empty → iCloud Manager.
- Template gap (no caption fits) → flag in Questions channel.',
  cadence_type = 'daily',
  cadence_note = 'Daily morning, before posting',
  department = ARRAY['1c6713c4-ffa4-468e-bc2f-bb972cd24182']::uuid[],
  is_active = true,
  updated_at = now()
FROM public.sop_roles r
WHERE r.slug = 'marketing-executives-us'
  AND r.id = ANY(f.sop_role)
  AND f.sort_order = 3;


INSERT INTO public.sop_functions (
  function_id, name, kpi, standard_type, sop_content, cadence_type, cadence_note,
  sort_order, department, sop_role, is_active, content_version, created_at, updated_at
)
SELECT
  'sop_fn_me_us_4',
  'Account warm-up routine (daily 15-min)',
  '100% of accounts warmed up before posting; 0 post-and-ghost incidents',
  'text',
  '**Purpose**
15-minute daily warm-up before any action — trains the algorithm that the account is a real user, not a bot. Strongest trust-score signal Gunzo has.

**When**
Daily before posting/engagement, per account. **Tools**
- IG/TT/FB app (platform-appropriate)

**Steps**
1. Open app → Explore/Reels/FYP feed.
2. Scroll for 15 minutes; watch videos to completion (do not skip at 1 sec).
3. Like 3–5 random posts outside the niche (natural behavior).
4. Watch 5–10 stories.
5. Send 1–2 reels via DM to other accounts (strongest human signal for the algorithm).
6. Stay active 5 minutes after warm-up — never post-and-ghost.
7. Only then → start posting/engagement.

**Time**
15 minutes per account.

**Common mistakes**
- Skipping warm-up "because I don''t have time" — single biggest reason for shadowban.
- Liking 20 posts in 30 seconds → spam burst flag.
- Watching videos for 1–2 sec → negative algorithm signal (worse than no view).
- Posting immediately after warm-up without the 5-minute active window.

**Escalation**
- Account shows 0 engagement on warm-up content after 3 days → ping Marketing Manager (possible shadowban).',
  'daily',
  'Daily before posting, per account',
  4,
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
    WHERE r.id = ANY(f.sop_role) AND f.sort_order = 4
  );

UPDATE public.sop_functions f SET
  name = 'Account warm-up routine (daily 15-min)',
  kpi = '100% of accounts warmed up before posting; 0 post-and-ghost incidents',
  sop_content = '**Purpose**
15-minute daily warm-up before any action — trains the algorithm that the account is a real user, not a bot. Strongest trust-score signal Gunzo has.

**When**
Daily before posting/engagement, per account. **Tools**
- IG/TT/FB app (platform-appropriate)

**Steps**
1. Open app → Explore/Reels/FYP feed.
2. Scroll for 15 minutes; watch videos to completion (do not skip at 1 sec).
3. Like 3–5 random posts outside the niche (natural behavior).
4. Watch 5–10 stories.
5. Send 1–2 reels via DM to other accounts (strongest human signal for the algorithm).
6. Stay active 5 minutes after warm-up — never post-and-ghost.
7. Only then → start posting/engagement.

**Time**
15 minutes per account.

**Common mistakes**
- Skipping warm-up "because I don''t have time" — single biggest reason for shadowban.
- Liking 20 posts in 30 seconds → spam burst flag.
- Watching videos for 1–2 sec → negative algorithm signal (worse than no view).
- Posting immediately after warm-up without the 5-minute active window.

**Escalation**
- Account shows 0 engagement on warm-up content after 3 days → ping Marketing Manager (possible shadowban).',
  cadence_type = 'daily',
  cadence_note = 'Daily before posting, per account',
  department = ARRAY['1c6713c4-ffa4-468e-bc2f-bb972cd24182']::uuid[],
  is_active = true,
  updated_at = now()
FROM public.sop_roles r
WHERE r.slug = 'marketing-executives-us'
  AND r.id = ANY(f.sop_role)
  AND f.sort_order = 4;


INSERT INTO public.sop_functions (
  function_id, name, kpi, standard_type, sop_content, cadence_type, cadence_note,
  sort_order, department, sop_role, is_active, content_version, created_at, updated_at
)
SELECT
  'sop_fn_me_us_5',
  'IG Reel/feed post (midday + evening)',
  '100% of posts published on schedule; 0 duplicate flags; posting log complete',
  'text',
  '**Purpose**
Daily IG Reel posting from Main + Alt accounts at scheduled times, with correct caption, hashtags, and cover.

**When**
Main: **12:00 PM** and **8:00 PM** in the creator''s local US time zone. Alt: +1 repurposed copy mid-shift. Min 2h gap between posts on the same account.

**Tools**
- iCloud → Video To Upload (assigned day/account)
- IG app
- Caption from Content Director (Discord/Telegram drop)
- Approved hashtag list

**Steps**
1. Account status check + warm-up done.
2. Download video from iCloud → Video To Upload → assigned day folder → Trial or Grid.
3. IG → + → Reel → select.
4. Pick a strong cover frame — not random.
5. Paste caption from Content Director **as-is** — do not rewrite.
6. Hashtags: 3–5 max, placed 3–4 line breaks below caption. Rotate set every 3–4 posts.
7. Audio: trending sound only if it fits; otherwise original.
8. Verify Trial toggle: OFF for normal Reel, ON for trial (separate SOP).
9. Share → confirm live → screenshot.
10. Move file: Video To Upload → [Year] → [Month] → [Week] → [Day] → [Account] → Grid (posted).
11. Stay in app 1–2 minutes (active-user signal).
12. Log post in daily sheet: account / time / post ID / first 30min views.

**Time**
8–12 minutes per post (scales with upload speed).

**Common mistakes**
- Random cover frame → low click-rate.
- Caption rewrite "for better tone" — breaks consistency with tested winners.
- Same hashtag set on every post → algorithm flag.
- Identical file on Main + Alt → duplicate penalty.
- Post + close app immediately → "post-and-ghost" penalty.
- Forgetting to move file to posted subfolder → re-upload risk.

**Escalation**
- Post stuck at 0 views >1h → possible shadowban, ping Marketing Manager.
- Audio missing/removed by IG → re-upload with different sound.
- Cover refuses to set → IG bug, force-quit + retry.',
  'daily',
  '12:00 PM and 8:00 PM local (creator US time zone) per Main account; +1 repurposed on Alt',
  5,
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
    WHERE r.id = ANY(f.sop_role) AND f.sort_order = 5
  );

UPDATE public.sop_functions f SET
  name = 'IG Reel/feed post (midday + evening)',
  kpi = '100% of posts published on schedule; 0 duplicate flags; posting log complete',
  sop_content = '**Purpose**
Daily IG Reel posting from Main + Alt accounts at scheduled times, with correct caption, hashtags, and cover.

**When**
Main: **12:00 PM** and **8:00 PM** in the creator''s local US time zone. Alt: +1 repurposed copy mid-shift. Min 2h gap between posts on the same account.

**Tools**
- iCloud → Video To Upload (assigned day/account)
- IG app
- Caption from Content Director (Discord/Telegram drop)
- Approved hashtag list

**Steps**
1. Account status check + warm-up done.
2. Download video from iCloud → Video To Upload → assigned day folder → Trial or Grid.
3. IG → + → Reel → select.
4. Pick a strong cover frame — not random.
5. Paste caption from Content Director **as-is** — do not rewrite.
6. Hashtags: 3–5 max, placed 3–4 line breaks below caption. Rotate set every 3–4 posts.
7. Audio: trending sound only if it fits; otherwise original.
8. Verify Trial toggle: OFF for normal Reel, ON for trial (separate SOP).
9. Share → confirm live → screenshot.
10. Move file: Video To Upload → [Year] → [Month] → [Week] → [Day] → [Account] → Grid (posted).
11. Stay in app 1–2 minutes (active-user signal).
12. Log post in daily sheet: account / time / post ID / first 30min views.

**Time**
8–12 minutes per post (scales with upload speed).

**Common mistakes**
- Random cover frame → low click-rate.
- Caption rewrite "for better tone" — breaks consistency with tested winners.
- Same hashtag set on every post → algorithm flag.
- Identical file on Main + Alt → duplicate penalty.
- Post + close app immediately → "post-and-ghost" penalty.
- Forgetting to move file to posted subfolder → re-upload risk.

**Escalation**
- Post stuck at 0 views >1h → possible shadowban, ping Marketing Manager.
- Audio missing/removed by IG → re-upload with different sound.
- Cover refuses to set → IG bug, force-quit + retry.',
  cadence_type = 'daily',
  cadence_note = '12:00 PM and 8:00 PM local (creator US time zone) per Main account; +1 repurposed on Alt',
  department = ARRAY['1c6713c4-ffa4-468e-bc2f-bb972cd24182']::uuid[],
  is_active = true,
  updated_at = now()
FROM public.sop_roles r
WHERE r.slug = 'marketing-executives-us'
  AND r.id = ANY(f.sop_role)
  AND f.sort_order = 5;


