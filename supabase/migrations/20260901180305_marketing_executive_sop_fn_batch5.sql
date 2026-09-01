-- marketing_executive SOP functions batch 5

INSERT INTO public.sop_functions (
  function_id, name, kpi, standard_type, sop_content, cadence_type, cadence_note,
  sort_order, department, sop_role, is_active, content_version, created_at, updated_at
)
SELECT
  'sop_fn_me_gr_21',
  'Weekly retro + next-week posting plan',
  '100% Friday retros completed, next-week posting plan documented before EOW, all blocks flagged',
  'text',
  '**Σκοπός**
Personal weekly retro — what worked, what didn''t, what''s blocked. Plan next week''s posting cadence per creator. Submit blockers στο Management Team.

**Πότε**
Παρασκευή afternoon, πριν EOW.

**Tools**
- Daily posting log sheet (last 7 days)
- Weekly KPI dashboard (από Marketing Manager Monday meeting)
- Notion → personal retro template
- Discord/Telegram (Daily Reports + Questions channels)

**Steps**
1. Pull last 7 ημέρες daily logs.
2. Aggregate per creator:
   - Total posts (Main + Alt + Trials per platform)
   - Best-performing post (highest views) — note format
   - Worst-performing post — note format
   - Engagement / DM funnel approximate count
3. Self-review: τι έκανα διαφορετικά αυτή την εβδομάδα και δούλεψε / δεν δούλεψε.
4. Identify blockers που πρέπει να λυθούν πριν Δευτέρα: missing briefs, broken assets, account issues, equipment.
5. Plan next week:
   - Posting cadence per creator
   - Trials pipeline (how many ready από Cloud Manager)
   - Filming days alignment με Content Director
   - Highlight maintenance scheduled
6. Post retro summary στο Daily Reports channel (short, 200-300 words).
7. Flag blockers separately στο Questions channel αν need answer.

**Time**
30-45 min.

**Common mistakes**
- Skip retro "δεν είχα ιδιαίτερη εβδομάδα" — exactly when retro reveals patterns.
- Don''t aggregate data → vibes, not signal.
- Identify blockers but δεν τα flag → next Monday same problem.
- Mix retro με Questions channel → noise.

**Escalation**
- Same blocker 2 εβδομάδες σε σειρά → loop in Marketing Manager directly.
- Burnout signals (skipped posts, missed shots, declining quality) → flag to CSM + Marketing Manager.',
  'weekly',
  'Παρασκευή afternoon',
  21,
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
    WHERE r.id = ANY(f.sop_role) AND f.sort_order = 21
  );

UPDATE public.sop_functions f SET
  name = 'Weekly retro + next-week posting plan',
  kpi = '100% Friday retros completed, next-week posting plan documented before EOW, all blocks flagged',
  sop_content = '**Σκοπός**
Personal weekly retro — what worked, what didn''t, what''s blocked. Plan next week''s posting cadence per creator. Submit blockers στο Management Team.

**Πότε**
Παρασκευή afternoon, πριν EOW.

**Tools**
- Daily posting log sheet (last 7 days)
- Weekly KPI dashboard (από Marketing Manager Monday meeting)
- Notion → personal retro template
- Discord/Telegram (Daily Reports + Questions channels)

**Steps**
1. Pull last 7 ημέρες daily logs.
2. Aggregate per creator:
   - Total posts (Main + Alt + Trials per platform)
   - Best-performing post (highest views) — note format
   - Worst-performing post — note format
   - Engagement / DM funnel approximate count
3. Self-review: τι έκανα διαφορετικά αυτή την εβδομάδα και δούλεψε / δεν δούλεψε.
4. Identify blockers που πρέπει να λυθούν πριν Δευτέρα: missing briefs, broken assets, account issues, equipment.
5. Plan next week:
   - Posting cadence per creator
   - Trials pipeline (how many ready από Cloud Manager)
   - Filming days alignment με Content Director
   - Highlight maintenance scheduled
6. Post retro summary στο Daily Reports channel (short, 200-300 words).
7. Flag blockers separately στο Questions channel αν need answer.

**Time**
30-45 min.

**Common mistakes**
- Skip retro "δεν είχα ιδιαίτερη εβδομάδα" — exactly when retro reveals patterns.
- Don''t aggregate data → vibes, not signal.
- Identify blockers but δεν τα flag → next Monday same problem.
- Mix retro με Questions channel → noise.

