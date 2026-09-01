INSERT INTO public.sop_functions (
  function_id, name, kpi, standard_type, sop_content, cadence_type, cadence_note,
  sort_order, department, sop_role, is_active, content_version, created_at, updated_at
)
SELECT
  'sop_fn_me_us_11',
  'DM funnel work (Requests folder triage)',
  '100% of DMs funneled within 2–3 messages; 0 message-4+ without link; all spam muted same-day',
  'text',
  '**Purpose**
Check Requests folder + process every DM through the 4-folder system (Requests → Main → General → Muted). Goal: **2–3 messages max → OnlyFans link**.

**When**
Daily, multiple checks (morning / midday / evening). Max 30 DMs/day per account.

**Tools**
- IG inbox (4-folder structure)
- DM Copy Bank (rotating templates)
- OF link / clipboard

**Steps**
1. Open IG → Requests folder.
2. Pick DM → identify category from classification (8 types):
   - 01 Emoji/Story reply → warm-up + funnel within 2 msgs
   - 02 Compliment → funnel immediately
   - 03 Meet request → dream-sell → funnel
   - 04 Explicit → redirect → bio link
   - 05 Dick pic / random image → **MUTE immediately**
   - 06 Confused / elderly → mute → General
   - 07 Repeat high-intent → fast close (1 message)
   - 08 Spam / low-value → **MUTE immediately**
3. Write reply from Copy Bank — rotate wording daily, never copy-paste 2 days in a row.
4. Send link within message 2 or 3, never later.
5. **Immediately move to General folder** after the link — never follow up.
6. Pause 5–10 sec between DMs.
7. Verify hard caps: 30 DMs/day per account, 0 raw links without video/text warm-up.

**Banned**
"Give me your phone" / "let''s meet up" / "come over" / promises for real meeting / explaining what OF is / same copy 2x in a row / replying to dick pics.

**Time**
30–60 minutes spread across the day.

**Common mistakes**
- Reaching message 4+ without link → lost objective, restart framing.
- Replying to dick pics → waste, mute instead.
- Sending raw link first → Messenger/IG ban risk.
- Follow-up after the link → spam signal.
- Same wording on all DMs → pattern flag.

**Escalation**
- DM threat / abuse pattern → screenshot + Marketing Manager.
- Account-wide DM block → Head of Account Defense (possible action restriction).
- DM funnel converting <5% → flag in weekly KPI review.',
  'daily',
  'Daily, multiple times — Requests folder check',
  11,
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
    WHERE r.id = ANY(f.sop_role) AND f.sort_order = 11
  );

UPDATE public.sop_functions f SET
  name = 'DM funnel work (Requests folder triage)',
  kpi = '100% of DMs funneled within 2–3 messages; 0 message-4+ without link; all spam muted same-day',
  sop_content = '**Purpose**
Check Requests folder + process every DM through the 4-folder system (Requests → Main → General → Muted). Goal: **2–3 messages max → OnlyFans link**.

**When**
Daily, multiple checks (morning / midday / evening). Max 30 DMs/day per account.

**Tools**
- IG inbox (4-folder structure)
- DM Copy Bank (rotating templates)
- OF link / clipboard

**Steps**
1. Open IG → Requests folder.
2. Pick DM → identify category from classification (8 types):
   - 01 Emoji/Story reply → warm-up + funnel within 2 msgs
   - 02 Compliment → funnel immediately
   - 03 Meet request → dream-sell → funnel
   - 04 Explicit → redirect → bio link
   - 05 Dick pic / random image → **MUTE immediately**
   - 06 Confused / elderly → mute → General
   - 07 Repeat high-intent → fast close (1 message)
   - 08 Spam / low-value → **MUTE immediately**
3. Write reply from Copy Bank — rotate wording daily, never copy-paste 2 days in a row.
4. Send link within message 2 or 3, never later.
5. **Immediately move to General folder** after the link — never follow up.
6. Pause 5–10 sec between DMs.
7. Verify hard caps: 30 DMs/day per account, 0 raw links without video/text warm-up.

**Banned**
"Give me your phone" / "let''s meet up" / "come over" / promises for real meeting / explaining what OF is / same copy 2x in a row / replying to dick pics.

