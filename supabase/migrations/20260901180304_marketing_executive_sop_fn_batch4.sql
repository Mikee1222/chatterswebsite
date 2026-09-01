-- marketing_executive SOP functions batch 4

INSERT INTO public.sop_functions (
  function_id, name, kpi, standard_type, sop_content, cadence_type, cadence_note,
  sort_order, department, sop_role, is_active, content_version, created_at, updated_at
)
SELECT
  'sop_fn_me_gr_16',
  'Weekly highlights & profile maintenance',
  'Highlights refreshed weekly per creator categories (set with Marketing Manager); 0 stale (>2 weeks); bio/PFP matches Master',
  'text',
  '**Σκοπός**
Weekly maintenance check στο profile — highlights refresh, covers update, bio sync, PFP verification. Profile drift = trust score erosion.

**Πότε**
Μία φορά/εβδομάδα (default Παρασκευή ή ώρα off-peak). Ανά account.

**Tools**
- Account Master Reference
- iCloud (highlight cover assets)
- IG app
- Marketing Manager (per-creator highlight category list)

**Steps**
1. Open creator''s profile → check highlight categories **defined per-creator με Marketing Manager** (όχι fixed global list).
2. Per highlight: confirm last update <14 days. Stale → add 1-2 new stories.
3. Refresh highlight covers (consistent visual identity).
4. Verify bio matches Master template (no drift).
5. Verify PFP matches approved version + δεν είναι identical με άλλο account creator.
6. Verify link in bio works (tap + confirm landing page).
7. Account Center check: no unauthorized Meta connections.
8. Log maintenance στο weekly sheet.

**Time**
15-25 λεπτά ανά account.

**Common mistakes**
- Assume default categories αντί per-creator list → wrong profile structure.
- Skip "looks fine to me" → drift accumulates.
- Identical PFP cross-creator → Meta fingerprint match.
- Forget Account Center check → unauthorized link sneaks in.

**Escalation**
- Unauthorized Meta Account Center connection → Marketing Manager + Head of Account Defense.
- Bio change που δεν made the VA → possible compromise, ping immediately.',
  'weekly',
  'Μία φορά/εβδομάδα, ανά account',
  16,
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
    WHERE r.id = ANY(f.sop_role) AND f.sort_order = 16
  );

UPDATE public.sop_functions f SET
  name = 'Weekly highlights & profile maintenance',
  kpi = 'Highlights refreshed weekly per creator categories (set with Marketing Manager); 0 stale (>2 weeks); bio/PFP matches Master',
  sop_content = '**Σκοπός**
Weekly maintenance check στο profile — highlights refresh, covers update, bio sync, PFP verification. Profile drift = trust score erosion.

**Πότε**
Μία φορά/εβδομάδα (default Παρασκευή ή ώρα off-peak). Ανά account.

**Tools**
- Account Master Reference
- iCloud (highlight cover assets)
- IG app
- Marketing Manager (per-creator highlight category list)

**Steps**
1. Open creator''s profile → check highlight categories **defined per-creator με Marketing Manager** (όχι fixed global list).
2. Per highlight: confirm last update <14 days. Stale → add 1-2 new stories.
3. Refresh highlight covers (consistent visual identity).
4. Verify bio matches Master template (no drift).
5. Verify PFP matches approved version + δεν είναι identical με άλλο account creator.
6. Verify link in bio works (tap + confirm landing page).
7. Account Center check: no unauthorized Meta connections.
8. Log maintenance στο weekly sheet.

**Time**
15-25 λεπτά ανά account.

**Common mistakes**
- Assume default categories αντί per-creator list → wrong profile structure.
- Skip "looks fine to me" → drift accumulates.
- Identical PFP cross-creator → Meta fingerprint match.
- Forget Account Center check → unauthorized link sneaks in.

