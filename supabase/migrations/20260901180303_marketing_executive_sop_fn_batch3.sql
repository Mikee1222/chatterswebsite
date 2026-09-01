-- marketing_executive SOP functions batch 3

INSERT INTO public.sop_functions (
  function_id, name, kpi, standard_type, sop_content, cadence_type, cadence_note,
  sort_order, department, sop_role, is_active, content_version, created_at, updated_at
)
SELECT
  'sop_fn_me_gr_11',
  'DM funnel work (Requests folder triage)',
  '100% DMs funneled εντός 2-3 messages, 0 message-4+ without link, all spam muted same-day',
  'text',
  '**Σκοπός**
Έλεγχος Requests folder + process κάθε DM μέσω 4-folder system (Requests → Main → General → Muted). Goal: **2-3 messages max → OnlyFans link**.

**Πότε**
Καθημερινά, multiple checks (morning / midday / evening). Max 30 DMs/day per account.

**Tools**
- IG inbox (4-folder structure)
- DM Copy Bank (rotating templates)
- OF link / clipboard

**Steps**
1. Open IG → Requests folder.
2. Pick DM → identify category από classification (8 types):
   - 01 Emoji/Story reply → warm-up + funnel μέσα σε 2 msgs
   - 02 Compliment → funnel immediately
   - 03 Meet request → dream-sell → funnel
   - 04 Explicit → redirect → bio link
   - 05 Dick pic / random image → **MUTE immediately**
   - 06 Confused / elderly → mute → General
   - 07 Repeat high-intent → fast close (1 message)
   - 08 Spam / low-value → **MUTE immediately**
3. Write reply από Copy Bank — rotate wording daily, never copy-paste 2 μέρες σε σειρά.
4. Send link μέσα στο message 2 ή 3, never later.
5. **Immediately move to General folder** μετά το link — never follow up.
6. Pause 5-10 sec μεταξύ DMs.
7. Verify hard caps: 30 DMs/day per account, 0 raw links χωρίς video/text warm-up.

**Banned**
"Δώσε τηλέφωνο" / "πάμε να βγούμε" / "έλα σπίτι" / promises for real meeting / explanation what OF is / same copy 2x in row / reply σε dick pic.

**Time**
30-60 λεπτά spread across day.

**Common mistakes**
- Reach message 4+ without link → lost objective, restart framing.
- Reply σε dick pics → waste, mute instead.
- Send raw link first → Messenger/IG ban risk.
- Follow-up μετά το link → spam signal.
- Same wording σε όλα τα DMs → pattern flag.

**Escalation**
- DM threat / abuse pattern → screenshot + Marketing Manager.
- Account-wide DM block → Head of Account Defense (possible action restriction).
- DM funnel converting <5% → flag στο weekly KPI review.',
  'daily',
  'Καθημερινά, multiple times — Requests folder check',
  11,
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
    WHERE r.id = ANY(f.sop_role) AND f.sort_order = 11
  );

UPDATE public.sop_functions f SET
  name = 'DM funnel work (Requests folder triage)',
  kpi = '100% DMs funneled εντός 2-3 messages, 0 message-4+ without link, all spam muted same-day',
  sop_content = '**Σκοπός**
Έλεγχος Requests folder + process κάθε DM μέσω 4-folder system (Requests → Main → General → Muted). Goal: **2-3 messages max → OnlyFans link**.

**Πότε**
Καθημερινά, multiple checks (morning / midday / evening). Max 30 DMs/day per account.

**Tools**
- IG inbox (4-folder structure)
- DM Copy Bank (rotating templates)
- OF link / clipboard

**Steps**
1. Open IG → Requests folder.
2. Pick DM → identify category από classification (8 types):
   - 01 Emoji/Story reply → warm-up + funnel μέσα σε 2 msgs
   - 02 Compliment → funnel immediately
   - 03 Meet request → dream-sell → funnel
   - 04 Explicit → redirect → bio link
   - 05 Dick pic / random image → **MUTE immediately**
   - 06 Confused / elderly → mute → General
   - 07 Repeat high-intent → fast close (1 message)
   - 08 Spam / low-value → **MUTE immediately**
3. Write reply από Copy Bank — rotate wording daily, never copy-paste 2 μέρες σε σειρά.
4. Send link μέσα στο message 2 ή 3, never later.
5. **Immediately move to General folder** μετά το link — never follow up.
6. Pause 5-10 sec μεταξύ DMs.
7. Verify hard caps: 30 DMs/day per account, 0 raw links χωρίς video/text warm-up.

