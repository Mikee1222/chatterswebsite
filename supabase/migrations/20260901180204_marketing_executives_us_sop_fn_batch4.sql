INSERT INTO public.sop_functions (
  function_id, name, kpi, standard_type, sop_content, cadence_type, cadence_note,
  sort_order, department, sop_role, is_active, content_version, created_at, updated_at
)
SELECT
  'sop_fn_me_us_16',
  'Weekly highlights & profile maintenance',
  '5 active highlights refreshed weekly; 0 stale (>2 weeks no update); bio/PFP matches Master',
  'text',
  '**Purpose**
Weekly profile maintenance — highlights refresh, cover updates, bio sync, PFP verification. Profile drift = trust score erosion.

**When**
Once per week (default Friday or off-peak). Per account.

**Steps**
1. Check 5 standard highlights: Gym/Fitness, Food/Lifestyle, Trips/Travel, Daily Vibes, OnlyFans Link (verified or Manager approval only).
2. Per highlight: last update <14 days. Stale → add 1–2 new stories.
3. Refresh highlight covers. Verify bio matches Master template. Verify PFP is approved and not identical to another creator account.
4. Verify link in bio works. Account Center check for unauthorized Meta connections.
5. Log maintenance in weekly sheet.

**Time**
15–25 minutes per account.

**Escalation**
Unauthorized Meta connection → Marketing Manager + Head of Account Defense. Unexpected bio change → possible compromise, ping immediately.',
  'weekly',
  'Once per week, per account (default Friday or off-peak)',
  16,
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
    WHERE r.id = ANY(f.sop_role) AND f.sort_order = 16
  );

UPDATE public.sop_functions f SET
  name = 'Weekly highlights & profile maintenance',
  kpi = '5 active highlights refreshed weekly; 0 stale (>2 weeks no update); bio/PFP matches Master',
  sop_content = '**Purpose**
Weekly profile maintenance — highlights refresh, cover updates, bio sync, PFP verification. Profile drift = trust score erosion.

**When**
Once per week (default Friday or off-peak). Per account.

**Steps**
1. Check 5 standard highlights: Gym/Fitness, Food/Lifestyle, Trips/Travel, Daily Vibes, OnlyFans Link (verified or Manager approval only).
2. Per highlight: last update <14 days. Stale → add 1–2 new stories.
3. Refresh highlight covers. Verify bio matches Master template. Verify PFP is approved and not identical to another creator account.
4. Verify link in bio works. Account Center check for unauthorized Meta connections.
5. Log maintenance in weekly sheet.

**Time**
15–25 minutes per account.

**Escalation**
Unauthorized Meta connection → Marketing Manager + Head of Account Defense. Unexpected bio change → possible compromise, ping immediately.',
  cadence_type = 'weekly',
  cadence_note = 'Once per week, per account (default Friday or off-peak)',
  department = ARRAY['1c6713c4-ffa4-468e-bc2f-bb972cd24182']::uuid[],
  is_active = true,
  updated_at = now()
FROM public.sop_roles r
WHERE r.slug = 'marketing-executives-us'
  AND r.id = ANY(f.sop_role)
  AND f.sort_order = 16;



INSERT INTO public.sop_functions (
  function_id, name, kpi, standard_type, sop_content, cadence_type, cadence_note,
  sort_order, department, sop_role, is_active, content_version, created_at, updated_at
)
SELECT
  'sop_fn_me_us_17',
  'Weekly KPI review with Marketing Manager',
  '100% participation; all 8 KPIs reviewed per assigned creator; next-week priorities documented',
  'text',
  '**Purpose**
Weekly sync with Marketing Manager — review 8 KPIs per creator, identify levers to pull, plan next week. You don''t change the loop; you change the lever.

**When**
Every Monday (default). 30–45min per VA, group or 1-on-1 per Manager preference.

**Steps**
1. Pre-meeting prep (15 min): pull views/engagement, screenshot Insights, note anomalies.
2. In meeting review 8 KPIs: follower growth, avg Reel views, save rate, share rate, profile-to-follow, follower-to-DM, DM-to-sub, sub-to-revenue.
3. KPI missed target 2 weeks running → identify lever (caption, hook, posting time, vertical mix).
4. Manager assigns experiments for next week.
5. Document action plan in Discord thread + Notion sync notes.

**Time**
~1 hour total (prep + meeting + documentation).

**Escalation**
2 weeks missed targets + no clear cause → Head of Marketing. Suspected mass shadowban → Head of Account Defense.',
  'weekly',
  'Every Monday, 30–45min sync',
  17,
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
    WHERE r.id = ANY(f.sop_role) AND f.sort_order = 17
  );

