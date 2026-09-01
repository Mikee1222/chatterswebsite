-- marketing_executive SOP functions batch 6

INSERT INTO public.sop_functions (
  function_id, name, kpi, standard_type, sop_content, cadence_type, cadence_note,
  sort_order, department, sop_role, is_active, content_version, created_at, updated_at
)
SELECT
  'sop_fn_me_gr_26',
  'Trial Reels launch (per new variant batch)',
  '100% Trials posted με toggle ON, 0 grid contamination, post verified σε Trials section <60s, log filled',
  'text',
  '*PER EVENT — δεν υπάρχει Per-event cadence στο dropdown, χρησιμοποιείται Daily ως placeholder. Trigger: iCloud Manager updates Trial subfolder + variant edited per Repurpose SOP]**

**Σκοπός**
Post a Trial Reel — IG feature που δείχνει reel μόνο σε non-followers, never στο grid, fully reusable. Gunzo''s core cold-traffic scaling weapon.

**Πότε**
Per available variant from Cloud Manager. Daily cadence depends on account tier:
- New (<30d): 1-3/day
- Aged (30+d): 5-20/day
- Warmed (90+d): 20-50/day
- Power Pages (200+d): 50-100+/day

**Tools**
- iCloud → `Model → Content to Upload → Video To Upload → … → Trial`
- IG app (Professional account με Trial Reels enabled)
- Account tracker (tier info)

**Prerequisites (one-time per account)**
1. IG → Professional Dashboard → Tools → toggle "Trial Reels" ON.
2. Confirm via notification.
3. Log enablement στο account tracker (date + VA).

**Posting a Trial Reel**
1. Pull approved variant από `/Trials/`.
2. IG → New Reel → select video.
3. Apply creator-specific caption (από Templates & Assets).
4. Add cover image (matches Master grid aesthetic).
5. **Toggle "Trial" ON before posting — critical step.**
6. Post.
7. Wait 60s → verify: reel appears στο "Trials" section, NOT στο grid.
8. Screenshot to posting log.
9. Monitor first-hour views για anomalies.
10. Move variant στο `Grid (posted) subfolder` per Winners Vault SOP.

**Common issues & fixes**
- Reel appeared στο grid → toggle was OFF → delete + repost με toggle ON.
- "Trial" option missing → account not eligible → switch to Professional, wait 7 days.
- 0 views >1h → possible shadowban ή rate violation → pause 24h, halve daily limit.
- Variant flagged "similar content" → rotate to different variant type.

**Time**
5-8 min per Trial post.

**Common mistakes**
- Toggle OFF accidentally → reel goes στο grid → pollutes profile aesthetic.
- Use winners as regular (non-Trial) reels → defeats reusability edge.
- No 60s verification → mistakes propagate.
- Batch-dump 10 Trials in 30 min → spam flag.
- Delete variants μετά posting → lose audit trail + cross-account reuse.

**Escalation**
- Trial reaches followers by mistake → screenshot + Marketing Manager + delete.
- Account loses Trial feature mid-week → Marketing Manager (possible eligibility revocation).
- Variant flagged 3x straight → escalate to Content Director (variant needs deeper remix).',
  'daily',
  'PER EVENT — όταν Trial Reel variant ready από Cloud Manager batch',
  26,
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
    WHERE r.id = ANY(f.sop_role) AND f.sort_order = 26
  );

UPDATE public.sop_functions f SET
  name = 'Trial Reels launch (per new variant batch)',
  kpi = '100% Trials posted με toggle ON, 0 grid contamination, post verified σε Trials section <60s, log filled',
  sop_content = '*PER EVENT — δεν υπάρχει Per-event cadence στο dropdown, χρησιμοποιείται Daily ως placeholder. Trigger: iCloud Manager updates Trial subfolder + variant edited per Repurpose SOP]**

**Σκοπός**
Post a Trial Reel — IG feature που δείχνει reel μόνο σε non-followers, never στο grid, fully reusable. Gunzo''s core cold-traffic scaling weapon.

**Πότε**
Per available variant from Cloud Manager. Daily cadence depends on account tier:
- New (<30d): 1-3/day
- Aged (30+d): 5-20/day
- Warmed (90+d): 20-50/day
- Power Pages (200+d): 50-100+/day

**Tools**
- iCloud → `Model → Content to Upload → Video To Upload → … → Trial`
- IG app (Professional account με Trial Reels enabled)
- Account tracker (tier info)