**Banned**
"Δώσε τηλέφωνο" / "πάμε να βγούμε" / "έλα σπίτι" / promises for real meeting / explanation what OF is / same copy 2x in row / reply σε dick pic.

**Time**
30-60 λεπτά spread across day.

**Common mistakes**
- Reach message 4+ without link → lost objective, restart framing.
- Reply σε dick pics → waste, mute instead.
- Send raw link first → Messenger/IG ban risk.
- Follow-up μετά το link → spam signal.
- Same wording σε όλα τα DMs → pattern flag.

**Escalation**
- DM threat / abuse pattern → screenshot + Marketing Manager.
- Account-wide DM block → Head of Account Defense (possible action restriction).
- DM funnel converting <5% → flag στο weekly KPI review.',
  cadence_type = 'daily',
  cadence_note = 'Καθημερινά, multiple times — Requests folder check',
  department = ARRAY['1c6713c4-ffa4-468e-bc2f-bb972cd24182']::uuid[],
  is_active = true,
  updated_at = now()
FROM public.sop_roles r
WHERE r.slug = 'marketing-executive'
  AND r.id = ANY(f.sop_role)
  AND f.sort_order = 11;


INSERT INTO public.sop_functions (
  function_id, name, kpi, standard_type, sop_content, cadence_type, cadence_note,
  sort_order, department, sop_role, is_active, content_version, created_at, updated_at
)
SELECT
  'sop_fn_me_gr_12',
  'Viral comment strategy (outbound 5-10/day)',
  '5-10 outbound viral comments/day per Main, 1-3 σε videos με 100K+ views, comment-log filled',
  'text',
  '**Σκοπός**
Outbound commenting από Main account σε άλλων viral videos — hijack attention, drive traffic στο creator''s profile. Piggybacks στο daily scroll, χωρίς separate time block.

**Πότε**
Καθημερινά κατά τη 30min Reels-scroll session.

**Tools**
- IG/TT app (scrolling)
- Daily comment log sheet

**Steps**
1. Scroll FYP/Reels as usual.
2. Όταν βρεις video με:
   - Viral velocity (fast view growth)
   - Niche-adjacent ή mainstream topic
   - Debate-prone (relationships, lifestyle, hustle, beauty)
   - No dominant comment yet (ideal) OR dominant comment counterable
   → pause.
3. Pick comment type:
   - **01 Identification** — "say what everyone thinks but hasn''t said" (1st person, 1-2 sentences)
   - **02 Challenge/Counter** — confidently right OR confidently wrong, never hedging
   - **03 Debate trigger** — sharp irony, no profanity
   - **04 Role-model reference** — recognisable now, no explanation needed
   - **05 Controversial/provocative** — ironic, never aggressive
4. Write in <90 sec. If longer → skip.
5. Post comment.
6. Log: video link + comment type + outcome (likes / profile visits / follows / DMs attributed).

**Universal rules**
- Short (1-2 sentences). Longer doesn''t rank.
- No typos.
- Never explain yourself.
- Never insult individuals (ironise positions).
- Never name-drop Gunzo / OF / creator link.
- Never "follow me" — click happens organically.

**Time**
Embedded στο 30min scroll — typically 8-12 min focused on comments.

**Common mistakes**
- Hedging language ("maybe", "I think") → invisible.
- Comment on flat-velocity videos → wasted.
- Same comment type κάθε μέρα → pattern-flagged.
- Mention OF/link → spam ban.
- Skip the log → no idea what works.

**Escalation**
- 1-week zero comment lift → review with Marketing Manager (account possibly shadowbanned).
- Mass-reply troll from outbound comment → ignore + report, never engage.',
  'daily',
  'Καθημερινά, embedded στο scroll session',
  12,
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
    WHERE r.id = ANY(f.sop_role) AND f.sort_order = 12
  );

UPDATE public.sop_functions f SET
  name = 'Viral comment strategy (outbound 5-10/day)',
  kpi = '5-10 outbound viral comments/day per Main, 1-3 σε videos με 100K+ views, comment-log filled',
  sop_content = '**Σκοπός**
