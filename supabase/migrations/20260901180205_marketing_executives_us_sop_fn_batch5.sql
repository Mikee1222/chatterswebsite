-- marketing_executives_us SOP functions batch 5

INSERT INTO public.sop_functions (
  function_id, name, kpi, standard_type, sop_content, cadence_type, cadence_note,
  sort_order, department, sop_role, is_active, content_version, created_at, updated_at
)
SELECT
  'sop_fn_me_us_21',
  'Weekly retro + next-week posting plan',
  '100% Friday retros completed; next-week posting plan documented before EOW; all blocks flagged',
  'text',
  '**Purpose**
Personal weekly retro — what worked, what didn''t, what''s blocked. Plan next week''s posting cadence per creator.

**When**
Friday afternoon, before end of week.

**Steps**
1. Pull last 7 days daily logs. Aggregate per creator: posts, best/worst performer, DM funnel count.
2. Self-review: what changed this week that worked / didn''t.
3. Identify blockers to resolve before Monday. Plan next week cadence, trials pipeline, filming alignment, highlight maintenance.
4. Post retro summary in Daily Reports (200–300 words). Flag blockers in Questions channel.

**Time**
30–45 min.

**Escalation**
Same blocker 2 weeks running → Marketing Manager. Burnout signals → CSM + Marketing Manager.',
  'weekly',
  'Friday afternoon',
  21,
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
    WHERE r.id = ANY(f.sop_role) AND f.sort_order = 21
  );

UPDATE public.sop_functions f SET
  name = 'Weekly retro + next-week posting plan',
  kpi = '100% Friday retros completed; next-week posting plan documented before EOW; all blocks flagged',
  sop_content = '**Purpose**
Personal weekly retro — what worked, what didn''t, what''s blocked. Plan next week''s posting cadence per creator.

**When**
Friday afternoon, before end of week.

**Steps**
1. Pull last 7 days daily logs. Aggregate per creator: posts, best/worst performer, DM funnel count.
2. Self-review: what changed this week that worked / didn''t.
3. Identify blockers to resolve before Monday. Plan next week cadence, trials pipeline, filming alignment, highlight maintenance.
4. Post retro summary in Daily Reports (200–300 words). Flag blockers in Questions channel.

**Time**
30–45 min.

**Escalation**
Same blocker 2 weeks running → Marketing Manager. Burnout signals → CSM + Marketing Manager.',
  cadence_type = 'weekly',
  cadence_note = 'Friday afternoon',
  department = ARRAY['1c6713c4-ffa4-468e-bc2f-bb972cd24182']::uuid[],
  is_active = true,
  updated_at = now()
FROM public.sop_roles r
WHERE r.slug = 'marketing-executives-us'
  AND r.id = ANY(f.sop_role)
  AND f.sort_order = 21;


INSERT INTO public.sop_functions (
  function_id, name, kpi, standard_type, sop_content, cadence_type, cadence_note,
  sort_order, department, sop_role, is_active, content_version, created_at, updated_at
)
SELECT
  'sop_fn_me_us_22',
  'Monthly account performance retro (per creator)',
  '100% of creators retro''d within 1st week of month; archived doc per creator; next-month plan documented',
  'text',
  '**Purpose**
Monthly deep retro per creator — follower growth, vertical performance, cadence efficiency, KPI trends. Output: next-month adjustment plan.

**Steps**
1. Pull last 30 days: net follower growth, total posts, top/bottom 5 by views, 8 KPI trends, DM funnel conversion.
2. Identify which verticals worked/died, cadence sustainability, Master drift, device issues.
3. Cross-reference Content Director vertical scorecard. Document next-month plan: mix, cadence, experiments, highlight schedule.
4. Submit to Marketing Manager + Head of Marketing. Archive in Notion creator page.

**Time**
1.5–2 hours per creator.

**Escalation**
2 consecutive months declining → Head of Marketing + CSM. Suspected device contamination → Head of Account Defense.',
  'monthly',
  'First week of each month',
  22,
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
    WHERE r.id = ANY(f.sop_role) AND f.sort_order = 22
  );

UPDATE public.sop_functions f SET
  name = 'Monthly account performance retro (per creator)',
  kpi = '100% of creators retro''d within 1st week of month; archived doc per creator; next-month plan documented',
  sop_content = '**Purpose**
Monthly deep retro per creator — follower growth, vertical performance, cadence efficiency, KPI trends. Output: next-month adjustment plan.

**Steps**
1. Pull last 30 days: net follower growth, total posts, top/bottom 5 by views, 8 KPI trends, DM funnel conversion.
2. Identify which verticals worked/died, cadence sustainability, Master drift, device issues.
3. Cross-reference Content Director vertical scorecard. Document next-month plan: mix, cadence, experiments, highlight schedule.
4. Submit to Marketing Manager + Head of Marketing. Archive in Notion creator page.

