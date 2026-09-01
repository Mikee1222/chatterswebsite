-- marketing_executive SOP functions batch 1

INSERT INTO public.sop_functions (
  function_id, name, kpi, standard_type, sop_content, cadence_type, cadence_note,
  sort_order, department, sop_role, is_active, content_version, created_at, updated_at
)
SELECT
  'sop_fn_me_gr_1',
  'Account status check (morning)',
  '100% sessions ξεκινούν με Account Status check· 0 incidents από missed status review',
  'text',
  '**Σκοπός**
Πριν αγγίξεις οποιοδήποτε account, verify ότι το Account Status είναι πράσινο σε όλα τα handles που θα δουλέψεις σήμερα. Το device είναι farm-controlled — δεν χρειάζεται IP management από εσένα.

**Πότε**
Πρώτο task κάθε session, και ξανά κάθε φορά που switch-άρεις account στο ίδιο device.

**Tools**
- Phone (work device — assigned hardware)
- IG/FB/TT app → Settings → Account Status

**Steps**
1. Verify ότι το device είναι σε mobile data — Wi-Fi OFF, eSIM/VPN/Proxy OFF.
2. Άνοιξε κάθε account που θα δουλέψεις → Settings → Account Status. Όλα πρέπει να είναι πράσινα.
3. Αν δεις πορτοκαλί flag → screenshot αμέσως + ping Marketing Manager. ΜΗΝ ξεκινήσεις posting/engagement μέχρι να έχεις οδηγία.
4. Log στο daily sheet: timestamp + status per account.

**Time**
2–3 λεπτά (κλιμακώνεται με τον αριθμό accounts στο device).

**Common mistakes**
- Skip Account Status έτσι ώστε να μην χάσεις χρόνο — όλα τα bans ξεκινούν από orange που αγνοήθηκε.
- Συνεχίζεις posting με orange flag — accelerates στο shadowban/disable.
- Turning on Wi-Fi "μόνο για 2 λεπτά" — security violation.

**Escalation**
- Orange στο Account Status → Marketing Manager + screenshot.
- Action block popup → STOP likes/follows/comments, continue μόνο posting/stories/DM replies, report.',
  'daily',
  'Καθημερινά, πριν κάθε session — πρώτο task',
  1,
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
    WHERE r.id = ANY(f.sop_role) AND f.sort_order = 1
  );

UPDATE public.sop_functions f SET
  name = 'Account status check (morning)',
  kpi = '100% sessions ξεκινούν με Account Status check· 0 incidents από missed status review',
  sop_content = '**Σκοπός**
Πριν αγγίξεις οποιοδήποτε account, verify ότι το Account Status είναι πράσινο σε όλα τα handles που θα δουλέψεις σήμερα. Το device είναι farm-controlled — δεν χρειάζεται IP management από εσένα.

**Πότε**
Πρώτο task κάθε session, και ξανά κάθε φορά που switch-άρεις account στο ίδιο device.

**Tools**
- Phone (work device — assigned hardware)
- IG/FB/TT app → Settings → Account Status

**Steps**
1. Verify ότι το device είναι σε mobile data — Wi-Fi OFF, eSIM/VPN/Proxy OFF.
2. Άνοιξε κάθε account που θα δουλέψεις → Settings → Account Status. Όλα πρέπει να είναι πράσινα.
3. Αν δεις πορτοκαλί flag → screenshot αμέσως + ping Marketing Manager. ΜΗΝ ξεκινήσεις posting/engagement μέχρι να έχεις οδηγία.
4. Log στο daily sheet: timestamp + status per account.

**Time**
2–3 λεπτά (κλιμακώνεται με τον αριθμό accounts στο device).

**Common mistakes**
- Skip Account Status έτσι ώστε να μην χάσεις χρόνο — όλα τα bans ξεκινούν από orange που αγνοήθηκε.
- Συνεχίζεις posting με orange flag — accelerates στο shadowban/disable.
- Turning on Wi-Fi "μόνο για 2 λεπτά" — security violation.

