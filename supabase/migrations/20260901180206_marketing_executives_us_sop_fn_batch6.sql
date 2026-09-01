-- marketing_executives_us SOP functions batch 6

INSERT INTO public.sop_functions (
  function_id, name, kpi, standard_type, sop_content, cadence_type, cadence_note,
  sort_order, department, sop_role, is_active, content_version, created_at, updated_at
)
SELECT
  'sop_fn_me_us_26',
  'Trial Reels launch (per new variant batch)',
  '100% Trials posted with toggle ON; 0 grid contamination; post verified in Trials section <60s; log filled',
  'text',
  '**[PER EVENT — Daily cadence placeholder. Trigger: iCloud Manager updates Trial subfolder + variant edited per Repurpose SOP]**

**Purpose**
Post a Trial Reel — IG feature showing reel only to non-followers, never on grid, fully reusable. Gunzo''s core cold-traffic scaling weapon.

**Cadence by tier**
New (<30d): 1–3/day. Aged (30+d): 5–20/day. Warmed (90+d): 20–50/day. Power Pages (200+d): 50–100+/day.

**Steps**
Enable Trial Reels in Professional Dashboard (one-time). Pull variant → New Reel → caption from Templates → cover → **Toggle Trial ON** → post → wait 60s verify in Trials section NOT grid → screenshot log → move to Grid (posted) subfolder.

**Time**
5–8 min per Trial post.

**Escalation**
Reel on grid → delete + repost with toggle ON. Trial feature lost → Marketing Manager. Variant flagged 3x → Content Director.',
  'daily',
  'PER EVENT — when Trial Reel variant ready from Cloud Manager batch',
  26,
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
    WHERE r.id = ANY(f.sop_role) AND f.sort_order = 26
  );

UPDATE public.sop_functions f SET
  name = 'Trial Reels launch (per new variant batch)',
  kpi = '100% Trials posted with toggle ON; 0 grid contamination; post verified in Trials section <60s; log filled',
  sop_content = '**[PER EVENT — Daily cadence placeholder. Trigger: iCloud Manager updates Trial subfolder + variant edited per Repurpose SOP]**

**Purpose**
Post a Trial Reel — IG feature showing reel only to non-followers, never on grid, fully reusable. Gunzo''s core cold-traffic scaling weapon.

**Cadence by tier**
New (<30d): 1–3/day. Aged (30+d): 5–20/day. Warmed (90+d): 20–50/day. Power Pages (200+d): 50–100+/day.

**Steps**
Enable Trial Reels in Professional Dashboard (one-time). Pull variant → New Reel → caption from Templates → cover → **Toggle Trial ON** → post → wait 60s verify in Trials section NOT grid → screenshot log → move to Grid (posted) subfolder.

**Time**
5–8 min per Trial post.

**Escalation**
Reel on grid → delete + repost with toggle ON. Trial feature lost → Marketing Manager. Variant flagged 3x → Content Director.',
  cadence_type = 'daily',
  cadence_note = 'PER EVENT — when Trial Reel variant ready from Cloud Manager batch',
  department = ARRAY['1c6713c4-ffa4-468e-bc2f-bb972cd24182']::uuid[],
  is_active = true,
  updated_at = now()
FROM public.sop_roles r
WHERE r.slug = 'marketing-executives-us'
  AND r.id = ANY(f.sop_role)
  AND f.sort_order = 26;


INSERT INTO public.sop_functions (
  function_id, name, kpi, standard_type, sop_content, cadence_type, cadence_note,
  sort_order, department, sop_role, is_active, content_version, created_at, updated_at
)
SELECT
  'sop_fn_me_us_27',
  'Ban / restriction / shadowban triage (per incident)',
  '100% incidents reported same-minute; all screenshots captured; 0 VA-independent appeals; backup activated within day for disables',
  'text',
  '**[PER EVENT — Daily cadence placeholder]**

**Purpose**
Triage account safety incident — detect type, execute stop-actions per scenario, report immediately, activate backup where needed. Never appeal independently.

**Universal steps**
Detect via Account Status → screenshot everything → report Supervisor + Marketing Manager in Account Defense channel.

**Scenario 1 — Action Block (48h)**
STOP likes/follows/comments. CONTINUE posting, stories, scrolling, DM replies.

**Scenario 2 — Shadowban (reach drop 50%+)**
IG STOP: posting, DMs+OF funnel, F4F, unfollow. CONTINUE: stories, comments, scrolling. Archive last 2 posts. Resume only when green + Manager approves.