**Prerequisites (one-time per account)**
1. IG → Professional Dashboard → Tools → toggle "Trial Reels" ON.
2. Confirm via notification.
3. Log enablement στο account tracker (date + VA).

**Posting a Trial Reel**
1. Pull approved variant από `/Trials/`.
2. IG → New Reel → select video.
3. Apply creator-specific caption (από Templates & Assets).
4. Add cover image (matches Master grid aesthetic).
5. **Toggle "Trial" ON before posting — critical step.**
6. Post.
7. Wait 60s → verify: reel appears στο "Trials" section, NOT στο grid.
8. Screenshot to posting log.
9. Monitor first-hour views για anomalies.
10. Move variant στο `Grid (posted) subfolder` per Winners Vault SOP.

**Common issues & fixes**
- Reel appeared στο grid → toggle was OFF → delete + repost με toggle ON.
- "Trial" option missing → account not eligible → switch to Professional, wait 7 days.
- 0 views >1h → possible shadowban ή rate violation → pause 24h, halve daily limit.
- Variant flagged "similar content" → rotate to different variant type.

**Time**
5-8 min per Trial post.

**Common mistakes**
- Toggle OFF accidentally → reel goes στο grid → pollutes profile aesthetic.
- Use winners as regular (non-Trial) reels → defeats reusability edge.
- No 60s verification → mistakes propagate.
- Batch-dump 10 Trials in 30 min → spam flag.
- Delete variants μετά posting → lose audit trail + cross-account reuse.

**Escalation**
- Trial reaches followers by mistake → screenshot + Marketing Manager + delete.
- Account loses Trial feature mid-week → Marketing Manager (possible eligibility revocation).
- Variant flagged 3x straight → escalate to Content Director (variant needs deeper remix).',
  cadence_type = 'daily',
  cadence_note = 'PER EVENT — όταν Trial Reel variant ready από Cloud Manager batch',
  department = ARRAY['1c6713c4-ffa4-468e-bc2f-bb972cd24182']::uuid[],
  is_active = true,
  updated_at = now()
FROM public.sop_roles r
WHERE r.slug = 'marketing-executive'
  AND r.id = ANY(f.sop_role)
  AND f.sort_order = 26;


INSERT INTO public.sop_functions (
  function_id, name, kpi, standard_type, sop_content, cadence_type, cadence_note,
  sort_order, department, sop_role, is_active, content_version, created_at, updated_at
)
SELECT
  'sop_fn_me_gr_27',
  'Ban / restriction / shadowban triage (per incident)',
  '100% incidents reported same-minute, all screenshots captured, 0 VA-independent appeals, backup activated εντός day για disables',
  'text',
  '**[PER EVENT — δεν υπάρχει Per-event cadence στο dropdown, χρησιμοποιείται Daily ως placeholder. Trigger: Account shows orange flag, action block popup, sudden reach drop >50%, disabled message, ή permanent ban screen]**

**Σκοπός**
Triage account safety incident — detect type (action block / shadowban / disable / permanent ban), execute stop-actions per scenario, report immediately, activate backup όπου χρειάζεται. Never appeal independently.

**Πότε**
Per incident. Detection μέσω morning Account Status check ή mid-day popup.

**Tools**
- Account Status page (Settings → Account Status)
- Backup account credentials (από Head of Account Defense)
- Screenshot tool
- Discord/Telegram (Account Defense channel)

**Steps (universal)**
1. **Detect** — Settings → Account Status:
   - ALL GREEN = OK, continue.
   - ANY ORANGE = problem. Identify which section:
     - "Limits to your reach" → Shadowban (Scenario 2)
     - "Content removed/messaging issues" → Content violation (Scenario 1 or 3)
     - "Features you can''t use" → Feature restriction (Scenario 1)
     - "Monetization" → Notify Marketing Manager, continue normal
2. **Screenshot everything** — Account Status main + every sub-section + any popup notification.
3. **Report immediately** to Supervisor + Marketing Manager via Discord/Telegram Account Defense channel.

**Scenario 1 — Action Block (popup mid-action)**
- Duration: 48h.
- STOP: likes, follows, comments.
- Wait 48h, do not retry/bypass.
- After 48h, check if lifted; resume.