**Escalation**
- Orange στο Account Status → Marketing Manager + screenshot.
- Action block popup → STOP likes/follows/comments, continue μόνο posting/stories/DM replies, report.',
  cadence_type = 'daily',
  cadence_note = 'Καθημερινά, πριν κάθε session — πρώτο task',
  department = ARRAY['1c6713c4-ffa4-468e-bc2f-bb972cd24182']::uuid[],
  is_active = true,
  updated_at = now()
FROM public.sop_roles r
WHERE r.slug = 'marketing-executive'
  AND r.id = ANY(f.sop_role)
  AND f.sort_order = 1;


INSERT INTO public.sop_functions (
  function_id, name, kpi, standard_type, sop_content, cadence_type, cadence_note,
  sort_order, department, sop_role, is_active, content_version, created_at, updated_at
)
SELECT
  'sop_fn_me_gr_2',
  'Master Account check & device assignment verify (morning)',
  '0 cross-device incidents, 100% posts γίνονται από το σωστό assigned device',
  'text',
  '**Σκοπός**
Πριν post-άρεις για κάποιον creator, verify το Master Account spec (template, bio, highlights) και ότι είσαι σε **σωστό device** για το συγκεκριμένο handle. Cross-contamination = mass-ban risk.

**Πότε**
Καθημερινά, πριν post-άρεις για κάθε creator (και ξανά αν αλλάζεις creator μέσα στη μέρα).

**Tools**
- Account Master Reference (Notion)
- Device-to-creator mapping sheet (από Head of Account Defense)
- Password manager

**Steps**
1. Άνοιξε Account Master Reference και find τον creator σου.
2. Verify ότι κρατάς το **assigned device** για αυτόν τον creator. Different device = STOP, ping Head of Account Defense.
3. Cross-check bio + profile pic + highlights στο live account vs template. Αν κάτι δεν matchάρει (random highlight, wrong PFP) → flag στο Marketing Manager.
4. Verify ότι δεν υπάρχει connection στο Meta Account Center με unauthorized handles.
5. Quick scan: highlights stale? (>2 weeks no update) → add στη weekly maintenance list.
6. Confirm credentials accessible από password manager (όχι plain text, όχι sticky note).

**Time**
2-3 λεπτά ανά creator/account.

**Common mistakes**
- Posting από personal phone "μόνο μια φορά" → instant cross-link.
- Profile pic identical με άλλο account creator → Meta fingerprint match.
- Skip Master check όταν δείχνει "OK" — drift συμβαίνει σιωπηλά.
- Logging σε personal Apple ID στο work device → mass-ban risk.

**Escalation**
- Wrong device → Head of Account Defense + STOP.
- Meta Account Center shows unauthorized link → Marketing Manager αμέσως.
- Stale highlights >2 weeks → add στο weekly task, not blocker.',
  'daily',
  'Καθημερινά πριν posting, ανά creator που θα δουλέψεις',
  2,
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
    WHERE r.id = ANY(f.sop_role) AND f.sort_order = 2
  );

UPDATE public.sop_functions f SET
  name = 'Master Account check & device assignment verify (morning)',
  kpi = '0 cross-device incidents, 100% posts γίνονται από το σωστό assigned device',
  sop_content = '**Σκοπός**
Πριν post-άρεις για κάποιον creator, verify το Master Account spec (template, bio, highlights) και ότι είσαι σε **σωστό device** για το συγκεκριμένο handle. Cross-contamination = mass-ban risk.

**Πότε**
Καθημερινά, πριν post-άρεις για κάθε creator (και ξανά αν αλλάζεις creator μέσα στη μέρα).

**Tools**
- Account Master Reference (Notion)
- Device-to-creator mapping sheet (από Head of Account Defense)
- Password manager