Outbound commenting από Main account σε άλλων viral videos — hijack attention, drive traffic στο creator''s profile. Piggybacks στο daily scroll, χωρίς separate time block.

**Πότε**
Καθημερινά κατά τη 30min Reels-scroll session.

**Tools**
- IG/TT app (scrolling)
- Daily comment log sheet

**Steps**
1. Scroll FYP/Reels as usual.
2. Όταν βρεις video με:
   - Viral velocity (fast view growth)
   - Niche-adjacent ή mainstream topic
   - Debate-prone (relationships, lifestyle, hustle, beauty)
   - No dominant comment yet (ideal) OR dominant comment counterable
   → pause.
3. Pick comment type:
   - **01 Identification** — "say what everyone thinks but hasn''t said" (1st person, 1-2 sentences)
   - **02 Challenge/Counter** — confidently right OR confidently wrong, never hedging
   - **03 Debate trigger** — sharp irony, no profanity
   - **04 Role-model reference** — recognisable now, no explanation needed
   - **05 Controversial/provocative** — ironic, never aggressive
4. Write in <90 sec. If longer → skip.
5. Post comment.
6. Log: video link + comment type + outcome (likes / profile visits / follows / DMs attributed).

**Universal rules**
- Short (1-2 sentences). Longer doesn''t rank.
- No typos.
- Never explain yourself.
- Never insult individuals (ironise positions).
- Never name-drop Gunzo / OF / creator link.
- Never "follow me" — click happens organically.

**Time**
Embedded στο 30min scroll — typically 8-12 min focused on comments.

**Common mistakes**
- Hedging language ("maybe", "I think") → invisible.
- Comment on flat-velocity videos → wasted.
- Same comment type κάθε μέρα → pattern-flagged.
- Mention OF/link → spam ban.
- Skip the log → no idea what works.

**Escalation**
- 1-week zero comment lift → review with Marketing Manager (account possibly shadowbanned).
- Mass-reply troll from outbound comment → ignore + report, never engage.',
  cadence_type = 'daily',
  cadence_note = 'Καθημερινά, embedded στο scroll session',
  department = ARRAY['1c6713c4-ffa4-468e-bc2f-bb972cd24182']::uuid[],
  is_active = true,
  updated_at = now()
FROM public.sop_roles r
WHERE r.slug = 'marketing-executive'
  AND r.id = ANY(f.sop_role)
  AND f.sort_order = 12;


INSERT INTO public.sop_functions (
  function_id, name, kpi, standard_type, sop_content, cadence_type, cadence_note,
  sort_order, department, sop_role, is_active, content_version, created_at, updated_at
)
SELECT
  'sop_fn_me_gr_13',
  'F4F + scrolling + likes routine (engagement)',
  'Follow amounts per assigned Task checklist· ratio healthy· hard cap respected',
  'text',
  '**Σκοπός**
Daily engagement routine — F4F (Alt accounts), unfollow stale, scroll algorithm-training, niche post + story likes. Follow amounts defined στο assigned Task checklist — όχι hardcoded targets εδώ.

**Πότε**
Καθημερινά, σε όλα τα accounts. Order: **Scrolling → Likes → F4F → Unfollow (delayed 5-7 days)**.

**Tools**
- IG/TT/FB app
- Niche shortlist (creators to F4F from)
- Assigned Task checklist (follow/like targets)

**Steps**
1. **Scrolling** — Reels/FYP tab, niche only. Watch to completion. Skip <2s = negative signal, do not.
2. **Post likes** — amounts per assigned Task checklist, 5-sec pause between. Niche only.
3. **Story likes** — per Task checklist, mix likes + short replies.
4. **F4F (Alt accounts):** follow amounts per Task checklist, **1 follow per 5-10 sec**. Niche-relevant only. Glance at 1-2 posts before following.
5. **F4F (Main):** follow amounts per Task checklist, split 2-3 sessions.
6. **Unfollow** (Alt) — anyone who hasn''t followed back 5-7 days. Never mass-unfollow. Spread δια της ημέρας.
7. **Hard cap (safety ceiling):** 150 follows + 200 likes per device per day combined across all accounts — never exceed even if Task asks more.

**Time**
45-60 min daily total.

**Common mistakes**
- Scroll Following tab αντί FYP → wrong algorithm signal.
- Skip videos σε <2s → negative preference signal.
- Mass-follow burst → instant flag. Likes burst → spam.
- Exceed 150/200 device hard cap.
- Mass-unfollow σε 1 batch → shadowban.