**Time**
1.5–2 hours per creator.

**Escalation**
2 consecutive months declining → Head of Marketing + CSM. Suspected device contamination → Head of Account Defense.',
  cadence_type = 'monthly',
  cadence_note = 'First week of each month',
  department = ARRAY['1c6713c4-ffa4-468e-bc2f-bb972cd24182']::uuid[],
  is_active = true,
  updated_at = now()
FROM public.sop_roles r
WHERE r.slug = 'marketing-executives-us'
  AND r.id = ANY(f.sop_role)
  AND f.sort_order = 22;


INSERT INTO public.sop_functions (
  function_id, name, kpi, standard_type, sop_content, cadence_type, cadence_note,
  sort_order, department, sop_role, is_active, content_version, created_at, updated_at
)
SELECT
  'sop_fn_me_us_23',
  'Monthly safety audit (device + account hygiene)',
  '0 unauthorized Account Center connections; 0 banned-hashtag usage; 100% device-creator mapping verified',
  'text',
  '**Purpose**
Monthly anti-ban audit — device hygiene, Account Center clean, no banned hashtag drift, no Wi-Fi incidents, password manager integrity.

**Steps**
1. Per device: iCloud Backup + Find My disabled; no Wi-Fi use; dedicated Apple ID/Gmail; physical SIM; storage check.
2. Per account: Account Center unauthorized links; Account Status GREEN; bio/PFP match Master; pinned posts match strategy.
3. Hashtag audit vs banned list; verify rotation. Password manager credentials + recovery info correct.
4. Document in monthly safety log. Flag issues to Head of Account Defense same-day.

**Time**
1–1.5 hours for full portfolio.

**Escalation**
ANY unauthorized Account Center link → Head of Account Defense + Marketing Manager IMMEDIATELY. iCloud Backup enabled → factory reset path with Manager approval.',
  'monthly',
  'End of month, anti-ban discipline check',
  23,
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
    WHERE r.id = ANY(f.sop_role) AND f.sort_order = 23
  );

UPDATE public.sop_functions f SET
  name = 'Monthly safety audit (device + account hygiene)',
  kpi = '0 unauthorized Account Center connections; 0 banned-hashtag usage; 100% device-creator mapping verified',
  sop_content = '**Purpose**
Monthly anti-ban audit — device hygiene, Account Center clean, no banned hashtag drift, no Wi-Fi incidents, password manager integrity.

**Steps**
1. Per device: iCloud Backup + Find My disabled; no Wi-Fi use; dedicated Apple ID/Gmail; physical SIM; storage check.
2. Per account: Account Center unauthorized links; Account Status GREEN; bio/PFP match Master; pinned posts match strategy.
3. Hashtag audit vs banned list; verify rotation. Password manager credentials + recovery info correct.
4. Document in monthly safety log. Flag issues to Head of Account Defense same-day.

**Time**
1–1.5 hours for full portfolio.

**Escalation**
ANY unauthorized Account Center link → Head of Account Defense + Marketing Manager IMMEDIATELY. iCloud Backup enabled → factory reset path with Manager approval.',
  cadence_type = 'monthly',
  cadence_note = 'End of month, anti-ban discipline check',
  department = ARRAY['1c6713c4-ffa4-468e-bc2f-bb972cd24182']::uuid[],
  is_active = true,
  updated_at = now()
FROM public.sop_roles r
WHERE r.slug = 'marketing-executives-us'
  AND r.id = ANY(f.sop_role)
  AND f.sort_order = 23;


INSERT INTO public.sop_functions (
  function_id, name, kpi, standard_type, sop_content, cadence_type, cadence_note,
  sort_order, department, sop_role, is_active, content_version, created_at, updated_at
)
SELECT
  'sop_fn_me_us_24',
  'New IG/TikTok account setup (Day 1)',
  '100% Day 1 setup complete before handoff; credentials logged same-minute; 0 Wi-Fi violations',
  'text',
  '**[PER EVENT — Daily cadence used as placeholder. Trigger: Head of Account Defense assigns new handle for warm-up]**

**Purpose**

**IG Steps**
Mobile data only → fresh Gmail/Yahoo → 30min email warm-up → create IG account per Master → verify email → no link in bio, no posts → approved PFP → bio `19 | FL` or `19 | FL | fitness` → save credentials → idle 24h → hand off.

**TikTok Steps**
Fresh Gmail/Outlook → register → username/display per Master → PFP + bio → **log credentials in Google Sheet same-minute** → Day 1 warm-up only, NO posts (20–30 min FYP scroll, niche likes, 3–5 comments).

**Hard rules**
Never reuse email. Never TT password = email password. Never personal Apple ID on work device. Never skip credentials logging.

**Time**
~2 hours spread over Day 1.