**Steps**
1. Άνοιξε Account Master Reference και find τον creator σου.
2. Verify ότι κρατάς το **assigned device** για αυτόν τον creator. Different device = STOP, ping Head of Account Defense.
3. Cross-check bio + profile pic + highlights στο live account vs template. Αν κάτι δεν matchάρει (random highlight, wrong PFP) → flag στο Marketing Manager.
4. Verify ότι δεν υπάρχει connection στο Meta Account Center με unauthorized handles.
5. Quick scan: highlights stale? (>2 weeks no update) → add στη weekly maintenance list.
6. Confirm credentials accessible από password manager (όχι plain text, όχι sticky note).

**Time**
2-3 λεπτά ανά creator/account.

**Common mistakes**
- Posting από personal phone "μόνο μια φορά" → instant cross-link.
- Profile pic identical με άλλο account creator → Meta fingerprint match.
- Skip Master check όταν δείχνει "OK" — drift συμβαίνει σιωπηλά.
- Logging σε personal Apple ID στο work device → mass-ban risk.

**Escalation**
- Wrong device → Head of Account Defense + STOP.
- Meta Account Center shows unauthorized link → Marketing Manager αμέσως.
- Stale highlights >2 weeks → add στο weekly task, not blocker.',
  cadence_type = 'daily',
  cadence_note = 'Καθημερινά πριν posting, ανά creator που θα δουλέψεις',
  department = ARRAY['1c6713c4-ffa4-468e-bc2f-bb972cd24182']::uuid[],
  is_active = true,
  updated_at = now()
FROM public.sop_roles r
WHERE r.slug = 'marketing-executive'
  AND r.id = ANY(f.sop_role)
  AND f.sort_order = 2;


INSERT INTO public.sop_functions (
  function_id, name, kpi, standard_type, sop_content, cadence_type, cadence_note,
  sort_order, department, sop_role, is_active, content_version, created_at, updated_at
)
SELECT
  'sop_fn_me_gr_3',
  'iCloud content pull & Templates & Assets check (morning)',
  '100% σήμερα τα briefs/files identified πριν 12:00, 0 posting delays λόγω missing assets',
  'text',
  '**Σκοπός**
Συγκέντρωσε όλα τα content assets που χρειάζεσαι για τη μέρα: today''s brief από Content Director, video files στο iCloud, και templates από το Templates & Assets channel.

**Πότε**

**Tools**
- iCloud folders per creator:
  - **Social Media Posts:** Model → Content to Upload → Social Media Posts → Year → Month → Carousel 1, 2…
  - **Stories:** Model → Content to Upload → Stories To Upload → CTA or Daily → Year → Month → Week → Day (weeks 1–7, 8–15, κ.λπ.)
  - **Videos:** Model → Content to Upload → Video To Upload → Year → Month → Week → Day → Main Account ή Secondary Account → Trial ή Grid
- Telegram → Templates & Assets channel
- Discord → today''s brief / caption drop from Marketing Manager

**Steps**
1. Open Discord/Telegram → check σημερινό brief: captions, hooks, posting concepts.
2. Open iCloud → `Model → Content to Upload → Video To Upload → … → Trial ή Grid` → identify videos στο Video To Upload path (Main/Secondary → Trial ή Grid).
3. Open `Model → Content to Upload → Video To Upload → … → Trial` — αν δεν είναι ready, ping iCloud Manager.
4. Open Templates & Assets channel — pull ready stories/captions πριν φτιάξεις από scratch.
5. Pre-check: όλα τα videos είναι 9:16 vertical.
6. Mental plan: ποιο post πάει πού, τι ώρα, ποιο account.

**Time**
10-15 λεπτά.

**Common mistakes**
- Build από scratch ενώ υπάρχει template — duplicate effort + inconsistent voice.
- Δεν τσεκάρεις iCloud πριν posting → discover το missing brief στις 12:00.
- Use file που έχει ήδη pageά "Used" → duplicate detection penalty.

**Escalation**
- Missing brief για τη μέρα >10:00 → ping Marketing Manager + Content Director.
- Trial subfolder empty → iCloud Manager.
- Template gap (no caption fits) → flag στο Questions channel.',
  'daily',
  'Καθημερινά πρωί, πριν posting',
  3,
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
    WHERE r.id = ANY(f.sop_role) AND f.sort_order = 3
  );