**Escalation**
- Unauthorized Meta Account Center connection → Marketing Manager + Head of Account Defense.
- Bio change που δεν made the VA → possible compromise, ping immediately.',
  cadence_type = 'weekly',
  cadence_note = 'Μία φορά/εβδομάδα, ανά account',
  department = ARRAY['1c6713c4-ffa4-468e-bc2f-bb972cd24182']::uuid[],
  is_active = true,
  updated_at = now()
FROM public.sop_roles r
WHERE r.slug = 'marketing-executive'
  AND r.id = ANY(f.sop_role)
  AND f.sort_order = 16;


INSERT INTO public.sop_functions (
  function_id, name, kpi, standard_type, sop_content, cadence_type, cadence_note,
  sort_order, department, sop_role, is_active, content_version, created_at, updated_at
)
SELECT
  'sop_fn_me_gr_17',
  'Weekly KPI review με Marketing Manager',
  '100% participation, all 8 KPIs reviewed per assigned creator, next-week priorities documented',
  'text',
  '**Σκοπός**
Weekly sync με Marketing Manager — review 8 KPIs ανά creator, identify levers to pull, plan next week. Δεν αλλάζει το loop, αλλάζει το lever.

**Πότε**
Κάθε Δευτέρα (default). 30-45min meeting per VA, group ή 1-on-1 per Marketing Manager preference.

**Tools**
- Weekly KPI Dashboard (από Head of Marketing)
- IG/TT/FB Insights screenshots
- Infloww (sub funnel data)
- Notion → Marketing Executive sync notes page

**Steps**
1. Pre-meeting prep (15 min):
   - Pull views/engagement data ανά account
   - Screenshot Insights → save στο shared folder
   - Note anomalies (sudden drops, sudden spikes)
2. In meeting: review 8 KPIs ανά creator:
   - Follower growth rate
   - Avg Reel views
   - Save rate
   - Share rate
   - Profile-to-follow rate
   - Follower-to-DM rate
   - DM-to-sub rate
   - Sub-to-revenue rate
3. For each KPI που missed target 2 εβδομάδες σε σειρά → identify lever to pull (caption type, hook, posting time, vertical mix).
4. Marketing Manager assigns specific experiments για επόμενη εβδομάδα.
5. Post-meeting: document το action plan στο Discord thread + sync notes Notion page.

**Time**
15 min prep + 30-45 min meeting + 10 min documentation = ~1 hour total.

**Common mistakes**
- No prep → meeting becomes "what happened?", not actionable.
- Argue with KPIs → numbers don''t lie, look for cause.
- Change το loop όταν χάνεις KPI → reset signal. Change το lever instead.
- Forget να document actions → next week ίδιο review.

**Escalation**
- 2 weeks missed targets + no clear cause → loop in Head of Marketing.
- Algorithmic anomaly suspected (mass shadowban) → Head of Account Defense.',
  'weekly',
  'Κάθε Δευτέρα, 30-45min sync',
  17,
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
    WHERE r.id = ANY(f.sop_role) AND f.sort_order = 17
  );

UPDATE public.sop_functions f SET
  name = 'Weekly KPI review με Marketing Manager',
  kpi = '100% participation, all 8 KPIs reviewed per assigned creator, next-week priorities documented',
  sop_content = '**Σκοπός**
Weekly sync με Marketing Manager — review 8 KPIs ανά creator, identify levers to pull, plan next week. Δεν αλλάζει το loop, αλλάζει το lever.

**Πότε**
Κάθε Δευτέρα (default). 30-45min meeting per VA, group ή 1-on-1 per Marketing Manager preference.

**Tools**
- Weekly KPI Dashboard (από Head of Marketing)
- IG/TT/FB Insights screenshots
- Infloww (sub funnel data)
- Notion → Marketing Executive sync notes page

**Steps**
1. Pre-meeting prep (15 min):
   - Pull views/engagement data ανά account
   - Screenshot Insights → save στο shared folder
   - Note anomalies (sudden drops, sudden spikes)
2. In meeting: review 8 KPIs ανά creator:
   - Follower growth rate
   - Avg Reel views
   - Save rate
   - Share rate
   - Profile-to-follow rate
   - Follower-to-DM rate
   - DM-to-sub rate
   - Sub-to-revenue rate