**Escalation**',
  'daily',
  'PER EVENT — when Head of Account Defense assigns new handle',
  24,
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
    WHERE r.id = ANY(f.sop_role) AND f.sort_order = 24
  );

UPDATE public.sop_functions f SET
  name = 'New IG/TikTok account setup (Day 1)',
  kpi = '100% Day 1 setup complete before handoff; credentials logged same-minute; 0 Wi-Fi violations',
  sop_content = '**[PER EVENT — Daily cadence used as placeholder. Trigger: Head of Account Defense assigns new handle for warm-up]**

**Purpose**

**IG Steps**
Mobile data only → fresh Gmail/Yahoo → 30min email warm-up → create IG account per Master → verify email → no link in bio, no posts → approved PFP → bio `19 | FL` or `19 | FL | fitness` → save credentials → idle 24h → hand off.

**TikTok Steps**
Fresh Gmail/Outlook → register → username/display per Master → PFP + bio → **log credentials in Google Sheet same-minute** → Day 1 warm-up only, NO posts (20–30 min FYP scroll, niche likes, 3–5 comments).

**Hard rules**
Never reuse email. Never TT password = email password. Never personal Apple ID on work device. Never skip credentials logging.

**Time**
~2 hours spread over Day 1.

**Escalation**',
  cadence_type = 'daily',
  cadence_note = 'PER EVENT — when Head of Account Defense assigns new handle',
  department = ARRAY['1c6713c4-ffa4-468e-bc2f-bb972cd24182']::uuid[],
  is_active = true,
  updated_at = now()
FROM public.sop_roles r
WHERE r.slug = 'marketing-executives-us'
  AND r.id = ANY(f.sop_role)
  AND f.sort_order = 24;


INSERT INTO public.sop_functions (
  function_id, name, kpi, standard_type, sop_content, cadence_type, cadence_note,
  sort_order, department, sop_role, is_active, content_version, created_at, updated_at
)
SELECT
  'sop_fn_me_us_25',
  'Account warm-up ramp (Days 1–3 new account)',
  '100% 3-day warm-up completed before Phase 3 content go-live; 0 premature posting; 0 follows/DMs during warm-up',
  'text',
  '**[PER EVENT — Daily cadence placeholder. Trigger: Day 1 setup complete on new account]**

**Purpose**
3-day algorithmic warm-up before account goes active. Trains algorithm to recognize real human user in niche.

**Daily actions (all 3 days)**
Likes max 15/day (≥5 sec gap). Watch Reels to completion. 1 comment or save every 3–4 videos. Few saves/day. Min 5 sec between actions.

**Hard limits during warm-up**
No follows. No DMs. No posts. No link in bio.

**Day-by-day (IG)**
Day 1: PFP + bio, warm-up only. Day 2: 1–2 grid photos spread, follow 5–15 niche EOD. Day 3: first Reel + 1 more photo. Day 4+: Daily Routine begins.

**Time**
30–45 min/day × 3 days.

**Escalation**
Action block during warm-up → STOP, screenshot, Marketing Manager. Phone re-verification → Head of Account Defense.',
  'daily',
  'PER EVENT — immediately after Day 1 setup of new account',
  25,
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
    WHERE r.id = ANY(f.sop_role) AND f.sort_order = 25
  );

UPDATE public.sop_functions f SET
  name = 'Account warm-up ramp (Days 1–3 new account)',
  kpi = '100% 3-day warm-up completed before Phase 3 content go-live; 0 premature posting; 0 follows/DMs during warm-up',
  sop_content = '**[PER EVENT — Daily cadence placeholder. Trigger: Day 1 setup complete on new account]**

**Purpose**
3-day algorithmic warm-up before account goes active. Trains algorithm to recognize real human user in niche.

**Daily actions (all 3 days)**
Likes max 15/day (≥5 sec gap). Watch Reels to completion. 1 comment or save every 3–4 videos. Few saves/day. Min 5 sec between actions.

**Hard limits during warm-up**
No follows. No DMs. No posts. No link in bio.

**Day-by-day (IG)**
Day 1: PFP + bio, warm-up only. Day 2: 1–2 grid photos spread, follow 5–15 niche EOD. Day 3: first Reel + 1 more photo. Day 4+: Daily Routine begins.

**Time**
30–45 min/day × 3 days.

**Escalation**
Action block during warm-up → STOP, screenshot, Marketing Manager. Phone re-verification → Head of Account Defense.',
  cadence_type = 'daily',
  cadence_note = 'PER EVENT — immediately after Day 1 setup of new account',
  department = ARRAY['1c6713c4-ffa4-468e-bc2f-bb972cd24182']::uuid[],
  is_active = true,
  updated_at = now()
FROM public.sop_roles r
WHERE r.slug = 'marketing-executives-us'
  AND r.id = ANY(f.sop_role)
  AND f.sort_order = 25;