**Scenario 3 — Temporary Disable**
Screenshot + report. Activate backup same-day. Do NOT appeal independently. Do not log into disabled account from work device.

**Scenario 4 — Permanent Ban**
Report with screenshots. Hand device to Marketing Manager. Activate backup. Do not attempt recovery independently.

**Appeal**
Submitted exclusively by Marketing Manager. VA provides screenshots + screen recording (Wi-Fi OFF, Mobile Data ON).

**Escalation**
Power Page incident → COO + Head of Account Defense. Cascade (multiple accounts orange same day) → immediate Head of Account Defense + COO.',
  'daily',
  'PER EVENT — orange flag, action block, shadowban, disable, or permanent ban',
  27,
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
    WHERE r.id = ANY(f.sop_role) AND f.sort_order = 27
  );

UPDATE public.sop_functions f SET
  name = 'Ban / restriction / shadowban triage (per incident)',
  kpi = '100% incidents reported same-minute; all screenshots captured; 0 VA-independent appeals; backup activated within day for disables',
  sop_content = '**[PER EVENT — Daily cadence placeholder]**

**Purpose**
Triage account safety incident — detect type, execute stop-actions per scenario, report immediately, activate backup where needed. Never appeal independently.

**Universal steps**
Detect via Account Status → screenshot everything → report Supervisor + Marketing Manager in Account Defense channel.

**Scenario 1 — Action Block (48h)**
STOP likes/follows/comments. CONTINUE posting, stories, scrolling, DM replies.

**Scenario 2 — Shadowban (reach drop 50%+)**
IG STOP: posting, DMs+OF funnel, F4F, unfollow. CONTINUE: stories, comments, scrolling. Archive last 2 posts. Resume only when green + Manager approves.

**Scenario 3 — Temporary Disable**
Screenshot + report. Activate backup same-day. Do NOT appeal independently. Do not log into disabled account from work device.

**Scenario 4 — Permanent Ban**
Report with screenshots. Hand device to Marketing Manager. Activate backup. Do not attempt recovery independently.

**Appeal**
Submitted exclusively by Marketing Manager. VA provides screenshots + screen recording (Wi-Fi OFF, Mobile Data ON).

**Escalation**
Power Page incident → COO + Head of Account Defense. Cascade (multiple accounts orange same day) → immediate Head of Account Defense + COO.',
  cadence_type = 'daily',
  cadence_note = 'PER EVENT — orange flag, action block, shadowban, disable, or permanent ban',
  department = ARRAY['1c6713c4-ffa4-468e-bc2f-bb972cd24182']::uuid[],
  is_active = true,
  updated_at = now()
FROM public.sop_roles r
WHERE r.slug = 'marketing-executives-us'
  AND r.id = ANY(f.sop_role)
  AND f.sort_order = 27;


INSERT INTO public.sop_functions (
  function_id, name, kpi, standard_type, sop_content, cadence_type, cadence_note,
  sort_order, department, sop_role, is_active, content_version, created_at, updated_at
)
SELECT
  'sop_fn_me_us_28',
  'Creative production support (carousel/story/edit requests from Content Director)',
  '100% requests delivered within agreed turnaround; 0 voice/aesthetic mismatches; all assets archived in iCloud',
  'text',
  '**[PER EVENT — Daily cadence placeholder]**

**Purpose**
Execute ad-hoc creative production — TT/IG carousels, story sets, reel edits, caption remixes. Hand-in-hand with Content Director.

**Steps**
1. Receive brief, deadline, assets, expected output. Acknowledge + ETA within 1h.
2. Pull source from iCloud (Social Media Posts / Stories / Video To Upload) + Templates. Cross-check Master voice + aesthetic.
3. Execute per type (carousel 3–7 slides, story set, reel edit per repurpose rules, caption remix).
4. Quality-check vs safety rules. Deliver to iCloud + request thread. Archive in Social Media Posts folder (correct month/carousel slot).

**Time**
30 min – 2h per request.

**Escalation**
Scope creep → Content Director. Missing source → iCloud Manager. Conflicts with daily cadence → Marketing Manager prioritize.',
  'daily',
  'PER EVENT — when Content Director queues creative request',
  28,
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
    WHERE r.id = ANY(f.sop_role) AND f.sort_order = 28
  );