**Escalation**
- Same blocker 2 εβδομάδες σε σειρά → loop in Marketing Manager directly.
- Burnout signals (skipped posts, missed shots, declining quality) → flag to CSM + Marketing Manager.',
  cadence_type = 'weekly',
  cadence_note = 'Παρασκευή afternoon',
  department = ARRAY['1c6713c4-ffa4-468e-bc2f-bb972cd24182']::uuid[],
  is_active = true,
  updated_at = now()
FROM public.sop_roles r
WHERE r.slug = 'marketing-executive'
  AND r.id = ANY(f.sop_role)
  AND f.sort_order = 21;


INSERT INTO public.sop_functions (
  function_id, name, kpi, standard_type, sop_content, cadence_type, cadence_note,
  sort_order, department, sop_role, is_active, content_version, created_at, updated_at
)
SELECT
  'sop_fn_me_gr_22',
  'Monthly account performance retro (per creator)',
  '100% creators retro''d εντός 1ης εβδομάδας μήνα, archived doc per creator, next-month plan documented',
  'text',
  '**Σκοπός**
Monthly deep retro per creator — total follower growth, content vertical performance, posting cadence efficiency, KPI trend. Output: next-month adjustment plan.

**Πότε**
1η εβδομάδα κάθε μήνα.

**Tools**
- IG/TT/FB Insights (last 30 days)
- Infloww (sub funnel)
- Weekly KPI dashboards (4 weekly snapshots)
- Notion → Monthly Retro template per creator
- Account Master Reference

**Steps**
1. Per creator, pull last 30 days data:
   - Net follower growth (absolute + %)
   - Total posts (Main + Alt + Trials per platform)
   - Top 5 posts by views (note vertical + format)
   - Bottom 5 posts (note vertical + format)
   - 8 KPIs trend (week 1 → week 4)
   - DM funnel total + conversion rate
2. Identify:
   - Which vertical worked? Which died?
   - Cadence sustainable or burning out?
   - Account Master drift (anything changed που δεν planned)?
   - Equipment / device issues compounding?
3. Cross-reference με Content Director''s vertical scorecard (από Vertical Testing SOP).
4. Document next-month plan:
   - Adjust vertical mix
   - Adjust cadence (more/less)
   - New experiments (hooks, formats, posting times)
   - Highlight refresh schedule
5. Submit retro to Marketing Manager + Head of Marketing για review.
6. Archive το retro στο Notion creator page.

**Time**
1.5-2 ώρες per creator (full month).

**Common mistakes**
- Skim Insights → miss the trend.
- Don''t compare με previous month → no progress baseline.
- Identify problems χωρίς proposed fixes → useless retro.
- Skip archive → lose institutional memory.
- Same retro template για όλους creators χωρίς customization.

**Escalation**
- 2 consecutive months declining → loop in Head of Marketing + CSM (creator-side issue?).
- Suspected device contamination (mass anomalies) → Head of Account Defense.',
  'monthly',
  '1η εβδομάδα μήνα',
  22,
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
    WHERE r.id = ANY(f.sop_role) AND f.sort_order = 22
  );

UPDATE public.sop_functions f SET
  name = 'Monthly account performance retro (per creator)',
  kpi = '100% creators retro''d εντός 1ης εβδομάδας μήνα, archived doc per creator, next-month plan documented',
  sop_content = '**Σκοπός**
Monthly deep retro per creator — total follower growth, content vertical performance, posting cadence efficiency, KPI trend. Output: next-month adjustment plan.

**Πότε**
1η εβδομάδα κάθε μήνα.

**Tools**
- IG/TT/FB Insights (last 30 days)
- Infloww (sub funnel)
- Weekly KPI dashboards (4 weekly snapshots)
- Notion → Monthly Retro template per creator
- Account Master Reference

**Steps**
1. Per creator, pull last 30 days data:
   - Net follower growth (absolute + %)
   - Total posts (Main + Alt + Trials per platform)
   - Top 5 posts by views (note vertical + format)
   - Bottom 5 posts (note vertical + format)
   - 8 KPIs trend (week 1 → week 4)
   - DM funnel total + conversion rate
2. Identify:
   - Which vertical worked? Which died?
   - Cadence sustainable or burning out?
   - Account Master drift (anything changed που δεν planned)?
   - Equipment / device issues compounding?
3. Cross-reference με Content Director''s vertical scorecard (από Vertical Testing SOP).
4. Document next-month plan:
   - Adjust vertical mix
   - Adjust cadence (more/less)
   - New experiments (hooks, formats, posting times)
   - Highlight refresh schedule