UPDATE public.sop_functions f SET
  name = 'Weekly KPI review with Marketing Manager',
  kpi = '100% participation; all 8 KPIs reviewed per assigned creator; next-week priorities documented',
  sop_content = '**Purpose**
Weekly sync with Marketing Manager — review 8 KPIs per creator, identify levers to pull, plan next week. You don''t change the loop; you change the lever.

**When**
Every Monday (default). 30–45min per VA, group or 1-on-1 per Manager preference.

**Steps**
1. Pre-meeting prep (15 min): pull views/engagement, screenshot Insights, note anomalies.
2. In meeting review 8 KPIs: follower growth, avg Reel views, save rate, share rate, profile-to-follow, follower-to-DM, DM-to-sub, sub-to-revenue.
3. KPI missed target 2 weeks running → identify lever (caption, hook, posting time, vertical mix).
4. Manager assigns experiments for next week.
5. Document action plan in Discord thread + Notion sync notes.

**Time**
~1 hour total (prep + meeting + documentation).

**Escalation**
2 weeks missed targets + no clear cause → Head of Marketing. Suspected mass shadowban → Head of Account Defense.',
  cadence_type = 'weekly',
  cadence_note = 'Every Monday, 30–45min sync',
  department = ARRAY['1c6713c4-ffa4-468e-bc2f-bb972cd24182']::uuid[],
  is_active = true,
  updated_at = now()
FROM public.sop_roles r
WHERE r.slug = 'marketing-executives-us'
  AND r.id = ANY(f.sop_role)
  AND f.sort_order = 17;



INSERT INTO public.sop_functions (
  function_id, name, kpi, standard_type, sop_content, cadence_type, cadence_note,
  sort_order, department, sop_role, is_active, content_version, created_at, updated_at
)
SELECT
  'sop_fn_me_us_18',
  'Weekly content brief sync with Marketing Manager / Content Director',
  'Briefs received 2–3 days before filming; all questions resolved before shoot; 0 day-of-shoot brief gaps',
  'text',
  '**Purpose**
Weekly sync to receive content briefs **2–3 days before filming day**, ask clarifications, align with filmer. Late briefs = panicked execution + bad content.

**Steps**
1. Receive brief: caption variants, hooks, vertical mix, posting concepts.
2. Read end-to-end. Cross-check vs Account Master voice and Templates & Assets.
3. Compile questions in one message. Sync with filmer on shots/angles. Sync with creator on expectations.
4. Confirm iCloud folder ready. Identify blockers (props, location, outfit).

**Time**
~45 min (review + sync).

**Escalation**
Brief arrives <24h before shoot → flag Marketing Manager. Brief contradicts Master voice → Content Director clarify.',
  'weekly',
  '2–3 days before next filming day',
  18,
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
    WHERE r.id = ANY(f.sop_role) AND f.sort_order = 18
  );

UPDATE public.sop_functions f SET
  name = 'Weekly content brief sync with Marketing Manager / Content Director',
  kpi = 'Briefs received 2–3 days before filming; all questions resolved before shoot; 0 day-of-shoot brief gaps',
  sop_content = '**Purpose**
Weekly sync to receive content briefs **2–3 days before filming day**, ask clarifications, align with filmer. Late briefs = panicked execution + bad content.

**Steps**
1. Receive brief: caption variants, hooks, vertical mix, posting concepts.
2. Read end-to-end. Cross-check vs Account Master voice and Templates & Assets.
3. Compile questions in one message. Sync with filmer on shots/angles. Sync with creator on expectations.
4. Confirm iCloud folder ready. Identify blockers (props, location, outfit).

**Time**
~45 min (review + sync).

**Escalation**
Brief arrives <24h before shoot → flag Marketing Manager. Brief contradicts Master voice → Content Director clarify.',
  cadence_type = 'weekly',
  cadence_note = '2–3 days before next filming day',
  department = ARRAY['1c6713c4-ffa4-468e-bc2f-bb972cd24182']::uuid[],
  is_active = true,
  updated_at = now()
FROM public.sop_roles r
WHERE r.slug = 'marketing-executives-us'
  AND r.id = ANY(f.sop_role)
  AND f.sort_order = 18;



INSERT INTO public.sop_functions (
  function_id, name, kpi, standard_type, sop_content, cadence_type, cadence_note,
  sort_order, department, sop_role, is_active, content_version, created_at, updated_at
)
SELECT
  'sop_fn_me_us_19',
  'Winner identification & report (weekly scan)',
  '100% of videos meeting 2.5x threshold reported to Winner Videos channel in correct format; 0 raw-link reports',
  'text',
  '**Purpose**
Identify winning videos (2.5x median views) + report to iCloud Manager in correct format. Winners feed Cloud Manager → Trials pipeline.

**When**
Weekly scan (default Friday) + immediate ping when threshold hit mid-week.