**Scenario 2 — Shadowban (reach drop 50%+)**
- Archive last 2 posts.
- Quality only, no volume.
- Resume ONLY when Account Status returns green AND Marketing Manager approves.

**Scenario 3 — Temporary Disable (up to 30 days)**
- Screenshot + report.
- ASK FIRST → activate backup account same-day.
- Do NOT appeal independently.
- Do not log into disabled account από work device.
- Do not factory reset device without Marketing Manager approval.

**Scenario 4 — Permanent Ban (no appeal option)**
- Report με όλα τα screenshots.
- Hand device to Marketing Manager για assessment.
- Activate backup account.
- Do not attempt recovery independently.
- Do not use same device για other accounts μέχρι Marketing Manager clears.

**Backup activation**
- Backup account becomes main same-day disable detected.
- VA switches εντός hour μετά report.
- Continue same routine, same content.
- Never log into disabled account από same device.

**Appeal**
- Appeal submitted **exclusively από Marketing Manager**, never VA.
- VA''s only role: provide screenshots + screen-recording showing Wi-Fi OFF + Mobile Data ON.

**Time**
- Detection: 5 min στο morning check.
- Triage + report: 10-15 min same-incident.
- Backup activation: 30-45 min.

**Common mistakes**
- Skim Account Status → miss the orange.
- Delay report "wait να δω αν φτιάχνει" → escalates to permanent.
- Submit appeal solo → kills Manager''s ability to handle.
- Continue blocked actions thinking "just one more" → extends restriction.
- Factory reset without approval → may break recovery options.
- Log back into disabled από same device → contaminates device για backup.

**Escalation**
- ANY incident on Power Page (200+ days, high revenue) → immediate COO + Head of Account Defense.
- Cascade incident (multiple accounts orange same day) → Head of Account Defense + COO immediately (possible device-wide compromise).',
  'daily',
  'PER EVENT — όταν detect orange flag, action block, shadowban, disable, ή permanent ban',
  27,
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
    WHERE r.id = ANY(f.sop_role) AND f.sort_order = 27
  );

UPDATE public.sop_functions f SET
  name = 'Ban / restriction / shadowban triage (per incident)',
  kpi = '100% incidents reported same-minute, all screenshots captured, 0 VA-independent appeals, backup activated εντός day για disables',
  sop_content = '**[PER EVENT — δεν υπάρχει Per-event cadence στο dropdown, χρησιμοποιείται Daily ως placeholder. Trigger: Account shows orange flag, action block popup, sudden reach drop >50%, disabled message, ή permanent ban screen]**

**Σκοπός**
Triage account safety incident — detect type (action block / shadowban / disable / permanent ban), execute stop-actions per scenario, report immediately, activate backup όπου χρειάζεται. Never appeal independently.

**Πότε**
Per incident. Detection μέσω morning Account Status check ή mid-day popup.

**Tools**
- Account Status page (Settings → Account Status)
- Backup account credentials (από Head of Account Defense)
- Screenshot tool
- Discord/Telegram (Account Defense channel)

**Steps (universal)**
1. **Detect** — Settings → Account Status:
   - ALL GREEN = OK, continue.
   - ANY ORANGE = problem. Identify which section:
     - "Limits to your reach" → Shadowban (Scenario 2)
     - "Content removed/messaging issues" → Content violation (Scenario 1 or 3)
     - "Features you can''t use" → Feature restriction (Scenario 1)
     - "Monetization" → Notify Marketing Manager, continue normal
2. **Screenshot everything** — Account Status main + every sub-section + any popup notification.
3. **Report immediately** to Supervisor + Marketing Manager via Discord/Telegram Account Defense channel.

**Scenario 1 — Action Block (popup mid-action)**
- Duration: 48h.
- STOP: likes, follows, comments.
- Wait 48h, do not retry/bypass.
- After 48h, check if lifted; resume.

**Scenario 2 — Shadowban (reach drop 50%+)**
- Archive last 2 posts.
- Quality only, no volume.
- Resume ONLY when Account Status returns green AND Marketing Manager approves.

**Scenario 3 — Temporary Disable (up to 30 days)**
- Screenshot + report.
- ASK FIRST → activate backup account same-day.
- Do NOT appeal independently.
- Do not log into disabled account από work device.
- Do not factory reset device without Marketing Manager approval.

**Scenario 4 — Permanent Ban (no appeal option)**
- Report με όλα τα screenshots.
- Hand device to Marketing Manager για assessment.
- Activate backup account.
- Do not attempt recovery independently.
- Do not use same device για other accounts μέχρι Marketing Manager clears.