UPDATE public.sop_functions f SET
  name = 'iCloud content pull & Templates & Assets check (morning)',
  kpi = '100% σήμερα τα briefs/files identified πριν 12:00, 0 posting delays λόγω missing assets',
  sop_content = '**Σκοπός**
Συγκέντρωσε όλα τα content assets που χρειάζεσαι για τη μέρα: today''s brief από Content Director, video files στο iCloud, και templates από το Templates & Assets channel.

**Πότε**

**Tools**
- iCloud folders per creator:
  - **Social Media Posts:** Model → Content to Upload → Social Media Posts → Year → Month → Carousel 1, 2…
  - **Stories:** Model → Content to Upload → Stories To Upload → CTA or Daily → Year → Month → Week → Day (weeks 1–7, 8–15, κ.λπ.)
  - **Videos:** Model → Content to Upload → Video To Upload → Year → Month → Week → Day → Main Account ή Secondary Account → Trial ή Grid
- Telegram → Templates & Assets channel
- Discord → today''s brief / caption drop from Marketing Manager

**Steps**
1. Open Discord/Telegram → check σημερινό brief: captions, hooks, posting concepts.
2. Open iCloud → `Model → Content to Upload → Video To Upload → … → Trial ή Grid` → identify videos στο Video To Upload path (Main/Secondary → Trial ή Grid).
3. Open `Model → Content to Upload → Video To Upload → … → Trial` — αν δεν είναι ready, ping iCloud Manager.
4. Open Templates & Assets channel — pull ready stories/captions πριν φτιάξεις από scratch.
5. Pre-check: όλα τα videos είναι 9:16 vertical.
6. Mental plan: ποιο post πάει πού, τι ώρα, ποιο account.

**Time**
10-15 λεπτά.

**Common mistakes**
- Build από scratch ενώ υπάρχει template — duplicate effort + inconsistent voice.
- Δεν τσεκάρεις iCloud πριν posting → discover το missing brief στις 12:00.
- Use file που έχει ήδη pageά "Used" → duplicate detection penalty.

**Escalation**
- Missing brief για τη μέρα >10:00 → ping Marketing Manager + Content Director.
- Trial subfolder empty → iCloud Manager.
- Template gap (no caption fits) → flag στο Questions channel.',
  cadence_type = 'daily',
  cadence_note = 'Καθημερινά πρωί, πριν posting',
  department = ARRAY['1c6713c4-ffa4-468e-bc2f-bb972cd24182']::uuid[],
  is_active = true,
  updated_at = now()
FROM public.sop_roles r
WHERE r.slug = 'marketing-executive'
  AND r.id = ANY(f.sop_role)
  AND f.sort_order = 3;


INSERT INTO public.sop_functions (
  function_id, name, kpi, standard_type, sop_content, cadence_type, cadence_note,
  sort_order, department, sop_role, is_active, content_version, created_at, updated_at
)
SELECT
  'sop_fn_me_gr_4',
  'Account warm-up routine (daily 15-min)',
  '100% accounts warm-up''d πριν post, 0 post-and-ghost incidents',
  'text',
  '**Σκοπός**
15λεπτο daily warm-up πριν κάθε action — trains το algorithm ότι το account είναι real user, όχι bot. Strongest trust-score signal Gunzo έχει.

**Πότε**
Καθημερινά πριν posting/engagement, ανά account. 
**Tools**
- IG/TT/FB app (αντίστοιχο για το platform)

**Steps**
1. Open app → Explore/Reels/FYP feed.
2. Scroll για 15 λεπτά, watch videos to completion (όχι skip στο 1 sec).
3. Like 3-5 random posts outside niche (φυσική behavior).
4. Watch 5-10 stories.
5. Send 1-2 reels via DM σε άλλα accounts (strongest human signal για algorithm).
6. Stay active 5 λεπτά μετά το warm-up — never post-and-ghost.
7. Μόνο μετά → ξεκίνα posting/engagement.

**Time**
15 λεπτά ανά account.