5. Submit retro to Marketing Manager + Head of Marketing για review.
6. Archive το retro στο Notion creator page.

**Time**
1.5-2 ώρες per creator (full month).

**Common mistakes**
- Skim Insights → miss the trend.
- Don''t compare με previous month → no progress baseline.
- Identify problems χωρίς proposed fixes → useless retro.
- Skip archive → lose institutional memory.
- Same retro template για όλους creators χωρίς customization.

**Escalation**
- 2 consecutive months declining → loop in Head of Marketing + CSM (creator-side issue?).
- Suspected device contamination (mass anomalies) → Head of Account Defense.',
  cadence_type = 'monthly',
  cadence_note = '1η εβδομάδα μήνα',
  department = ARRAY['1c6713c4-ffa4-468e-bc2f-bb972cd24182']::uuid[],
  is_active = true,
  updated_at = now()
FROM public.sop_roles r
WHERE r.slug = 'marketing-executive'
  AND r.id = ANY(f.sop_role)
  AND f.sort_order = 22;


INSERT INTO public.sop_functions (
  function_id, name, kpi, standard_type, sop_content, cadence_type, cadence_note,
  sort_order, department, sop_role, is_active, content_version, created_at, updated_at
)
SELECT
  'sop_fn_me_gr_23',
  'Monthly safety audit (device + account hygiene)',
  '0 unauthorized Account Center connections, 0 banned-hashtag usage, 100% device-creator mapping verified',
  'text',
  '**Σκοπός**
Monthly anti-ban audit — verify device hygiene, Account Center clean, no banned hashtags drift, no Wi-Fi incidents, password manager integrity. Catch silent drift πριν explode σε ban.

**Πότε**
End of each month.

**Tools**
- All work devices (assigned)
- Meta Account Center (per IG/FB)
- Password manager
- Account-device mapping sheet (από Head of Account Defense)

**Steps**
1. Per device:
   - Verify iCloud Backup + Find My **disabled**.
   - Verify Wi-Fi has never been activated (check logs αν possible).
   - Verify dedicated Apple ID + Gmail, όχι personal.
   - Verify physical SIM inserted, no eSIM.
   - Check device storage — does it have iCloud master copies intact?
2. Per account:
   - Account Center → check for unauthorized cross-platform links.
   - Settings → Account Status → confirm GREEN across all sections.
   - Bio + PFP match Master Reference (no drift).
   - Pinned posts match strategy.
3. Hashtag library check:
   - Pull last month''s hashtag usage.
   - Cross-reference με banned list.
   - Verify rotation (no same set on >4 posts).
4. Password manager:
   - Verify all credentials present + correct.
   - Verify recovery email/phone correct.
5. Document audit στο monthly safety log.
6. Flag any issues στο Head of Account Defense same-day.

**Time**
1-1.5 ώρες total για full portfolio.

**Common mistakes**
- "Όλα φαίνονται OK" → skim, miss the orange flag buried στο Account Status sub-page.
- Skip Account Center → unauthorized link sneaked in 3 weeks ago.
- Forget banned hashtag check → 1 banned hashtag = 30% reach hit.
- Don''t document → can''t show pattern in monthly review.

**Escalation**
- ANY unauthorized Account Center link → Head of Account Defense + Marketing Manager IMMEDIATELY.
- iCloud Backup found enabled → factory reset path (with Marketing Manager approval).
- Banned hashtag found used → archive το post + replace strategy.',
  'monthly',
  'End-month, anti-ban discipline check',
  23,
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
    WHERE r.id = ANY(f.sop_role) AND f.sort_order = 23
  );

UPDATE public.sop_functions f SET
  name = 'Monthly safety audit (device + account hygiene)',
  kpi = '0 unauthorized Account Center connections, 0 banned-hashtag usage, 100% device-creator mapping verified',
  sop_content = '**Σκοπός**
Monthly anti-ban audit — verify device hygiene, Account Center clean, no banned hashtags drift, no Wi-Fi incidents, password manager integrity. Catch silent drift πριν explode σε ban.

**Πότε**
End of each month.

**Tools**
- All work devices (assigned)
- Meta Account Center (per IG/FB)
- Password manager
- Account-device mapping sheet (από Head of Account Defense)

**Steps**
1. Per device:
   - Verify iCloud Backup + Find My **disabled**.
   - Verify Wi-Fi has never been activated (check logs αν possible).
   - Verify dedicated Apple ID + Gmail, όχι personal.
   - Verify physical SIM inserted, no eSIM.
   - Check device storage — does it have iCloud master copies intact?