**Backup activation**
- Backup account becomes main same-day disable detected.
- VA switches εντός hour μετά report.
- Continue same routine, same content.
- Never log into disabled account από same device.

**Appeal**
- Appeal submitted **exclusively από Marketing Manager**, never VA.
- VA''s only role: provide screenshots + screen-recording showing Wi-Fi OFF + Mobile Data ON.

**Time**
- Detection: 5 min στο morning check.
- Triage + report: 10-15 min same-incident.
- Backup activation: 30-45 min.

**Common mistakes**
- Skim Account Status → miss the orange.
- Delay report "wait να δω αν φτιάχνει" → escalates to permanent.
- Submit appeal solo → kills Manager''s ability to handle.
- Continue blocked actions thinking "just one more" → extends restriction.
- Factory reset without approval → may break recovery options.
- Log back into disabled από same device → contaminates device για backup.

**Escalation**
- ANY incident on Power Page (200+ days, high revenue) → immediate COO + Head of Account Defense.
- Cascade incident (multiple accounts orange same day) → Head of Account Defense + COO immediately (possible device-wide compromise).',
  cadence_type = 'daily',
  cadence_note = 'PER EVENT — όταν detect orange flag, action block, shadowban, disable, ή permanent ban',
  department = ARRAY['1c6713c4-ffa4-468e-bc2f-bb972cd24182']::uuid[],
  is_active = true,
  updated_at = now()
FROM public.sop_roles r
WHERE r.slug = 'marketing-executive'
  AND r.id = ANY(f.sop_role)
  AND f.sort_order = 27;


INSERT INTO public.sop_functions (
  function_id, name, kpi, standard_type, sop_content, cadence_type, cadence_note,
  sort_order, department, sop_role, is_active, content_version, created_at, updated_at
)
SELECT
  'sop_fn_me_gr_28',
  'Creative production support (carousel/story/edit requests από Content Director)',
  '100% requests delivered εντός agreed turnaround, 0 voice/aesthetic mismatches, all assets archived στο iCloud',
  'text',
  '**[PER EVENT — δεν υπάρχει Per-event cadence στο dropdown, χρησιμοποιείται Daily ως placeholder. Trigger: Content Director / Marketing Manager queues ad-hoc creative request (carousel build, story template tweak, reel edit, captions remix)]**

**Σκοπός**
Execute ad-hoc creative production για ad-hoc requests — TT/IG carousels, story sets, reel edits για repurpose, caption remixes. Hand-in-hand με Content Director.

**Πότε**
Per request. Typical triggers: new vertical test launch, special event (holiday/launch), creator-specific campaign, viral concept time-sensitive.

**Tools**
- CapCut / Photoshop (depending on asset)
- iCloud (source files + delivery folder)
- Templates & Assets channel (voice ref)
- Discord/Telegram (request thread)

**Steps**
1. Receive request από Content Director: brief, deadline, source assets pointer, output expected.
2. Confirm acknowledged + ETA back to requestor εντός 1h.
3. Pull source από iCloud / Templates channel.
4. Cross-check creator''s Master voice + aesthetic.
5. Execute:
   - **Carousel:** 3-7 slides, hook on slide 1, CTA or cliffhanger slide last, consistent font/color, niche-tuned voice.
   - **Story set:** match creator''s daily aesthetic, follow CTA Story SOP rules για link stickers.
   - **Caption remix:** rotate wording, no banned terms, match voice.
6. Quality-check vs Master voice + safety rules (no banned wording/emojis).
7. Deliver στο iCloud folder + post link στο request thread.
8. Confirm received με Content Director.
9. Archive το final asset στο `/Creator_Name/Ready_To_Post/` ή appropriate folder.

**Time**
30 min - 2h per request (variable on scope).

**Common mistakes**
- Skip Master voice cross-check → asset doesn''t match creator, gets bounced.
- Use banned wording in captions → asset rejected μετά review.
- No ETA confirmation → Content Director assumes deprioritized.
- Skip archive → asset lost, rebuilt next time.

**Escalation**
- Request scope creep beyond original brief → flag to Content Director (revise brief or add capacity).
- Asset blocked by missing source → ping iCloud Manager + Content Director.
- Request conflicts με daily posting cadence → Marketing Manager prioritize.',
  'daily',
  'PER EVENT — όταν Content Director queues creative request',
  28,
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
    WHERE r.id = ANY(f.sop_role) AND f.sort_order = 28
  );