**Steps**
1. Per account: pull views for last 10 posts. Calculate **median** (not mean).
2. Identify videos with views ≥ 2.5x median.
3. Post in Winner Videos section with template: [WIN] | [creator] | [vertical], handle/link, views vs median, date, why it won, video attached.
4. Log in weekly sheet.

**Time**
30–45 min weekly per creator portfolio.

**Escalation**
2 weeks zero winners → weekly KPI review. Winner deleted from IG → ping iCloud Manager for backup.',
  'weekly',
  'Once per week or when winners hit threshold mid-week',
  19,
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
    WHERE r.id = ANY(f.sop_role) AND f.sort_order = 19
  );

UPDATE public.sop_functions f SET
  name = 'Winner identification & report (weekly scan)',
  kpi = '100% of videos meeting 2.5x threshold reported to Winner Videos channel in correct format; 0 raw-link reports',
  sop_content = '**Purpose**
Identify winning videos (2.5x median views) + report to iCloud Manager in correct format. Winners feed Cloud Manager → Trials pipeline.

**When**
Weekly scan (default Friday) + immediate ping when threshold hit mid-week.

**Steps**
1. Per account: pull views for last 10 posts. Calculate **median** (not mean).
2. Identify videos with views ≥ 2.5x median.
3. Post in Winner Videos section with template: [WIN] | [creator] | [vertical], handle/link, views vs median, date, why it won, video attached.
4. Log in weekly sheet.

**Time**
30–45 min weekly per creator portfolio.

**Escalation**
2 weeks zero winners → weekly KPI review. Winner deleted from IG → ping iCloud Manager for backup.',
  cadence_type = 'weekly',
  cadence_note = 'Once per week or when winners hit threshold mid-week',
  department = ARRAY['1c6713c4-ffa4-468e-bc2f-bb972cd24182']::uuid[],
  is_active = true,
  updated_at = now()
FROM public.sop_roles r
WHERE r.slug = 'marketing-executives-us'
  AND r.id = ANY(f.sop_role)
  AND f.sort_order = 19;



INSERT INTO public.sop_functions (
  function_id, name, kpi, standard_type, sop_content, cadence_type, cadence_note,
  sort_order, department, sop_role, is_active, content_version, created_at, updated_at
)
SELECT
  'sop_fn_me_us_20',
  'Variant repurposing batch (from Trials folder)',
  '100% trial variants edited unique per session; 0 duplicate-content flags; batch ready before next day''s posting',
  'text',
  '**Purpose**
Batch-process Trial Reel variants from iCloud Manager → make each unique per upload (cut, brightness, overlay) → ready for posting.

**Steps**
1. Open `/Month_Day/Trials/`. Per video: download, open CapCut, trim 0.1s, brightness +5 to +10, invisible username overlay (opacity 0%), remove CapCut watermark/outro, export as new file.
2. Delete downloaded copy from device; keep iCloud master intact.
3. Max 2 settings per session dramatic. Always cut min 1 sec. Source always Trials, never Winners directly.

**Time**
3–5 min per video; batch 10–15 = ~45–75 min weekly.

**Escalation**
Trials folder empty → iCloud Manager. Similar content flag after edit → escalate variant rotation.',
  'weekly',
  'When iCloud Manager updates Trials folder',
  20,
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
    WHERE r.id = ANY(f.sop_role) AND f.sort_order = 20
  );

UPDATE public.sop_functions f SET
  name = 'Variant repurposing batch (from Trials folder)',
  kpi = '100% trial variants edited unique per session; 0 duplicate-content flags; batch ready before next day''s posting',
  sop_content = '**Purpose**
Batch-process Trial Reel variants from iCloud Manager → make each unique per upload (cut, brightness, overlay) → ready for posting.

**Steps**
1. Open `/Month_Day/Trials/`. Per video: download, open CapCut, trim 0.1s, brightness +5 to +10, invisible username overlay (opacity 0%), remove CapCut watermark/outro, export as new file.
2. Delete downloaded copy from device; keep iCloud master intact.
3. Max 2 settings per session dramatic. Always cut min 1 sec. Source always Trials, never Winners directly.

**Time**
3–5 min per video; batch 10–15 = ~45–75 min weekly.

**Escalation**
Trials folder empty → iCloud Manager. Similar content flag after edit → escalate variant rotation.',
  cadence_type = 'weekly',
  cadence_note = 'When iCloud Manager updates Trials folder',
  department = ARRAY['1c6713c4-ffa4-468e-bc2f-bb972cd24182']::uuid[],
  is_active = true,
  updated_at = now()
FROM public.sop_roles r
WHERE r.slug = 'marketing-executives-us'
  AND r.id = ANY(f.sop_role)
  AND f.sort_order = 20;