3. For each KPI που missed target 2 εβδομάδες σε σειρά → identify lever to pull (caption type, hook, posting time, vertical mix).
4. Marketing Manager assigns specific experiments για επόμενη εβδομάδα.
5. Post-meeting: document το action plan στο Discord thread + sync notes Notion page.

**Time**
15 min prep + 30-45 min meeting + 10 min documentation = ~1 hour total.

**Common mistakes**
- No prep → meeting becomes "what happened?", not actionable.
- Argue with KPIs → numbers don''t lie, look for cause.
- Change το loop όταν χάνεις KPI → reset signal. Change το lever instead.
- Forget να document actions → next week ίδιο review.

**Escalation**
- 2 weeks missed targets + no clear cause → loop in Head of Marketing.
- Algorithmic anomaly suspected (mass shadowban) → Head of Account Defense.',
  cadence_type = 'weekly',
  cadence_note = 'Κάθε Δευτέρα, 30-45min sync',
  department = ARRAY['1c6713c4-ffa4-468e-bc2f-bb972cd24182']::uuid[],
  is_active = true,
  updated_at = now()
FROM public.sop_roles r
WHERE r.slug = 'marketing-executive'
  AND r.id = ANY(f.sop_role)
  AND f.sort_order = 17;


INSERT INTO public.sop_functions (
  function_id, name, kpi, standard_type, sop_content, cadence_type, cadence_note,
  sort_order, department, sop_role, is_active, content_version, created_at, updated_at
)
SELECT
  'sop_fn_me_gr_18',
  'Weekly content brief sync με Marketing Manager / Content Director',
  'Briefs received 2-3 μέρες πριν filming, all questions resolved πριν shoot, 0 day-of-shoot brief gaps',
  'text',
  '**Σκοπός**
Weekly sync για να λάβεις content briefs **2-3 μέρες πριν filming day**, να ρωτήσεις διευκρινίσεις, να align με τον filmer. Late briefs = panicked execution + bad content.

**Πότε**
2-3 μέρες πριν κάθε filming day (στο standard creator schedule).

**Tools**
- Discord/Telegram (brief drop)
- Notion → Content Brief template
- Templates & Assets channel

**Steps**
1. Receive brief από Content Director / Marketing Manager: caption variants, hooks, vertical mix, posting concepts.
2. Read end-to-end (don''t skim).
3. Cross-check brief vs Account Master voice — does this fit creator''s persona?
4. Cross-check existing Templates & Assets — is there a ready template για αυτό το concept?
5. Compile questions σε ένα single message (do not drip-feed).
6. Sync με filmer (separate ping): tell them what shots/angles needed.
7. Sync με creator (μέσω CSM ή direct group): expectations για το filming.
8. Confirm iCloud folder ready για το shoot output.
9. Identify potential blockers (props, location, outfit).

**Time**
20-30 min review + 15-20 min sync = ~45 min.

**Common mistakes**
- Skim brief, discover gap στο shoot day → wasted shoot.
- Multiple questions drip-fed → annoying + lost.
- No sync με filmer → mismatch between filmed content + posting brief.
- Skip Templates & Assets cross-check → reinvent the wheel.

**Escalation**
- Brief arrives <24h πριν shoot → flag to Marketing Manager (process violation, lobby για better lead time).
- Brief contradicts Master voice → Content Director clarify.
- Filmer unavailable for sync → CSM coordinate.',
  'weekly',
  '2-3 μέρες πριν next filming day',
  18,
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
    WHERE r.id = ANY(f.sop_role) AND f.sort_order = 18
  );

UPDATE public.sop_functions f SET
  name = 'Weekly content brief sync με Marketing Manager / Content Director',
  kpi = 'Briefs received 2-3 μέρες πριν filming, all questions resolved πριν shoot, 0 day-of-shoot brief gaps',
  sop_content = '**Σκοπός**