**Common mistakes**
- Skip warm-up "γιατί δεν έχω χρόνο" — single biggest reason για shadowban.
- Like 20 posts σε 30 δευτερόλεπτα → spam burst flag.
- Watch videos στο 1-2 sec → negative algorithm signal (worse από no view).
- Post αμέσως μετά το warm-up χωρίς το 5λεπτο active window.

**Escalation**
- Account δείχνει 0 engagement στο warm-up content μετά από 3 μέρες → ping Marketing Manager (possible shadowban).',
  'daily',
  'Καθημερινά πριν posting, ανά account',
  4,
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
    WHERE r.id = ANY(f.sop_role) AND f.sort_order = 4
  );

UPDATE public.sop_functions f SET
  name = 'Account warm-up routine (daily 15-min)',
  kpi = '100% accounts warm-up''d πριν post, 0 post-and-ghost incidents',
  sop_content = '**Σκοπός**
15λεπτο daily warm-up πριν κάθε action — trains το algorithm ότι το account είναι real user, όχι bot. Strongest trust-score signal Gunzo έχει.

**Πότε**
Καθημερινά πριν posting/engagement, ανά account. 
**Tools**
- IG/TT/FB app (αντίστοιχο για το platform)

**Steps**
1. Open app → Explore/Reels/FYP feed.
2. Scroll για 15 λεπτά, watch videos to completion (όχι skip στο 1 sec).
3. Like 3-5 random posts outside niche (φυσική behavior).
4. Watch 5-10 stories.
5. Send 1-2 reels via DM σε άλλα accounts (strongest human signal για algorithm).
6. Stay active 5 λεπτά μετά το warm-up — never post-and-ghost.
7. Μόνο μετά → ξεκίνα posting/engagement.

**Time**
15 λεπτά ανά account.

**Common mistakes**
- Skip warm-up "γιατί δεν έχω χρόνο" — single biggest reason για shadowban.
- Like 20 posts σε 30 δευτερόλεπτα → spam burst flag.
- Watch videos στο 1-2 sec → negative algorithm signal (worse από no view).
- Post αμέσως μετά το warm-up χωρίς το 5λεπτο active window.

**Escalation**
- Account δείχνει 0 engagement στο warm-up content μετά από 3 μέρες → ping Marketing Manager (possible shadowban).',
  cadence_type = 'daily',
  cadence_note = 'Καθημερινά πριν posting, ανά account',
  department = ARRAY['1c6713c4-ffa4-468e-bc2f-bb972cd24182']::uuid[],
  is_active = true,
  updated_at = now()
FROM public.sop_roles r
WHERE r.slug = 'marketing-executive'
  AND r.id = ANY(f.sop_role)
  AND f.sort_order = 4;


INSERT INTO public.sop_functions (
  function_id, name, kpi, standard_type, sop_content, cadence_type, cadence_note,
  sort_order, department, sop_role, is_active, content_version, created_at, updated_at
)
SELECT
  'sop_fn_me_gr_5',
  'IG Reel/feed post (midday + evening)',
  '100% posts ανέβηκαν στην ώρα τους, 0 duplicate flags, posting log complete',
  'text',
  '**Σκοπός**
Daily IG Reel posting από Main + Alt accounts σε προκαθορισμένες ώρες, με σωστό caption, hashtags, cover.

**Πότε**
Main: **12:00** και **20:00**. Alt: +1 repurposed copy μέσα στη μέρα. Min 2h gap μεταξύ posts στο ίδιο account.

**Tools**
- iCloud → Video To Upload (assigned day/account)
- IG app
- Caption από Content Director (Discord/Telegram drop)
- Hashtag list approved

**Steps**
1. Account status check + warm-up done.
2. Download video από iCloud → Video To Upload → assigned day folder → Trial ή Grid.
3. IG → + → Reel → select.
4. Pick strong cover frame — όχι random.
5. Paste caption από Content Director **as-is** — μην το ξαναγράφεις.
6. Hashtags: 3-5 max, placed 3-4 line breaks κάτω από caption. Rotate set ανά 3-4 posts.
7. Audio: trending sound only αν ταιριάζει, αλλιώς original.
8. Verify Trial toggle: OFF για normal Reel, ON για trial (ξεχωριστή SOP).
9. Share → confirm live → screenshot.
10. Move file: Video To Upload → [Year] → [Month] → [Week] → [Day] → [Account] → Grid (posted).
11. Stay in app 1-2 minutes (active-user signal).
12. Log post στο daily sheet: account / time / post ID / first 30min views.