**Escalation**
- Action block popup → STOP follows/likes/comments, continue posting/stories/DMs, report + wait 48h.
- Follow ratio broken (following >> followers >2:1) → unfollow cycle, ping Marketing Manager.',
  'daily',
  'Καθημερινά, ανά account — Alt accounts F4F primary',
  13,
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
    WHERE r.id = ANY(f.sop_role) AND f.sort_order = 13
  );

UPDATE public.sop_functions f SET
  name = 'F4F + scrolling + likes routine (engagement)',
  kpi = 'Follow amounts per assigned Task checklist· ratio healthy· hard cap respected',
  sop_content = '**Σκοπός**
Daily engagement routine — F4F (Alt accounts), unfollow stale, scroll algorithm-training, niche post + story likes. Follow amounts defined στο assigned Task checklist — όχι hardcoded targets εδώ.

**Πότε**
Καθημερινά, σε όλα τα accounts. Order: **Scrolling → Likes → F4F → Unfollow (delayed 5-7 days)**.

**Tools**
- IG/TT/FB app
- Niche shortlist (creators to F4F from)
- Assigned Task checklist (follow/like targets)

**Steps**
1. **Scrolling** — Reels/FYP tab, niche only. Watch to completion. Skip <2s = negative signal, do not.
2. **Post likes** — amounts per assigned Task checklist, 5-sec pause between. Niche only.
3. **Story likes** — per Task checklist, mix likes + short replies.
4. **F4F (Alt accounts):** follow amounts per Task checklist, **1 follow per 5-10 sec**. Niche-relevant only. Glance at 1-2 posts before following.
5. **F4F (Main):** follow amounts per Task checklist, split 2-3 sessions.
6. **Unfollow** (Alt) — anyone who hasn''t followed back 5-7 days. Never mass-unfollow. Spread δια της ημέρας.
7. **Hard cap (safety ceiling):** 150 follows + 200 likes per device per day combined across all accounts — never exceed even if Task asks more.

**Time**
45-60 min daily total.

**Common mistakes**
- Scroll Following tab αντί FYP → wrong algorithm signal.
- Skip videos σε <2s → negative preference signal.
- Mass-follow burst → instant flag. Likes burst → spam.
- Exceed 150/200 device hard cap.
- Mass-unfollow σε 1 batch → shadowban.

**Escalation**
- Action block popup → STOP follows/likes/comments, continue posting/stories/DMs, report + wait 48h.
- Follow ratio broken (following >> followers >2:1) → unfollow cycle, ping Marketing Manager.',
  cadence_type = 'daily',
  cadence_note = 'Καθημερινά, ανά account — Alt accounts F4F primary',
  department = ARRAY['1c6713c4-ffa4-468e-bc2f-bb972cd24182']::uuid[],
  is_active = true,
  updated_at = now()
FROM public.sop_roles r
WHERE r.slug = 'marketing-executive'
  AND r.id = ANY(f.sop_role)
  AND f.sort_order = 13;


INSERT INTO public.sop_functions (
  function_id, name, kpi, standard_type, sop_content, cadence_type, cadence_note,
  sort_order, department, sop_role, is_active, content_version, created_at, updated_at
)
SELECT
  'sop_fn_me_gr_14',
  'End-of-day Discord/Telegram report',
  '100% daily reports posted πριν end-of-shift, all blocks/anomalies flagged same-day',
  'text',
  '**Σκοπός**
End-of-shift report στο Daily Reports channel — accounts worked, posts made, blocks, anomalies. Management Team needs this for pattern detection + next-day prep.

**Πότε**
Καθημερινά, τέλος shift. Marketing Executive report είναι πιο detailed από άλλα roles.

**Tools**
- Discord/Telegram → Daily Reports channel
- Daily posting log sheet

**Steps**
1. Open Daily Reports channel.
2. Post (no template, just clear structure):
   - **Accounts worked today:** list per creator.
   - **Posts made:** count per platform per account (e.g. "Creator X: 2 IG Reels + 1 TT + 1 FB cross-post + 1 CTA story").
   - **Trials posted:** count + which variant tier.
   - **F4F numbers:** follows/unfollows/likes per account.
   - **DM funnel:** approximate DM count + funneled count.
   - **Blocks/issues:** anything που σε σταμάτησε (action block, missing brief, broken link, equipment issue).
   - **Tomorrow blockers:** missing assets/briefs/credentials.