**Time**
30–60 minutes spread across the day.

**Common mistakes**
- Reaching message 4+ without link → lost objective, restart framing.
- Replying to dick pics → waste, mute instead.
- Sending raw link first → Messenger/IG ban risk.
- Follow-up after the link → spam signal.
- Same wording on all DMs → pattern flag.

**Escalation**
- DM threat / abuse pattern → screenshot + Marketing Manager.
- Account-wide DM block → Head of Account Defense (possible action restriction).
- DM funnel converting <5% → flag in weekly KPI review.',
  cadence_type = 'daily',
  cadence_note = 'Daily, multiple times — Requests folder check',
  department = ARRAY['1c6713c4-ffa4-468e-bc2f-bb972cd24182']::uuid[],
  is_active = true,
  updated_at = now()
FROM public.sop_roles r
WHERE r.slug = 'marketing-executives-us'
  AND r.id = ANY(f.sop_role)
  AND f.sort_order = 11;



INSERT INTO public.sop_functions (
  function_id, name, kpi, standard_type, sop_content, cadence_type, cadence_note,
  sort_order, department, sop_role, is_active, content_version, created_at, updated_at
)
SELECT
  'sop_fn_me_us_12',
  'Viral comment strategy (outbound 5–10/day)',
  '5–10 outbound viral comments/day per Main; 1–3 on videos with 100K+ views; comment log filled',
  'text',
  '**Purpose**
Outbound commenting from Main account on others'' viral videos — hijack attention, drive traffic to the creator''s profile. Piggybacks on the daily scroll, no separate time block.

**When**
Daily during the 30min Reels-scroll session.

**Tools**
- IG/TT app (scrolling)
- Daily comment log sheet

**Steps**
1. Scroll FYP/Reels as usual.
2. When you find a video with:
   - Viral velocity (fast view growth)
   - Niche-adjacent or mainstream topic
   - Debate-prone (relationships, lifestyle, hustle, beauty)
   - No dominant comment yet (ideal) OR dominant comment you can counter
   → pause.
3. Pick comment type:
   - **01 Identification** — say what everyone thinks but hasn''t said (1st person, 1–2 sentences)
   - **02 Challenge/Counter** — confidently right OR confidently wrong, never hedging
   - **03 Debate trigger** — sharp irony, no profanity
   - **04 Role-model reference** — recognizable now, no explanation needed
   - **05 Controversial/provocative** — ironic, never aggressive
4. Write in <90 sec. If longer → skip.
5. Post comment.
6. Log: video link + comment type + outcome (likes / profile visits / follows / DMs attributed).

**Universal rules**
- Short (1–2 sentences). Longer doesn''t rank.
- No typos.
- Never explain yourself.
- Never insult individuals (ironize positions).
- Never name-drop Gunzo / OF / creator link.
- Never "follow me" — click happens organically.

**Time**
Embedded in 30min scroll — typically 8–12 min focused on comments.

**Common mistakes**
- Hedging language ("maybe", "I think") → invisible.
- Commenting on flat-velocity videos → wasted.
- Same comment type every day → pattern-flagged.
- Mentioning OF/link → spam ban.
- Skipping the log → no idea what works.

**Escalation**
- 1-week zero comment lift → review with Marketing Manager (account possibly shadowbanned).
- Mass-reply troll from outbound comment → ignore + report, never engage.',
  'daily',
  'Daily, embedded in scroll session',
  12,
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
    WHERE r.id = ANY(f.sop_role) AND f.sort_order = 12
  );

UPDATE public.sop_functions f SET
  name = 'Viral comment strategy (outbound 5–10/day)',
  kpi = '5–10 outbound viral comments/day per Main; 1–3 on videos with 100K+ views; comment log filled',
  sop_content = '**Purpose**
Outbound commenting from Main account on others'' viral videos — hijack attention, drive traffic to the creator''s profile. Piggybacks on the daily scroll, no separate time block.

**When**
Daily during the 30min Reels-scroll session.

**Tools**
- IG/TT app (scrolling)
- Daily comment log sheet