2. Per account:
   - Account Center → check for unauthorized cross-platform links.
   - Settings → Account Status → confirm GREEN across all sections.
   - Bio + PFP match Master Reference (no drift).
   - Pinned posts match strategy.
3. Hashtag library check:
   - Pull last month''s hashtag usage.
   - Cross-reference με banned list.
   - Verify rotation (no same set on >4 posts).
4. Password manager:
   - Verify all credentials present + correct.
   - Verify recovery email/phone correct.
5. Document audit στο monthly safety log.
6. Flag any issues στο Head of Account Defense same-day.

**Time**
1-1.5 ώρες total για full portfolio.

**Common mistakes**
- "Όλα φαίνονται OK" → skim, miss the orange flag buried στο Account Status sub-page.
- Skip Account Center → unauthorized link sneaked in 3 weeks ago.
- Forget banned hashtag check → 1 banned hashtag = 30% reach hit.
- Don''t document → can''t show pattern in monthly review.

**Escalation**
- ANY unauthorized Account Center link → Head of Account Defense + Marketing Manager IMMEDIATELY.
- iCloud Backup found enabled → factory reset path (with Marketing Manager approval).
- Banned hashtag found used → archive το post + replace strategy.',
  cadence_type = 'monthly',
  cadence_note = 'End-month, anti-ban discipline check',
  department = ARRAY['1c6713c4-ffa4-468e-bc2f-bb972cd24182']::uuid[],
  is_active = true,
  updated_at = now()
FROM public.sop_roles r
WHERE r.slug = 'marketing-executive'
  AND r.id = ANY(f.sop_role)
  AND f.sort_order = 23;


INSERT INTO public.sop_functions (
  function_id, name, kpi, standard_type, sop_content, cadence_type, cadence_note,
  sort_order, department, sop_role, is_active, content_version, created_at, updated_at
)
SELECT
  'sop_fn_me_gr_24',
  'New IG/TikTok account setup (Day 1)',
  '100% Day 1 setup complete πριν handoff, credentials logged same-minute, 0 Wi-Fi violations',
  'text',
  '**[PER EVENT — δεν υπάρχει Per-event cadence στο dropdown, χρησιμοποιείται Daily ως placeholder. Trigger: Head of Account Defense assigns νέο handle για warm-up]**

**Σκοπός**

**Πότε**
Per signing νέου creator ή expansion στο portfolio του existing creator.

**Tools**
- New work device (farm-controlled)
- Fresh email (Gmail/Yahoo για IG, Gmail/Outlook για TT)
- Password manager
- Account Master Reference

**Steps (IG)**
2. Create fresh Gmail/Yahoo — never reuse, mobile data only.
3. Subscribe new email σε 2-3 newsletters → 30 min email warm-up.
4. Confirm subscription links από inside the new inbox.
5. Open IG → Create new account → set username + password per Master template.
6. Verify via dedicated email.
7. Do NOT add link in bio, do NOT post anything yet.
8. Add profile picture approved by IG Manager.
9. Bio: `19 | FL` or `19 | FL | fitness` (per Master).
10. Save credentials στο password manager — never plain text.
11. Leave account idle 24h.
12. Hand off στο Growth Playbook (Phase 2 — Warm-Up).

**Steps (TikTok)**
1. Create fresh Gmail/Outlook email (mobile data).
2. TikTok → Sign Up → Email → register.
3. Username + display name per Master template.
4. Profile pic + bio (από Content Director brief).
5. **Log credentials σε Google Sheet same-minute** — email, email password, TT username, TT password (must differ), date created, recovery info.
6. **Day 1 = warm-up only, NO posts.** 20-30 min FYP scroll, niche likes, 3-5 comments.

**Hard rules**
- Never reuse email.
- Never set TT password = email password.
- Never log into personal Apple ID/iCloud on work device.
- Never skip credentials logging — unlogged account = lost account.

**Time**
~2 ώρες spread over Day 1 (creation + warm-up + setup checks).

**Common mistakes**
- Reuse phone across creators → cross-contamination → mass-ban.
- Link in bio Day 1 → algorithm flags promotional intent.
- Wi-Fi στο οποιοδήποτε step.
- Batch-upload grid photos Day 1 → looks fake.
- Skip credentials log.