**Time**
8-12 λεπτά ανά post (κλιμακώνεται με upload speed).

**Common mistakes**
- Random cover frame → low click-rate.
- Caption rewrite "for better tone" — break consistency με tested winners.
- Same hashtag set on every post → algorithm flag.
- Identical file σε Main + Alt → duplicate penalty.
- Post + close app αμέσως → "post-and-ghost" penalty.
- Forget να move file στο posted subfolder → re-upload risk.

**Escalation**
- Post stuck στο 0 views >1h → possible shadowban, ping Marketing Manager.
- Audio missing/removed by IG → re-upload με different sound.
- Cover refuses to set → IG bug, force-quit + retry.',
  'daily',
  '12:00 και 20:00 ανά Main account, +1 repurposed στο Alt',
  5,
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
    WHERE r.id = ANY(f.sop_role) AND f.sort_order = 5
  );

UPDATE public.sop_functions f SET
  name = 'IG Reel/feed post (midday + evening)',
  kpi = '100% posts ανέβηκαν στην ώρα τους, 0 duplicate flags, posting log complete',
  sop_content = '**Σκοπός**
Daily IG Reel posting από Main + Alt accounts σε προκαθορισμένες ώρες, με σωστό caption, hashtags, cover.

**Πότε**
Main: **12:00** και **20:00**. Alt: +1 repurposed copy μέσα στη μέρα. Min 2h gap μεταξύ posts στο ίδιο account.

**Tools**
- iCloud → Video To Upload (assigned day/account)
- IG app
- Caption από Content Director (Discord/Telegram drop)
- Hashtag list approved

**Steps**
1. Account status check + warm-up done.
2. Download video από iCloud → Video To Upload → assigned day folder → Trial ή Grid.
3. IG → + → Reel → select.
4. Pick strong cover frame — όχι random.
5. Paste caption από Content Director **as-is** — μην το ξαναγράφεις.
6. Hashtags: 3-5 max, placed 3-4 line breaks κάτω από caption. Rotate set ανά 3-4 posts.
7. Audio: trending sound only αν ταιριάζει, αλλιώς original.
8. Verify Trial toggle: OFF για normal Reel, ON για trial (ξεχωριστή SOP).
9. Share → confirm live → screenshot.
10. Move file: Video To Upload → [Year] → [Month] → [Week] → [Day] → [Account] → Grid (posted).
11. Stay in app 1-2 minutes (active-user signal).
12. Log post στο daily sheet: account / time / post ID / first 30min views.

**Time**
8-12 λεπτά ανά post (κλιμακώνεται με upload speed).

**Common mistakes**
- Random cover frame → low click-rate.
- Caption rewrite "for better tone" — break consistency με tested winners.
- Same hashtag set on every post → algorithm flag.
- Identical file σε Main + Alt → duplicate penalty.
- Post + close app αμέσως → "post-and-ghost" penalty.
- Forget να move file στο posted subfolder → re-upload risk.

**Escalation**
- Post stuck στο 0 views >1h → possible shadowban, ping Marketing Manager.
- Audio missing/removed by IG → re-upload με different sound.
- Cover refuses to set → IG bug, force-quit + retry.',
  cadence_type = 'daily',
  cadence_note = '12:00 και 20:00 ανά Main account, +1 repurposed στο Alt',
  department = ARRAY['1c6713c4-ffa4-468e-bc2f-bb972cd24182']::uuid[],
  is_active = true,
  updated_at = now()
FROM public.sop_roles r
WHERE r.slug = 'marketing-executive'
  AND r.id = ANY(f.sop_role)
  AND f.sort_order = 5;