UPDATE public.sop_functions f SET
  name = 'Creative production support (carousel/story/edit requests from Content Director)',
  kpi = '100% requests delivered within agreed turnaround; 0 voice/aesthetic mismatches; all assets archived in iCloud',
  sop_content = '**[PER EVENT — Daily cadence placeholder]**

**Purpose**
Execute ad-hoc creative production — TT/IG carousels, story sets, reel edits, caption remixes. Hand-in-hand with Content Director.

**Steps**
1. Receive brief, deadline, assets, expected output. Acknowledge + ETA within 1h.
2. Pull source from iCloud (Social Media Posts / Stories / Video To Upload) + Templates. Cross-check Master voice + aesthetic.
3. Execute per type (carousel 3–7 slides, story set, reel edit per repurpose rules, caption remix).
4. Quality-check vs safety rules. Deliver to iCloud + request thread. Archive in Social Media Posts folder (correct month/carousel slot).

**Time**
30 min – 2h per request.

**Escalation**
Scope creep → Content Director. Missing source → iCloud Manager. Conflicts with daily cadence → Marketing Manager prioritize.',
  cadence_type = 'daily',
  cadence_note = 'PER EVENT — when Content Director queues creative request',
  department = ARRAY['1c6713c4-ffa4-468e-bc2f-bb972cd24182']::uuid[],
  is_active = true,
  updated_at = now()
FROM public.sop_roles r
WHERE r.slug = 'marketing-executives-us'
  AND r.id = ANY(f.sop_role)
  AND f.sort_order = 28;


INSERT INTO public.sop_functions (
  function_id, name, kpi, standard_type, sop_content, cadence_type, cadence_note,
  sort_order, department, sop_role, is_active, content_version, created_at, updated_at
)
SELECT
  'sop_fn_me_us_29',
  'Account handoff (offboarding / VA transition)',
  '100% credentials transferred securely; factory reset where required; 0 unauthorized access post-handoff',
  'text',
  '**[PER EVENT — Daily cadence placeholder]**

**Purpose**
Clean offboarding of an account from one VA to another (or to dormancy). Protect credentials, device hygiene, and trust score.

**Steps**
1. Receive handoff order from Head of Account Defense: target VA, date, account list.
2. Day-of: change credentials same-day; transfer via password manager only; verify new VA access.
3. If VA leaving: factory reset device, sign out iCloud, check Account Center, revoke password manager/Telegram/Discord access, return device to Head of Account Defense.
4. If creator pause: lower cadence or full pause per Manager; log pause date.
5. New VA confirms login; first 3 days flagged for supervision.

**Time**
30–60 min credential transfer + Day 1 oversight.

**Escalation**
Departing VA refuses device → HR + Head of Account Defense. Unauthorized Account Center post-handoff → immediate forensics. New VA fails Day 1 checks → re-training before continuing.',
  'daily',
  'PER EVENT — account transferred to another VA, or VA leaves',
  29,
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
    WHERE r.id = ANY(f.sop_role) AND f.sort_order = 29
  );

UPDATE public.sop_functions f SET
  name = 'Account handoff (offboarding / VA transition)',
  kpi = '100% credentials transferred securely; factory reset where required; 0 unauthorized access post-handoff',
  sop_content = '**[PER EVENT — Daily cadence placeholder]**

**Purpose**
Clean offboarding of an account from one VA to another (or to dormancy). Protect credentials, device hygiene, and trust score.

**Steps**
1. Receive handoff order from Head of Account Defense: target VA, date, account list.
2. Day-of: change credentials same-day; transfer via password manager only; verify new VA access.
3. If VA leaving: factory reset device, sign out iCloud, check Account Center, revoke password manager/Telegram/Discord access, return device to Head of Account Defense.
4. If creator pause: lower cadence or full pause per Manager; log pause date.
5. New VA confirms login; first 3 days flagged for supervision.

**Time**
30–60 min credential transfer + Day 1 oversight.

**Escalation**
Departing VA refuses device → HR + Head of Account Defense. Unauthorized Account Center post-handoff → immediate forensics. New VA fails Day 1 checks → re-training before continuing.',
  cadence_type = 'daily',
  cadence_note = 'PER EVENT — account transferred to another VA, or VA leaves',
  department = ARRAY['1c6713c4-ffa4-468e-bc2f-bb972cd24182']::uuid[],
  is_active = true,
  updated_at = now()
FROM public.sop_roles r
WHERE r.slug = 'marketing-executives-us'
  AND r.id = ANY(f.sop_role)
  AND f.sort_order = 29;