**Escalation**
- Gmail blocks creation (phone number required) → try Android → laptop fallback → Yahoo. Wait 24h ή ask teammate.
- IG/TT requires phone verification → escalate Head of Account Defense (may need separate SIM).',
  'daily',
  'PER EVENT — όταν Head of Account Defense assigns νέο handle',
  24,
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
    WHERE r.id = ANY(f.sop_role) AND f.sort_order = 24
  );

UPDATE public.sop_functions f SET
  name = 'New IG/TikTok account setup (Day 1)',
  kpi = '100% Day 1 setup complete πριν handoff, credentials logged same-minute, 0 Wi-Fi violations',
  sop_content = '**[PER EVENT — δεν υπάρχει Per-event cadence στο dropdown, χρησιμοποιείται Daily ως placeholder. Trigger: Head of Account Defense assigns νέο handle για warm-up]**

**Σκοπός**

**Πότε**
Per signing νέου creator ή expansion στο portfolio του existing creator.

**Tools**
- New work device (farm-controlled)
- Fresh email (Gmail/Yahoo για IG, Gmail/Outlook για TT)
- Password manager
- Account Master Reference

**Steps (IG)**
2. Create fresh Gmail/Yahoo — never reuse, mobile data only.
3. Subscribe new email σε 2-3 newsletters → 30 min email warm-up.
4. Confirm subscription links από inside the new inbox.
5. Open IG → Create new account → set username + password per Master template.
6. Verify via dedicated email.
7. Do NOT add link in bio, do NOT post anything yet.
8. Add profile picture approved by IG Manager.
9. Bio: `19 | FL` or `19 | FL | fitness` (per Master).
10. Save credentials στο password manager — never plain text.
11. Leave account idle 24h.
12. Hand off στο Growth Playbook (Phase 2 — Warm-Up).

**Steps (TikTok)**
1. Create fresh Gmail/Outlook email (mobile data).
2. TikTok → Sign Up → Email → register.
3. Username + display name per Master template.
4. Profile pic + bio (από Content Director brief).
5. **Log credentials σε Google Sheet same-minute** — email, email password, TT username, TT password (must differ), date created, recovery info.
6. **Day 1 = warm-up only, NO posts.** 20-30 min FYP scroll, niche likes, 3-5 comments.

**Hard rules**
- Never reuse email.
- Never set TT password = email password.
- Never log into personal Apple ID/iCloud on work device.
- Never skip credentials logging — unlogged account = lost account.

**Time**
~2 ώρες spread over Day 1 (creation + warm-up + setup checks).

**Common mistakes**
- Reuse phone across creators → cross-contamination → mass-ban.
- Link in bio Day 1 → algorithm flags promotional intent.
- Wi-Fi στο οποιοδήποτε step.
- Batch-upload grid photos Day 1 → looks fake.
- Skip credentials log.

**Escalation**
- Gmail blocks creation (phone number required) → try Android → laptop fallback → Yahoo. Wait 24h ή ask teammate.
- IG/TT requires phone verification → escalate Head of Account Defense (may need separate SIM).',
  cadence_type = 'daily',
  cadence_note = 'PER EVENT — όταν Head of Account Defense assigns νέο handle',
  department = ARRAY['1c6713c4-ffa4-468e-bc2f-bb972cd24182']::uuid[],
  is_active = true,
  updated_at = now()
FROM public.sop_roles r
WHERE r.slug = 'marketing-executive'
  AND r.id = ANY(f.sop_role)
  AND f.sort_order = 24;


INSERT INTO public.sop_functions (
  function_id, name, kpi, standard_type, sop_content, cadence_type, cadence_note,
  sort_order, department, sop_role, is_active, content_version, created_at, updated_at
)
SELECT
  'sop_fn_me_gr_25',
  'Account warm-up ramp (Days 1-3 new account)',
  '100% 3-day warm-up completed πριν Phase 3 content go-live, 0 premature posting incidents, 0 follows/DMs during warm-up',
  'text',
  '**[PER EVENT — δεν υπάρχει Per-event cadence στο dropdown, χρησιμοποιείται Daily ως placeholder. Trigger: Day 1 setup complete σε νέο account]**

**Σκοπός**
3-day algorithmic warm-up πριν account γίνει active. Trains το algorithm να αναγνωρίσει το account ως real human user στη niche.

**Πότε**
Days 1-3 αμέσως μετά Account Setup completion.

**Tools**
- IG/TT app
- Niche shortlist

**Daily warm-up actions (όλες 3 ημέρες)**
- **Likes:** max 15/day, ≥5 sec gap, niche-relevant only.
- **Watch full:** every Reel watched to completion 1-2 φορές. No mid-video exits.
- **Comments:** 1 comment ή save κάθε 3-4 videos.
- **Saves:** few posts/day — strongest quality signal.
- **Timing:** min 5 sec between any 2 actions.