UPDATE public.sop_functions f SET
  name = 'Creative production support (carousel/story/edit requests από Content Director)',
  kpi = '100% requests delivered εντός agreed turnaround, 0 voice/aesthetic mismatches, all assets archived στο iCloud',
  sop_content = '**[PER EVENT — δεν υπάρχει Per-event cadence στο dropdown, χρησιμοποιείται Daily ως placeholder. Trigger: Content Director / Marketing Manager queues ad-hoc creative request (carousel build, story template tweak, reel edit, captions remix)]**

**Σκοπός**
Execute ad-hoc creative production για ad-hoc requests — TT/IG carousels, story sets, reel edits για repurpose, caption remixes. Hand-in-hand με Content Director.

**Πότε**
Per request. Typical triggers: new vertical test launch, special event (holiday/launch), creator-specific campaign, viral concept time-sensitive.

**Tools**
- CapCut / Photoshop (depending on asset)
- iCloud (source files + delivery folder)
- Templates & Assets channel (voice ref)
- Discord/Telegram (request thread)

**Steps**
1. Receive request από Content Director: brief, deadline, source assets pointer, output expected.
2. Confirm acknowledged + ETA back to requestor εντός 1h.
3. Pull source από iCloud / Templates channel.
4. Cross-check creator''s Master voice + aesthetic.
5. Execute:
   - **Carousel:** 3-7 slides, hook on slide 1, CTA or cliffhanger slide last, consistent font/color, niche-tuned voice.
   - **Story set:** match creator''s daily aesthetic, follow CTA Story SOP rules για link stickers.
   - **Caption remix:** rotate wording, no banned terms, match voice.
6. Quality-check vs Master voice + safety rules (no banned wording/emojis).
7. Deliver στο iCloud folder + post link στο request thread.
8. Confirm received με Content Director.
9. Archive το final asset στο `/Creator_Name/Ready_To_Post/` ή appropriate folder.

**Time**
30 min - 2h per request (variable on scope).

**Common mistakes**
- Skip Master voice cross-check → asset doesn''t match creator, gets bounced.
- Use banned wording in captions → asset rejected μετά review.
- No ETA confirmation → Content Director assumes deprioritized.
- Skip archive → asset lost, rebuilt next time.

**Escalation**
- Request scope creep beyond original brief → flag to Content Director (revise brief or add capacity).
- Asset blocked by missing source → ping iCloud Manager + Content Director.
- Request conflicts με daily posting cadence → Marketing Manager prioritize.',
  cadence_type = 'daily',
  cadence_note = 'PER EVENT — όταν Content Director queues creative request',
  department = ARRAY['1c6713c4-ffa4-468e-bc2f-bb972cd24182']::uuid[],
  is_active = true,
  updated_at = now()
FROM public.sop_roles r
WHERE r.slug = 'marketing-executive'
  AND r.id = ANY(f.sop_role)
  AND f.sort_order = 28;


INSERT INTO public.sop_functions (
  function_id, name, kpi, standard_type, sop_content, cadence_type, cadence_note,
  sort_order, department, sop_role, is_active, content_version, created_at, updated_at
)
SELECT
  'sop_fn_me_gr_29',
  'Account handoff (offboarding / VA transition)',
  '100% credentials transferred secure, factory reset done where required, 0 unauthorized access incidents post-handoff',
  'text',
  '**[PER EVENT — δεν υπάρχει Per-event cadence στο dropdown, χρησιμοποιείται Daily ως placeholder. Trigger: Account reassigned από έναν VA σε άλλο, ή VA leaves Gunzo, ή creator pauses]**

**Σκοπός**
Clean offboarding ενός account από έναν VA σε άλλο (ή to dormancy). Δεν προστατεύεις μόνο credentials — προστατεύεις το device hygiene + το trust score.

**Πότε**
Per transition. Triggered από: VA leaves, account reassignment, creator pause, device retirement.

**Tools**
- Work device (current)
- Password manager
- Account-device mapping sheet
- Backup credentials ή new VA contact

**Steps**
1. **Receive handoff order** από Head of Account Defense με: target VA, transition date, account list.
2. **Day-of:**
   - Change all credentials same-day (new password + recovery email/phone where applicable).
   - Transfer credentials via password manager only — never plain text, never Telegram message.
   - Verify new VA can access from their device.