**Steps**
1. Scroll FYP/Reels as usual.
2. When you find a video with:
   - Viral velocity (fast view growth)
   - Niche-adjacent or mainstream topic
   - Debate-prone (relationships, lifestyle, hustle, beauty)
   - No dominant comment yet (ideal) OR dominant comment you can counter
   → pause.
3. Pick comment type:
   - **01 Identification** — say what everyone thinks but hasn''t said (1st person, 1–2 sentences)
   - **02 Challenge/Counter** — confidently right OR confidently wrong, never hedging
   - **03 Debate trigger** — sharp irony, no profanity
   - **04 Role-model reference** — recognizable now, no explanation needed
   - **05 Controversial/provocative** — ironic, never aggressive
4. Write in <90 sec. If longer → skip.
5. Post comment.
6. Log: video link + comment type + outcome (likes / profile visits / follows / DMs attributed).

**Universal rules**
- Short (1–2 sentences). Longer doesn''t rank.
- No typos.
- Never explain yourself.
- Never insult individuals (ironize positions).
- Never name-drop Gunzo / OF / creator link.
- Never "follow me" — click happens organically.

**Time**
Embedded in 30min scroll — typically 8–12 min focused on comments.

**Common mistakes**
- Hedging language ("maybe", "I think") → invisible.
- Commenting on flat-velocity videos → wasted.
- Same comment type every day → pattern-flagged.
- Mentioning OF/link → spam ban.
- Skipping the log → no idea what works.

**Escalation**
- 1-week zero comment lift → review with Marketing Manager (account possibly shadowbanned).
- Mass-reply troll from outbound comment → ignore + report, never engage.',
  cadence_type = 'daily',
  cadence_note = 'Daily, embedded in scroll session',
  department = ARRAY['1c6713c4-ffa4-468e-bc2f-bb972cd24182']::uuid[],
  is_active = true,
  updated_at = now()
FROM public.sop_roles r
WHERE r.slug = 'marketing-executives-us'
  AND r.id = ANY(f.sop_role)
  AND f.sort_order = 12;



INSERT INTO public.sop_functions (
  function_id, name, kpi, standard_type, sop_content, cadence_type, cadence_note,
  sort_order, department, sop_role, is_active, content_version, created_at, updated_at
)
SELECT
  'sop_fn_me_us_13',
  'F4F + scrolling + likes routine (engagement)',
  '50–100 follows/day on Alt; 20–30 on Main; 50 likes max/day; ratio healthy',
  'text',
  '**Purpose**
Daily engagement routine — F4F (Alt accounts), unfollow stale, 30min scroll algorithm-training, niche post + story likes.

**When**
Daily, on all accounts. Order: **Scrolling → Likes → F4F → Unfollow (delayed 5–7 days)**.

**Tools**
- IG/TT/FB app
- Niche shortlist (creators to F4F from)

**Steps**
1. **Scrolling (30min)** — Reels/FYP tab, niche only. Watch to completion. Skip <2s = negative signal, do not.
2. **Post likes** — 50 max/day per account, 5-sec pause between. Niche only.
3. **Story likes** — 10–20/day, mix likes + short replies.
4. **F4F (Alt accounts):** 50–100 follows/day per Alt, 1 follow per 5–10 sec. Niche-relevant only. Glance at 1–2 posts before following. New Alt: start 10–15/day, ramp 2 weeks.
5. **F4F (Main):** 20–30 follows/day max, split 2–3 sessions.
6. **Unfollow** (Alt) — anyone who hasn''t followed back in 5–7 days. Never mass-unfollow. Spread throughout the day.
7. Hard cap: **150 follows + 200 likes per device per day combined across all accounts**.

**Time**
45–60 min daily total.

**Common mistakes**
- Scrolling Following tab instead of FYP → wrong algorithm signal.
- Skip videos in <2s → negative preference signal.
- Mass-follow burst → instant flag. Likes burst → spam.
- Forgetting 150/200 device cap. Mass-unfollow in 1 batch → shadowban.

**Escalation**
- Action block popup → STOP follows/likes/comments, continue posting/stories/DMs, report + wait 48h.
- Follow ratio broken (following >> followers >2:1) → unfollow cycle, ping Marketing Manager.',
  'daily',
  'Daily, per account — Alt accounts F4F primary',
  13,
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
    WHERE r.id = ANY(f.sop_role) AND f.sort_order = 13
  );