Weekly sync για να λάβεις content briefs **2-3 μέρες πριν filming day**, να ρωτήσεις διευκρινίσεις, να align με τον filmer. Late briefs = panicked execution + bad content.

**Πότε**
2-3 μέρες πριν κάθε filming day (στο standard creator schedule).

**Tools**
- Discord/Telegram (brief drop)
- Notion → Content Brief template
- Templates & Assets channel

**Steps**
1. Receive brief από Content Director / Marketing Manager: caption variants, hooks, vertical mix, posting concepts.
2. Read end-to-end (don''t skim).
3. Cross-check brief vs Account Master voice — does this fit creator''s persona?
4. Cross-check existing Templates & Assets — is there a ready template για αυτό το concept?
5. Compile questions σε ένα single message (do not drip-feed).
6. Sync με filmer (separate ping): tell them what shots/angles needed.
7. Sync με creator (μέσω CSM ή direct group): expectations για το filming.
8. Confirm iCloud folder ready για το shoot output.
9. Identify potential blockers (props, location, outfit).

**Time**
20-30 min review + 15-20 min sync = ~45 min.

**Common mistakes**
- Skim brief, discover gap στο shoot day → wasted shoot.
- Multiple questions drip-fed → annoying + lost.
- No sync με filmer → mismatch between filmed content + posting brief.
- Skip Templates & Assets cross-check → reinvent the wheel.

**Escalation**
- Brief arrives <24h πριν shoot → flag to Marketing Manager (process violation, lobby για better lead time).
- Brief contradicts Master voice → Content Director clarify.
- Filmer unavailable for sync → CSM coordinate.',
  cadence_type = 'weekly',
  cadence_note = '2-3 μέρες πριν next filming day',
  department = ARRAY['1c6713c4-ffa4-468e-bc2f-bb972cd24182']::uuid[],
  is_active = true,
  updated_at = now()
FROM public.sop_roles r
WHERE r.slug = 'marketing-executive'
  AND r.id = ANY(f.sop_role)
  AND f.sort_order = 18;


INSERT INTO public.sop_functions (
  function_id, name, kpi, standard_type, sop_content, cadence_type, cadence_note,
  sort_order, department, sop_role, is_active, content_version, created_at, updated_at
)
SELECT
  'sop_fn_me_gr_19',
  'Winner identification & report (weekly scan)',
  '100% videos meeting 2.5x threshold reported στο Winner Videos channel σε σωστό format, 0 raw-link reports',
  'text',
  '**Σκοπός**
Identify winning videos (2.5x median views) + report to iCloud Manager σε σωστό format. Winners feed Cloud Manager → Trials pipeline forever.

**Πότε**
Weekly scan (default Παρασκευή) + immediate ping όταν ξεπερνά threshold mid-week.

**Tools**
- IG/TT Insights (views per post last 10 posts)
- Telegram → Gunzo Marketing → Winner Videos section
- Winner report template

**Steps**
1. Per account: pull views για last 10 posts.
2. Calculate median (όχι mean — median πιο reliable).
3. Identify videos με views ≥ 2.5x median.
4. Per winner, post στο Winner Videos section με template:
   ```
   [WIN] | [creator] | [vertical]
   [account handle/link]
   Views: [count] (vs median [X])
   Posted: [date]
   Why we think it won: [1 sentence]
   [video file attached]
   ```
5. iCloud Manager handles από εκεί (downloads + saves σε `/Creator_Name/Winners/`).
6. Log winner στο weekly sheet.

**Time**
30-45 min weekly per creator''s portfolio.

**Common mistakes**
- Use mean αντί median → 1 outlier skews threshold.
- Report raw link χωρίς template → iCloud Manager bounces back.
- Forget το "why we think it won" line → no learning.
- Late report (winner sat για 3 μέρες) → lose memory of why it worked.
- Σκορπίζεις winner reports σε άλλο channel → δεν πιάνει το pipeline.