3. **If VA is leaving Gunzo:**
   - Factory reset το work device.
   - Verify iCloud signed out + Find My disabled.
   - Check Account Center στο IG/FB για unauthorized connections.
   - Revoke access από password manager, Telegram groups, Discord channels, shared tools.
   - Hand device back σε Head of Account Defense.
4. **If account pauses (creator break):**
   - Lower posting cadence per Marketing Manager guidance ή full pause.
   - Log pause date + expected return στο tracker.
5. **Verification:**
   - New VA confirms login + first session done.
   - Daily report για first 3 days flagged για supervision.

**Time**
30-60 min for credential transfer + Day 1 oversight.

**Common mistakes**
- Share credentials via plain text Telegram → permanent leak risk.
- Skip factory reset για departing VA → device potentially compromised.
- Forget Account Center check → unauthorized cross-link survives transition.
- No first-day supervision → new VA makes safety mistake silently.
- Forget στο revoke Telegram/Discord access → ex-VA still sees confidential channels.

**Escalation**
- Departing VA refuses device return → HR + Head of Account Defense.
- Unauthorized Account Center connection found post-handoff → immediate forensics, Head of Account Defense.',
  'daily',
  'PER EVENT — όταν account μεταφέρεται σε άλλο VA, ή VA leaves',
  29,
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
    WHERE r.id = ANY(f.sop_role) AND f.sort_order = 29
  );

UPDATE public.sop_functions f SET
  name = 'Account handoff (offboarding / VA transition)',
  kpi = '100% credentials transferred secure, factory reset done where required, 0 unauthorized access incidents post-handoff',
  sop_content = '**[PER EVENT — δεν υπάρχει Per-event cadence στο dropdown, χρησιμοποιείται Daily ως placeholder. Trigger: Account reassigned από έναν VA σε άλλο, ή VA leaves Gunzo, ή creator pauses]**

**Σκοπός**
Clean offboarding ενός account από έναν VA σε άλλο (ή to dormancy). Δεν προστατεύεις μόνο credentials — προστατεύεις το device hygiene + το trust score.

**Πότε**
Per transition. Triggered από: VA leaves, account reassignment, creator pause, device retirement.

**Tools**
- Work device (current)
- Password manager
- Account-device mapping sheet
- Backup credentials ή new VA contact

**Steps**
1. **Receive handoff order** από Head of Account Defense με: target VA, transition date, account list.
2. **Day-of:**
   - Change all credentials same-day (new password + recovery email/phone where applicable).
   - Transfer credentials via password manager only — never plain text, never Telegram message.
   - Verify new VA can access from their device.
3. **If VA is leaving Gunzo:**
   - Factory reset το work device.
   - Verify iCloud signed out + Find My disabled.
   - Check Account Center στο IG/FB για unauthorized connections.
   - Revoke access από password manager, Telegram groups, Discord channels, shared tools.
   - Hand device back σε Head of Account Defense.
4. **If account pauses (creator break):**
   - Lower posting cadence per Marketing Manager guidance ή full pause.
   - Log pause date + expected return στο tracker.
5. **Verification:**
   - New VA confirms login + first session done.
   - Daily report για first 3 days flagged για supervision.

**Time**
30-60 min for credential transfer + Day 1 oversight.

**Common mistakes**
- Share credentials via plain text Telegram → permanent leak risk.
- Skip factory reset για departing VA → device potentially compromised.
- Forget Account Center check → unauthorized cross-link survives transition.
- No first-day supervision → new VA makes safety mistake silently.
- Forget στο revoke Telegram/Discord access → ex-VA still sees confidential channels.

**Escalation**
- Departing VA refuses device return → HR + Head of Account Defense.
- Unauthorized Account Center connection found post-handoff → immediate forensics, Head of Account Defense.',
  cadence_type = 'daily',
  cadence_note = 'PER EVENT — όταν account μεταφέρεται σε άλλο VA, ή VA leaves',
  department = ARRAY['1c6713c4-ffa4-468e-bc2f-bb972cd24182']::uuid[],
  is_active = true,
  updated_at = now()
FROM public.sop_roles r
WHERE r.slug = 'marketing-executive'
  AND r.id = ANY(f.sop_role)
  AND f.sort_order = 29;