3. Tag Marketing Manager αν υπάρχει urgent block.
4. Keep <300 λέξεις. Short + clear.

**Time**
5-8 λεπτά.

**Common mistakes**
- Skip report "γιατί ήταν ήσυχη μέρα" — Management Team χάνει visibility.
- Long-form essay — buries the signal.
- Combine με Questions ("btw also, what about X?") — wrong channel, lost.
- Forget να flag blocks → next morning same problem repeats.
- Tag Manager με κάθε trivial issue → noise.

**Escalation**
- Account ban / lock / orange flag — separate ping στο Account Defense channel + COO if Power Page.
- Equipment broken (device crashed, SIM dead) — Management Team same-day.
- Creator unresponsive 24h+ → flag στο report + CSM.',
  'daily',
  'Καθημερινά τέλος shift, στο Daily Reports channel',
  14,
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
    WHERE r.id = ANY(f.sop_role) AND f.sort_order = 14
  );

UPDATE public.sop_functions f SET
  name = 'End-of-day Discord/Telegram report',
  kpi = '100% daily reports posted πριν end-of-shift, all blocks/anomalies flagged same-day',
  sop_content = '**Σκοπός**
End-of-shift report στο Daily Reports channel — accounts worked, posts made, blocks, anomalies. Management Team needs this for pattern detection + next-day prep.

**Πότε**
Καθημερινά, τέλος shift. Marketing Executive report είναι πιο detailed από άλλα roles.

**Tools**
- Discord/Telegram → Daily Reports channel
- Daily posting log sheet

**Steps**
1. Open Daily Reports channel.
2. Post (no template, just clear structure):
   - **Accounts worked today:** list per creator.
   - **Posts made:** count per platform per account (e.g. "Creator X: 2 IG Reels + 1 TT + 1 FB cross-post + 1 CTA story").
   - **Trials posted:** count + which variant tier.
   - **F4F numbers:** follows/unfollows/likes per account.
   - **DM funnel:** approximate DM count + funneled count.
   - **Blocks/issues:** anything που σε σταμάτησε (action block, missing brief, broken link, equipment issue).
   - **Tomorrow blockers:** missing assets/briefs/credentials.
3. Tag Marketing Manager αν υπάρχει urgent block.
4. Keep <300 λέξεις. Short + clear.

**Time**
5-8 λεπτά.

**Common mistakes**
- Skip report "γιατί ήταν ήσυχη μέρα" — Management Team χάνει visibility.
- Long-form essay — buries the signal.
- Combine με Questions ("btw also, what about X?") — wrong channel, lost.
- Forget να flag blocks → next morning same problem repeats.
- Tag Manager με κάθε trivial issue → noise.

**Escalation**
- Account ban / lock / orange flag — separate ping στο Account Defense channel + COO if Power Page.
- Equipment broken (device crashed, SIM dead) — Management Team same-day.
- Creator unresponsive 24h+ → flag στο report + CSM.',
  cadence_type = 'daily',
  cadence_note = 'Καθημερινά τέλος shift, στο Daily Reports channel',
  department = ARRAY['1c6713c4-ffa4-468e-bc2f-bb972cd24182']::uuid[],
  is_active = true,
  updated_at = now()
FROM public.sop_roles r
WHERE r.slug = 'marketing-executive'
  AND r.id = ANY(f.sop_role)
  AND f.sort_order = 14;


INSERT INTO public.sop_functions (
  function_id, name, kpi, standard_type, sop_content, cadence_type, cadence_note,
  sort_order, department, sop_role, is_active, content_version, created_at, updated_at
)
SELECT
  'sop_fn_me_gr_15',
  'Account Defense compliance (shared ownership)',
  '0 rule violations/session, 100% always-on rules followed, all flags reported same-minute, EOD compliance log 100% filled',
  'text',
  '**Σκοπός**

**Πότε**
Always-on κάθε session — όλα τα rules ισχύουν continuously. Explicit self-check στο EOD report.

**Tools**
- Ultimate Account Safety & Restrictions SOP (Notion) — primary reference
- Account Status page (per platform, Settings → Account Status)
- Discord/Telegram Account Defense channel
- EOD compliance log (daily report template)

**Daily compliance — 12 always-on rules**