UPDATE public.sop_functions f SET
  name = 'F4F + scrolling + likes routine (engagement)',
  kpi = '50–100 follows/day on Alt; 20–30 on Main; 50 likes max/day; ratio healthy',
  sop_content = '**Purpose**
Daily engagement routine — F4F (Alt accounts), unfollow stale, 30min scroll algorithm-training, niche post + story likes.

**When**
Daily, on all accounts. Order: **Scrolling → Likes → F4F → Unfollow (delayed 5–7 days)**.

**Tools**
- IG/TT/FB app
- Niche shortlist (creators to F4F from)

**Steps**
1. **Scrolling (30min)** — Reels/FYP tab, niche only. Watch to completion. Skip <2s = negative signal, do not.
2. **Post likes** — 50 max/day per account, 5-sec pause between. Niche only.
3. **Story likes** — 10–20/day, mix likes + short replies.
4. **F4F (Alt accounts):** 50–100 follows/day per Alt, 1 follow per 5–10 sec. Niche-relevant only. Glance at 1–2 posts before following. New Alt: start 10–15/day, ramp 2 weeks.
5. **F4F (Main):** 20–30 follows/day max, split 2–3 sessions.
6. **Unfollow** (Alt) — anyone who hasn''t followed back in 5–7 days. Never mass-unfollow. Spread throughout the day.
7. Hard cap: **150 follows + 200 likes per device per day combined across all accounts**.

**Time**
45–60 min daily total.

**Common mistakes**
- Scrolling Following tab instead of FYP → wrong algorithm signal.
- Skip videos in <2s → negative preference signal.
- Mass-follow burst → instant flag. Likes burst → spam.
- Forgetting 150/200 device cap. Mass-unfollow in 1 batch → shadowban.

**Escalation**
- Action block popup → STOP follows/likes/comments, continue posting/stories/DMs, report + wait 48h.
- Follow ratio broken (following >> followers >2:1) → unfollow cycle, ping Marketing Manager.',
  cadence_type = 'daily',
  cadence_note = 'Daily, per account — Alt accounts F4F primary',
  department = ARRAY['1c6713c4-ffa4-468e-bc2f-bb972cd24182']::uuid[],
  is_active = true,
  updated_at = now()
FROM public.sop_roles r
WHERE r.slug = 'marketing-executives-us'
  AND r.id = ANY(f.sop_role)
  AND f.sort_order = 13;



INSERT INTO public.sop_functions (
  function_id, name, kpi, standard_type, sop_content, cadence_type, cadence_note,
  sort_order, department, sop_role, is_active, content_version, created_at, updated_at
)
SELECT
  'sop_fn_me_us_14',
  'End-of-day Discord/Telegram report',
  '100% of daily reports posted before end-of-shift; all blocks/anomalies flagged same-day',
  'text',
  '**Purpose**
End-of-shift report in the Daily Reports channel — accounts worked, posts made, blocks, anomalies. Management Team needs this for pattern detection + next-day prep.

**When**
Daily, end of shift. Marketing Executive report is more detailed than other roles.

**Tools**
- Discord/Telegram → Daily Reports channel
- Daily posting log sheet

**Steps**
1. Open Daily Reports channel.
2. Post clear structure: accounts worked, posts per platform, trials posted, F4F numbers, DM funnel stats, blocks/issues, tomorrow blockers.
3. Tag Marketing Manager if urgent block.
4. Keep under 300 words.

**Time**
5–8 minutes.

**Common mistakes**
Skip report on quiet days; long essays; mixing with Questions channel; not flagging blocks; over-tagging Manager.

**Escalation**
Ban/lock/orange → Account Defense + COO if Power Page. Equipment broken → Management Team. Creator unresponsive 24h+ → CSM.',
  'daily',
  'Daily end of shift, in Daily Reports channel',
  14,
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
    WHERE r.id = ANY(f.sop_role) AND f.sort_order = 14
  );

UPDATE public.sop_functions f SET
  name = 'End-of-day Discord/Telegram report',
  kpi = '100% of daily reports posted before end-of-shift; all blocks/anomalies flagged same-day',
  sop_content = '**Purpose**