**Hard limits during warm-up**
- No follows.
- No DMs.
- No posts.
- No link in bio.

**Day-by-day build (IG)**
- **Day 1:** profile pic + bio set. Warm-up actions only.
- **Day 2:** add 1-2 grid photos (spread across day, never batch). Follow 5-15 niche accounts EOD.
- **Day 3:** add first Reel + 1 more photo.
- **Day 4+:** Daily Routine begins.

**Steps**
1. Daily, run the warm-up actions list above per account.
4. End of Day 3 → confirm: 6+ photos plotted, bio set, 1 Reel live, no flags.
5. Hand off στο Daily Routine SOP.

**Time**
30-45 min/day × 3 days = ~2 ώρες spread.

**Common mistakes**
- Post Day 1 ή Day 2 → algorithm flags as bot, shadowban inevitable.
- Batch all grid photos Day 1 → fake-account flag.
- Follow Day 1 → flagged for "aggressive growth", account locked.
- Skip warm-up "no time" → guarantee shadowban inside week 1.
- Link in bio Day 1-7 → promotional intent flag.

**Escalation**
- Action block popup during warm-up → STOP, screenshot, Marketing Manager.
- Account asks για phone re-verification → Head of Account Defense.',
  'daily',
  'PER EVENT — αμέσως μετά Day 1 setup ενός νέου account',
  25,
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
    WHERE r.id = ANY(f.sop_role) AND f.sort_order = 25
  );

UPDATE public.sop_functions f SET
  name = 'Account warm-up ramp (Days 1-3 new account)',
  kpi = '100% 3-day warm-up completed πριν Phase 3 content go-live, 0 premature posting incidents, 0 follows/DMs during warm-up',
  sop_content = '**[PER EVENT — δεν υπάρχει Per-event cadence στο dropdown, χρησιμοποιείται Daily ως placeholder. Trigger: Day 1 setup complete σε νέο account]**

**Σκοπός**
3-day algorithmic warm-up πριν account γίνει active. Trains το algorithm να αναγνωρίσει το account ως real human user στη niche.

**Πότε**
Days 1-3 αμέσως μετά Account Setup completion.

**Tools**
- IG/TT app
- Niche shortlist

**Daily warm-up actions (όλες 3 ημέρες)**
- **Likes:** max 15/day, ≥5 sec gap, niche-relevant only.
- **Watch full:** every Reel watched to completion 1-2 φορές. No mid-video exits.
- **Comments:** 1 comment ή save κάθε 3-4 videos.
- **Saves:** few posts/day — strongest quality signal.
- **Timing:** min 5 sec between any 2 actions.

**Hard limits during warm-up**
- No follows.
- No DMs.
- No posts.
- No link in bio.

**Day-by-day build (IG)**
- **Day 1:** profile pic + bio set. Warm-up actions only.
- **Day 2:** add 1-2 grid photos (spread across day, never batch). Follow 5-15 niche accounts EOD.
- **Day 3:** add first Reel + 1 more photo.
- **Day 4+:** Daily Routine begins.

**Steps**
1. Daily, run the warm-up actions list above per account.
4. End of Day 3 → confirm: 6+ photos plotted, bio set, 1 Reel live, no flags.
5. Hand off στο Daily Routine SOP.

**Time**
30-45 min/day × 3 days = ~2 ώρες spread.

**Common mistakes**
- Post Day 1 ή Day 2 → algorithm flags as bot, shadowban inevitable.
- Batch all grid photos Day 1 → fake-account flag.
- Follow Day 1 → flagged for "aggressive growth", account locked.
- Skip warm-up "no time" → guarantee shadowban inside week 1.
- Link in bio Day 1-7 → promotional intent flag.

**Escalation**
- Action block popup during warm-up → STOP, screenshot, Marketing Manager.
- Account asks για phone re-verification → Head of Account Defense.',
  cadence_type = 'daily',
  cadence_note = 'PER EVENT — αμέσως μετά Day 1 setup ενός νέου account',
  department = ARRAY['1c6713c4-ffa4-468e-bc2f-bb972cd24182']::uuid[],
  is_active = true,
  updated_at = now()
FROM public.sop_roles r
WHERE r.slug = 'marketing-executive'
  AND r.id = ANY(f.sop_role)
  AND f.sort_order = 25;