1. **Device:** Μόνο assigned device, physical SIM in, iCloud Backup + Find My OFF, no personal accounts logged in.
3. **Warm-up:** 15-min warm-up πριν κάθε action — scroll, like 3-5 random, watch 5-10 stories, send 1-2 reels via DM. Never post-and-ghost (stay 5min post-post).
4. **Visual content:** Zero prohibited content (nipples, see-through, zooms, sexual gestures). Lifestyle-first.
5. **Caption:** Zero forbidden words ("OnlyFans", "OF", "exclusive content", "dm for content", "link for more"). No emoji combos that flag.
6. **Posting mix:** 70-80% safe, 20-30% slight edge. Max 3 Reels/24h/account. Unique PFP + bio + highlights per account.
8. **Hashtags:** Verify κάθε νέο hashtag πριν χρήση. Max 5/post. Rotate σετ κάθε 3-4 posts. Zero sexual keywords στα tags.
9. **Stories & link sticker:** Link sticker μόνο σε verified ή με explicit Manager approval. Never direct OF link.
10. **Action limits:** Max 150 follows/day **per device** (combined across accounts), max 200 likes/day per device. Never run actions σε δύο devices ταυτόχρονα. Never send το ίδιο DM σε multiple users. Never include link σε DM.
11. **Bio & links:** Zero "OnlyFans"/"OF" mention οπουδήποτε (bio/captions/comments/DMs/stories/other platforms). Zero direct link σε bio/caption/DM.
12. **Account Center:** Never connect IG-FB-Threads μέσω Meta Account Center χωρίς Marketing Manager approval. Periodically check για unauthorized connections.

**Early signal capture (always-on)**
- Orange flag σε Account Status → screenshot + report Head of Account Defense μέσα σε λεπτά.
- Action block popup → STOP που χρειάζεται, continue που επιτρέπεται (per ban triage SOP), report.
- Sudden reach drop >50% σε 24h → screenshot insights + report — πιθανός shadowban.
- Mass-removed content → screenshot + report.
- Login security check → screenshot + STOP, do not approve μόνος, report.

**EOD self-check (5 λεπτά)**
Στο daily Discord/Telegram report περίλαβε:
- Devices χρησιμοποιήθηκαν today + Wi-Fi ποτέ ON (Y/N)
- Total follows + likes per device (vs 150/200 cap)
- Hashtags rotated (Y/N)
- Account Center clean (Y/N)
- Flags spotted today (list ή "0")

**Time**

**Common mistakes**
- "Μόνο 2 λεπτά Wi-Fi για κάτι quick" → instant cross-account link.
- Skip warm-up "γιατί είμαι πιεσμένος" → first post triggers shadowban.
- Push 4ο-5ο edgy post in a row → algorithmic flag.
- Burst follows (50+ in 10min) → action block.
- Connect IG-FB through Meta Account Center "για ευκολία" → trust score drop όλων.
- Σιωπή σε orange flag "για να μη φωνάξει ο Manager" → escalates σε disable.

**Escalation**
- Orange flag any platform → **immediate** Head of Account Defense + screenshot + STOP affected actions.
- Action block / restriction popup → per ban triage SOP scenarios + report.
- Unauthorized Account Center connection detected → immediate Head of Account Defense + Marketing Manager + do not break connection χωρίς instruction.
- Repeated VA violation από colleague (spotted στο shared device pool) → report Marketing Manager + COO (peer accountability).
- Permanent ban → Head of Account Defense owns appeal/closure. VA does not act independently.

**Reference**
Full rules: Ultimate Account Safety & Restrictions SOP (Notion). Ban treatment: IG + FB Ban & Restriction Treatment SOP. Triage workflow: Ban triage SOP σε αυτό το library.',
  'daily',
  'Always-on κάθε session + explicit EOD self-check',
  15,
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
    WHERE r.id = ANY(f.sop_role) AND f.sort_order = 15
  );

UPDATE public.sop_functions f SET
  name = 'Account Defense compliance (shared ownership)',
  kpi = '0 rule violations/session, 100% always-on rules followed, all flags reported same-minute, EOD compliance log 100% filled',
  sop_content = '**Σκοπός**

**Πότε**
Always-on κάθε session — όλα τα rules ισχύουν continuously. Explicit self-check στο EOD report.