**Escalation**
- 2 weeks zero winners από έναν creator → flag στο weekly KPI review (vertical fit problem).
- Winner can''t be downloaded (deleted from IG) → ping iCloud Manager + see if backup.',
  'weekly',
  'Μία φορά/εβδομάδα ή as winners hit threshold',
  19,
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
    WHERE r.id = ANY(f.sop_role) AND f.sort_order = 19
  );

UPDATE public.sop_functions f SET
  name = 'Winner identification & report (weekly scan)',
  kpi = '100% videos meeting 2.5x threshold reported στο Winner Videos channel σε σωστό format, 0 raw-link reports',
  sop_content = '**Σκοπός**
Identify winning videos (2.5x median views) + report to iCloud Manager σε σωστό format. Winners feed Cloud Manager → Trials pipeline forever.

**Πότε**
Weekly scan (default Παρασκευή) + immediate ping όταν ξεπερνά threshold mid-week.

**Tools**
- IG/TT Insights (views per post last 10 posts)
- Telegram → Gunzo Marketing → Winner Videos section
- Winner report template

**Steps**
1. Per account: pull views για last 10 posts.
2. Calculate median (όχι mean — median πιο reliable).
3. Identify videos με views ≥ 2.5x median.
4. Per winner, post στο Winner Videos section με template:
   ```
   [WIN] | [creator] | [vertical]
   [account handle/link]
   Views: [count] (vs median [X])
   Posted: [date]
   Why we think it won: [1 sentence]
   [video file attached]
   ```
5. iCloud Manager handles από εκεί (downloads + saves σε `/Creator_Name/Winners/`).
6. Log winner στο weekly sheet.

**Time**
30-45 min weekly per creator''s portfolio.

**Common mistakes**
- Use mean αντί median → 1 outlier skews threshold.
- Report raw link χωρίς template → iCloud Manager bounces back.
- Forget το "why we think it won" line → no learning.
- Late report (winner sat για 3 μέρες) → lose memory of why it worked.
- Σκορπίζεις winner reports σε άλλο channel → δεν πιάνει το pipeline.

**Escalation**
- 2 weeks zero winners από έναν creator → flag στο weekly KPI review (vertical fit problem).
- Winner can''t be downloaded (deleted from IG) → ping iCloud Manager + see if backup.',
  cadence_type = 'weekly',
  cadence_note = 'Μία φορά/εβδομάδα ή as winners hit threshold',
  department = ARRAY['1c6713c4-ffa4-468e-bc2f-bb972cd24182']::uuid[],
  is_active = true,
  updated_at = now()
FROM public.sop_roles r
WHERE r.slug = 'marketing-executive'
  AND r.id = ANY(f.sop_role)
  AND f.sort_order = 19;


INSERT INTO public.sop_functions (
  function_id, name, kpi, standard_type, sop_content, cadence_type, cadence_note,
  sort_order, department, sop_role, is_active, content_version, created_at, updated_at
)
SELECT
  'sop_fn_me_gr_20',
  'Variant repurposing batch (από Trials folder)',
  '100% trial variants edited unique per session, 0 duplicate-content flags, batch ready πριν next day''s posting',
  'text',
  '**Σκοπός**
Batch-process Trial Reel variants από iCloud Manager → make each unique per upload (cut, brightness, overlay) → ready για posting. Same source = forever pipeline.

**Πότε**
Όταν iCloud Manager notify-άρει ότι Trial subfolder updated (typical: εβδομαδιαία ή 2x/week).

**Tools**
- iCloud → `Model → Content to Upload → Video To Upload → … → Trial`
- CapCut (work device)
- iPhone Photos app

**Steps**
1. Open `Model → Content to Upload → Video To Upload → … → Trial` → identify videos για επόμενη εβδομάδα.
2. Per video:
   - Download στο device (Photos app).
   - Open CapCut (όχι IG draft duplicate — never).
   - **Trim:** cut 0.1 sec από το τέλος (ή 1 sec start/end).
   - **Brightness:** +5 to +10 (subtle).
   - **Overlay:** Text → type creator''s username → shrink as small as possible → opacity 0% → drag to corner (invisible to viewer, changes fingerprint).
   - Export.