End-of-shift report in the Daily Reports channel — accounts worked, posts made, blocks, anomalies. Management Team needs this for pattern detection + next-day prep.

**When**
Daily, end of shift. Marketing Executive report is more detailed than other roles.

**Tools**
- Discord/Telegram → Daily Reports channel
- Daily posting log sheet

**Steps**
1. Open Daily Reports channel.
2. Post clear structure: accounts worked, posts per platform, trials posted, F4F numbers, DM funnel stats, blocks/issues, tomorrow blockers.
3. Tag Marketing Manager if urgent block.
4. Keep under 300 words.

**Time**
5–8 minutes.

**Common mistakes**
Skip report on quiet days; long essays; mixing with Questions channel; not flagging blocks; over-tagging Manager.

**Escalation**
Ban/lock/orange → Account Defense + COO if Power Page. Equipment broken → Management Team. Creator unresponsive 24h+ → CSM.',
  cadence_type = 'daily',
  cadence_note = 'Daily end of shift, in Daily Reports channel',
  department = ARRAY['1c6713c4-ffa4-468e-bc2f-bb972cd24182']::uuid[],
  is_active = true,
  updated_at = now()
FROM public.sop_roles r
WHERE r.slug = 'marketing-executives-us'
  AND r.id = ANY(f.sop_role)
  AND f.sort_order = 14;



INSERT INTO public.sop_functions (
  function_id, name, kpi, standard_type, sop_content, cadence_type, cadence_note,
  sort_order, department, sop_role, is_active, content_version, created_at, updated_at
)
SELECT
  'sop_fn_me_us_15',
  'Account Defense compliance (shared ownership)',
  '0 rule violations/session; 100% always-on rules followed; all flags reported same-minute; EOD compliance log 100% filled',
  'text',
  '**Purpose**
Account Defense is shared responsibility. Head of Account Defense owns the system, escalations, appeals, and recovery protocols. The Marketing Executive owns **daily rule compliance** and **early signal capture**. Without VA-side compliance, the system fails — most bans come from VA negligence (Wi-Fi, missed warm-up, banned hashtag, watermark leftover), not platform bugs.

**When**
Always-on every session. Explicit self-check in EOD report.

**Tools**
- Ultimate Account Safety & Restrictions SOP (Notion)
- Account Status page (Settings → Account Status)
- Discord/Telegram Account Defense channel
- WhatIsMyIp.com bookmark
- EOD compliance log

**Daily compliance — 12 always-on rules**
1. **Device:** Assigned device only, physical SIM, iCloud Backup + Find My OFF, no personal accounts.
2. **Network:** Mobile data only — NEVER Wi-Fi/VPN/Proxy/eSIM. IP rotation before every account switch.
3. **Warm-up:** 10-min warm-up before action. Never post-and-ghost (stay 5min post-post).
4. **Visual content:** Zero prohibited content. Lifestyle-first.
5. **Caption:** Zero forbidden words ("OnlyFans", "OF", "exclusive content", etc.).
6. **Posting mix:** 70–80% safe, 20–30% slight edge. Max 3 Reels/24h/account. Unique PFP + bio + highlights.
7. **Repurposing:** Never reupload with watermark. Unique edits always (trim + brightness + invisible username overlay).
8. **Hashtags:** Verify each new hashtag. Max 5/post. Rotate every 3–4 posts.
9. **Stories & link sticker:** Link sticker only on verified or with Manager approval. Never direct OF link.
10. **Action limits:** Max 150 follows/day per device, max 200 likes/day per device. Never same DM to multiple users. Never link in DM.
11. **Bio & links:** Zero "OnlyFans"/"OF" anywhere. Zero direct links in bio/caption/DM.
12. **Account Center:** Never connect IG-FB-Threads without Marketing Manager approval.

**Early signal capture**
Orange flag → screenshot + report Head of Account Defense within minutes. Action block → STOP as required, continue allowed actions, report. Reach drop >50% in 24h → screenshot + report. Mass-removed content → screenshot + report. Login security check → screenshot + STOP, report.