**Tools**
- Ultimate Account Safety & Restrictions SOP (Notion) — primary reference
- Account Status page (per platform, Settings → Account Status)
- Discord/Telegram Account Defense channel
- EOD compliance log (daily report template)

**Daily compliance — 12 always-on rules**

1. **Device:** Μόνο assigned device, physical SIM in, iCloud Backup + Find My OFF, no personal accounts logged in.
3. **Warm-up:** 15-min warm-up πριν κάθε action — scroll, like 3-5 random, watch 5-10 stories, send 1-2 reels via DM. Never post-and-ghost (stay 5min post-post).
4. **Visual content:** Zero prohibited content (nipples, see-through, zooms, sexual gestures). Lifestyle-first.
5. **Caption:** Zero forbidden words ("OnlyFans", "OF", "exclusive content", "dm for content", "link for more"). No emoji combos that flag.
6. **Posting mix:** 70-80% safe, 20-30% slight edge. Max 3 Reels/24h/account. Unique PFP + bio + highlights per account.
8. **Hashtags:** Verify κάθε νέο hashtag πριν χρήση. Max 5/post. Rotate σετ κάθε 3-4 posts. Zero sexual keywords στα tags.
9. **Stories & link sticker:** Link sticker μόνο σε verified ή με explicit Manager approval. Never direct OF link.
10. **Action limits:** Max 150 follows/day **per device** (combined across accounts), max 200 likes/day per device. Never run actions σε δύο devices ταυτόχρονα. Never send το ίδιο DM σε multiple users. Never include link σε DM.
11. **Bio & links:** Zero "OnlyFans"/"OF" mention οπουδήποτε (bio/captions/comments/DMs/stories/other platforms). Zero direct link σε bio/caption/DM.
12. **Account Center:** Never connect IG-FB-Threads μέσω Meta Account Center χωρίς Marketing Manager approval. Periodically check για unauthorized connections.

**Early signal capture (always-on)**
- Orange flag σε Account Status → screenshot + report Head of Account Defense μέσα σε λεπτά.
- Action block popup → STOP που χρειάζεται, continue που επιτρέπεται (per ban triage SOP), report.
- Sudden reach drop >50% σε 24h → screenshot insights + report — πιθανός shadowban.
- Mass-removed content → screenshot + report.
- Login security check → screenshot + STOP, do not approve μόνος, report.

**EOD self-check (5 λεπτά)**
Στο daily Discord/Telegram report περίλαβε:
- Devices χρησιμοποιήθηκαν today + Wi-Fi ποτέ ON (Y/N)
- Total follows + likes per device (vs 150/200 cap)
- Hashtags rotated (Y/N)
- Account Center clean (Y/N)
- Flags spotted today (list ή "0")

**Time**

**Common mistakes**
- "Μόνο 2 λεπτά Wi-Fi για κάτι quick" → instant cross-account link.
- Skip warm-up "γιατί είμαι πιεσμένος" → first post triggers shadowban.
- Push 4ο-5ο edgy post in a row → algorithmic flag.
- Burst follows (50+ in 10min) → action block.
- Connect IG-FB through Meta Account Center "για ευκολία" → trust score drop όλων.
- Σιωπή σε orange flag "για να μη φωνάξει ο Manager" → escalates σε disable.

**Escalation**
- Orange flag any platform → **immediate** Head of Account Defense + screenshot + STOP affected actions.
- Action block / restriction popup → per ban triage SOP scenarios + report.
- Unauthorized Account Center connection detected → immediate Head of Account Defense + Marketing Manager + do not break connection χωρίς instruction.
- Repeated VA violation από colleague (spotted στο shared device pool) → report Marketing Manager + COO (peer accountability).
- Permanent ban → Head of Account Defense owns appeal/closure. VA does not act independently.

**Reference**
Full rules: Ultimate Account Safety & Restrictions SOP (Notion). Ban treatment: IG + FB Ban & Restriction Treatment SOP. Triage workflow: Ban triage SOP σε αυτό το library.',
  cadence_type = 'daily',
  cadence_note = 'Always-on κάθε session + explicit EOD self-check',
  department = ARRAY['1c6713c4-ffa4-468e-bc2f-bb972cd24182']::uuid[],
  is_active = true,
  updated_at = now()
FROM public.sop_roles r
WHERE r.slug = 'marketing-executive'
  AND r.id = ANY(f.sop_role)
  AND f.sort_order = 15;