3. Save as **new file** — never overwrite original.
4. Delete original downloaded copy από device (keep iCloud master intact).
5. Variant labeled ready στο daily sheet.

**Rules**
- Max 2 settings per session (brightness + overlay, OR cut + brightness — όχι all 3 dramatic).
- Never same settings 2 φορές στο ίδιο video.
- Always cut min 1 sec (platform may flag duplicate otherwise).
- Source πάντα Trials, NEVER directly από Winners.

**Time**
3-5 min per video, batch 10-15 videos = ~45-75 min weekly.

**Common mistakes**
- Skip edit, post raw → instant duplicate-content downrank.
- Over-edit (5 settings, dramatic changes) → visible quality drop.
- Overwrite original → lose master copy.
- Pull από Winners folder direct → corrupts the master library.

**Escalation**
- Trial subfolder empty/missing → iCloud Manager.
- Same video flagged "similar content" after edit → escalate variant rotation, Marketing Manager input.',
  'weekly',
  'Όταν iCloud Manager updates Trials folder',
  20,
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
    WHERE r.id = ANY(f.sop_role) AND f.sort_order = 20
  );

UPDATE public.sop_functions f SET
  name = 'Variant repurposing batch (από Trials folder)',
  kpi = '100% trial variants edited unique per session, 0 duplicate-content flags, batch ready πριν next day''s posting',
  sop_content = '**Σκοπός**
Batch-process Trial Reel variants από iCloud Manager → make each unique per upload (cut, brightness, overlay) → ready για posting. Same source = forever pipeline.

**Πότε**
Όταν iCloud Manager notify-άρει ότι Trial subfolder updated (typical: εβδομαδιαία ή 2x/week).

**Tools**
- iCloud → `Model → Content to Upload → Video To Upload → … → Trial`
- CapCut (work device)
- iPhone Photos app

**Steps**
1. Open `Model → Content to Upload → Video To Upload → … → Trial` → identify videos για επόμενη εβδομάδα.
2. Per video:
   - Download στο device (Photos app).
   - Open CapCut (όχι IG draft duplicate — never).
   - **Trim:** cut 0.1 sec από το τέλος (ή 1 sec start/end).
   - **Brightness:** +5 to +10 (subtle).
   - **Overlay:** Text → type creator''s username → shrink as small as possible → opacity 0% → drag to corner (invisible to viewer, changes fingerprint).
   - Export.
3. Save as **new file** — never overwrite original.
4. Delete original downloaded copy από device (keep iCloud master intact).
5. Variant labeled ready στο daily sheet.

**Rules**
- Max 2 settings per session (brightness + overlay, OR cut + brightness — όχι all 3 dramatic).
- Never same settings 2 φορές στο ίδιο video.
- Always cut min 1 sec (platform may flag duplicate otherwise).
- Source πάντα Trials, NEVER directly από Winners.

**Time**
3-5 min per video, batch 10-15 videos = ~45-75 min weekly.

**Common mistakes**
- Skip edit, post raw → instant duplicate-content downrank.
- Over-edit (5 settings, dramatic changes) → visible quality drop.
- Overwrite original → lose master copy.
- Pull από Winners folder direct → corrupts the master library.

**Escalation**
- Trial subfolder empty/missing → iCloud Manager.
- Same video flagged "similar content" after edit → escalate variant rotation, Marketing Manager input.',
  cadence_type = 'weekly',
  cadence_note = 'Όταν iCloud Manager updates Trials folder',
  department = ARRAY['1c6713c4-ffa4-468e-bc2f-bb972cd24182']::uuid[],
  is_active = true,
  updated_at = now()
FROM public.sop_roles r
WHERE r.slug = 'marketing-executive'
  AND r.id = ANY(f.sop_role)
  AND f.sort_order = 20;