**EOD self-check (5 min)**
In daily report include: devices used + Wi-Fi ever ON (Y/N); IP rotated before each switch (Y/N); total follows + likes vs cap; hashtags rotated (Y/N); watermarks in today''s posts (Y/N expected N); Account Center clean (Y/N); flags spotted (list or "0").

**Time**
~7 min standalone overhead/day plus always-on discipline.

**Escalation**
Orange flag → immediate Head of Account Defense + STOP. Unauthorized Account Center link → Head of Account Defense + Marketing Manager. Permanent ban → Head of Account Defense owns appeal; VA does not act independently.',
  'daily',
  'Always-on every session + explicit EOD self-check',
  15,
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
    WHERE r.id = ANY(f.sop_role) AND f.sort_order = 15
  );

UPDATE public.sop_functions f SET
  name = 'Account Defense compliance (shared ownership)',
  kpi = '0 rule violations/session; 100% always-on rules followed; all flags reported same-minute; EOD compliance log 100% filled',
  sop_content = '**Purpose**
Account Defense is shared responsibility. Head of Account Defense owns the system, escalations, appeals, and recovery protocols. The Marketing Executive owns **daily rule compliance** and **early signal capture**. Without VA-side compliance, the system fails — most bans come from VA negligence (Wi-Fi, missed warm-up, banned hashtag, watermark leftover), not platform bugs.

**When**
Always-on every session. Explicit self-check in EOD report.

**Tools**
- Ultimate Account Safety & Restrictions SOP (Notion)
- Account Status page (Settings → Account Status)
- Discord/Telegram Account Defense channel
- WhatIsMyIp.com bookmark
- EOD compliance log

**Daily compliance — 12 always-on rules**
1. **Device:** Assigned device only, physical SIM, iCloud Backup + Find My OFF, no personal accounts.
2. **Network:** Mobile data only — NEVER Wi-Fi/VPN/Proxy/eSIM. IP rotation before every account switch.
3. **Warm-up:** 10-min warm-up before action. Never post-and-ghost (stay 5min post-post).
4. **Visual content:** Zero prohibited content. Lifestyle-first.
5. **Caption:** Zero forbidden words ("OnlyFans", "OF", "exclusive content", etc.).
6. **Posting mix:** 70–80% safe, 20–30% slight edge. Max 3 Reels/24h/account. Unique PFP + bio + highlights.
7. **Repurposing:** Never reupload with watermark. Unique edits always (trim + brightness + invisible username overlay).
8. **Hashtags:** Verify each new hashtag. Max 5/post. Rotate every 3–4 posts.
9. **Stories & link sticker:** Link sticker only on verified or with Manager approval. Never direct OF link.
10. **Action limits:** Max 150 follows/day per device, max 200 likes/day per device. Never same DM to multiple users. Never link in DM.
11. **Bio & links:** Zero "OnlyFans"/"OF" anywhere. Zero direct links in bio/caption/DM.
12. **Account Center:** Never connect IG-FB-Threads without Marketing Manager approval.

**Early signal capture**
Orange flag → screenshot + report Head of Account Defense within minutes. Action block → STOP as required, continue allowed actions, report. Reach drop >50% in 24h → screenshot + report. Mass-removed content → screenshot + report. Login security check → screenshot + STOP, report.

**EOD self-check (5 min)**
In daily report include: devices used + Wi-Fi ever ON (Y/N); IP rotated before each switch (Y/N); total follows + likes vs cap; hashtags rotated (Y/N); watermarks in today''s posts (Y/N expected N); Account Center clean (Y/N); flags spotted (list or "0").

**Time**
~7 min standalone overhead/day plus always-on discipline.

**Escalation**
Orange flag → immediate Head of Account Defense + STOP. Unauthorized Account Center link → Head of Account Defense + Marketing Manager. Permanent ban → Head of Account Defense owns appeal; VA does not act independently.',
  cadence_type = 'daily',
  cadence_note = 'Always-on every session + explicit EOD self-check',
  department = ARRAY['1c6713c4-ffa4-468e-bc2f-bb972cd24182']::uuid[],
  is_active = true,
  updated_at = now()
FROM public.sop_roles r
WHERE r.slug = 'marketing-executives-us'
  AND r.id = ANY(f.sop_role)
  AND f.sort_order = 15;