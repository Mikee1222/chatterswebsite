export type MarketingExecutiveFunctionSeed = {
  sort_order: number;
  name: string;
  kpi: string;
  cadence_type: "daily" | "weekly" | "monthly" | "per_event";
  cadence_note: string;
  sop_content: string;
};

export const MARKETING_EXECUTIVE_FUNCTIONS: MarketingExecutiveFunctionSeed[] = [
  {
    sort_order: 1,
    name: `Account status check (morning)`,
    kpi: `100% sessions ξεκινούν με Account Status check· 0 incidents από missed status review`,
    cadence_type: `daily`,
    cadence_note: `Καθημερινά, πριν κάθε session — πρώτο task`,
    sop_content: `**Σκοπός**
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
- Action block popup → STOP likes/follows/comments, continue μόνο posting/stories/DM replies, report.`,
  },
  {
    sort_order: 2,
    name: `Master Account check & device assignment verify (morning)`,
    kpi: `0 cross-device incidents, 100% posts γίνονται από το σωστό assigned device`,
    cadence_type: `daily`,
    cadence_note: `Καθημερινά πριν posting, ανά creator που θα δουλέψεις`,
    sop_content: `**Σκοπός**
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
- Stale highlights >2 weeks → add στο weekly task, not blocker.`,
  },
  {
    sort_order: 3,
    name: `iCloud content pull & Templates & Assets check (morning)`,
    kpi: `100% σήμερα τα briefs/files identified πριν 12:00, 0 posting delays λόγω missing assets`,
    cadence_type: `daily`,
    cadence_note: `Καθημερινά πρωί, πριν posting`,
    sop_content: `**Σκοπός**
Συγκέντρωσε όλα τα content assets που χρειάζεσαι για τη μέρα: today's brief από Content Director, video files στο iCloud, και templates από το Templates & Assets channel.

**Πότε**

**Tools**
- iCloud folders per creator:
  - **Social Media Posts:** Model → Content to Upload → Social Media Posts → Year → Month → Carousel 1, 2…
  - **Stories:** Model → Content to Upload → Stories To Upload → CTA or Daily → Year → Month → Week → Day (weeks 1–7, 8–15, κ.λπ.)
  - **Videos:** Model → Content to Upload → Video To Upload → Year → Month → Week → Day → Main Account ή Secondary Account → Trial ή Grid
- Telegram → Templates & Assets channel
- Discord → today's brief / caption drop from Marketing Manager

**Steps**
1. Open Discord/Telegram → check σημερινό brief: captions, hooks, posting concepts.
2. Open iCloud → \`Model → Content to Upload → Video To Upload → … → Trial ή Grid\` → identify videos στο Video To Upload path (Main/Secondary → Trial ή Grid).
3. Open \`Model → Content to Upload → Video To Upload → … → Trial\` — αν δεν είναι ready, ping iCloud Manager.
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
- Template gap (no caption fits) → flag στο Questions channel.`,
  },
  {
    sort_order: 4,
    name: `Account warm-up routine (daily 15-min)`,
    kpi: `100% accounts warm-up'd πριν post, 0 post-and-ghost incidents`,
    cadence_type: `daily`,
    cadence_note: `Καθημερινά πριν posting, ανά account`,
    sop_content: `**Σκοπός**
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
- Account δείχνει 0 engagement στο warm-up content μετά από 3 μέρες → ping Marketing Manager (possible shadowban).`,
  },
  {
    sort_order: 5,
    name: `IG Reel/feed post (midday + evening)`,
    kpi: `100% posts ανέβηκαν στην ώρα τους, 0 duplicate flags, posting log complete`,
    cadence_type: `daily`,
    cadence_note: `12:00 και 20:00 ανά Main account, +1 repurposed στο Alt`,
    sop_content: `**Σκοπός**
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
- Cover refuses to set → IG bug, force-quit + retry.`,
  },
  {
    sort_order: 6,
    name: `TikTok daily post (midday)`,
    kpi: `2 TT posts/account/day· vertical 9:16 100%`,
    cadence_type: `daily`,
    cadence_note: `Ανά assigned Task schedule — 2 posts/account/day`,
    sop_content: `**Σκοπός**
Daily TikTok posting — video από assigned iCloud Video To Upload folder (Trial ή Grid path). Δεν επιλέγεις source· ακολουθείς το assigned Task.

**Πότε**
Ανά assigned Task schedule (2 posts/account/day). Order: **Scroll → Like → Post → F4F**.

**Tools**
- iCloud → Video To Upload (assigned day/account/Trial ή Grid)
- TikTok app
- Trending sounds library (TT)

**Steps**
1. 15-min FYP scroll (algorithm warm-up).
2. Download video από assigned iCloud Video To Upload folder.
3. TikTok → + → gallery → select.
4. Add **trending sound** — όχι original IG audio αν repurposed.
5. Caption: 1-2 short lines + 3-5 niche hashtags.
6. Verify vertical 9:16.
7. Post.
8. Stay in app 1-2 minutes (active-user signal).
9. Log post ID/link στο daily sheet.
10. Repeat για 2ο post/account σύμφωνα με Task schedule.

**Time**
6-10 λεπτά ανά post.

**Common mistakes**
- Original IG audio αντί trending TT sound → no velocity push.
- Long caption → kills retention.
- Photo-only post → TT default rejection.
- Post 2 videos μέσα σε 5 λεπτά → split reach.

**Escalation**
- Trial option missing → account not eligible, ping Marketing Manager.
- Assigned folder empty → iCloud Manager.`,
  },
  {
    sort_order: 7,
    name: `Facebook cross-post & accept requests (daily)`,
    kpi: `1 FB Reel cross-posted/day same-day, 100% legitimate friend requests accepted`,
    cadence_type: `daily`,
    cadence_note: `Καθημερινά, min 30min μετά το IG post`,
    sop_content: `**Σκοπός**
Daily FB Reel cross-post από IG (+50% distribution boost when same-day) + accept inbound friend requests. FB είναι live channel, όχι passive mirror.

**Πότε**
Καθημερινά. Order: **Cross Post → Accept Requests → Scrolling → Liking**. Min 30 min gap από IG upload στο ίδιο device.

**Tools**
- IG app (source)
- FB app

**Steps**
1. IG → find σημερινό Reel → download video στο phone.
2. FB → Reels → select video.
3. Caption: ίδιο με IG, optionally slightly different hook για FB.
4. Post.
5. Open Friend Requests → accept ΟΛΑ τα legitimate (όχι spam/non-target language/zero-photo profiles).
6. 20-30min Feed scroll, watch niche videos to completion.
7. 30-50 niche post likes με 5-sec gaps. 10-15 niche story likes.

**Time**
20-30 λεπτά (cross-post + accept + scroll).

**Common mistakes**
- Cross-post IG + FB ταυτόχρονα → FB flags as bot.
- Accept Arabic/spam requests → engagement rate tanks.
- 50 likes σε 2-minute burst → spam flag.
- Skip same-day crosspost → lose distribution boost.

**Escalation**
- FB locks accept feature → Marketing Manager (possible feature restriction).
- Friend requests stuck at 0 inbound για 3+ μέρες → re-engage groups (separate SOP).`,
  },
  {
    sort_order: 8,
    name: `Daily Stories cadence (lifestyle slots)`,
    kpi: `2 lifestyle/engagement stories/day· 100% mix· 0 explicit story bans`,
    cadence_type: `daily`,
    cadence_note: `Καθημερινά, 2 stories spread across day (creator local time)`,
    sop_content: `**Σκοπός**
Daily IG stories — closest touchpoint με audience. 2 lifestyle/engagement stories/day. Builds trust + warms audience πριν το CTA story.

**Πότε**
Καθημερινά, 2 stories spread across the day. Never batch. CTA story ακολουθεί weekly Link A/B schedule (model_story_link_config): Δευτέρα Link A, Τετάρτη Link B, Παρασκευή Highlights redirect, Σάββατο Link A.

**Tools**
- iCloud → Stories To Upload → Daily (assigned week/day)
- Templates & Assets channel (ready stickers/copy)
- IG app

**Steps**
1. Story 1 (morning/midday): lifestyle ή activity — coffee, gym, walk, outfit.
2. Story 2 (afternoon/evening): engagement sticker — poll, quiz, "this or that" ή suggestive tease (όχι explicit).
3. Reshare today's Reel στο story **μέσα στην 1η ώρα** του Reel post (velocity signal).
4. At least 2 stories/week με poll ή quiz sticker (boosts engagement rank).
5. Reply σε story replies <30 min ανά reply.

**Time**
10-15 λεπτά spread across day.

**Common mistakes**
- Batch και τα 2 stories morning → low read-rate.
- Explicit story → ban risk + downrank.
- Story replies αγνοούνται >30 min → χάνεις conversion window.

**Escalation**
- Link sticker unavailable → **Highlight redirect** (standard fallback — ποτέ bio για CTA). Ping Marketing Manager.
- 3 consecutive days με 0 story views → possible shadowban, escalate.`,
  },
  {
    sort_order: 9,
    name: `Evening CTA story με link sticker`,
    kpi: `1 CTA story/day posted στο 19:00-23:00 window, 100% link verified post-publish, 0 explicit ban incidents`,
    cadence_type: `daily`,
    cadence_note: `Καθημερινά 19:00-23:00, 1 story`,
    sop_content: `**Σκοπός**
The main daily CTA push — evening story με link sticker, sexy αλλά όχι explicit, curiosity-driven, drives clicks → OnlyFans funnel.

**Πότε**
Ανά weekly Link A/B schedule (model_story_link_config): Δευτέρα Link A, Τετάρτη Link B, Παρασκευή Highlights redirect, Σάββατο Link A. 1 CTA story στο assigned slot (επιπλέον των 2 lifestyle stories).

**Tools**
- iCloud → Stories To Upload → CTA (assigned week/day)
- OF link ή landing URL (clipboard ready)
- IG app

**Steps**
2. Tap **+** → Camera → upload approved photo.
3. Swipe up → sticker bar → **Link** sticker → paste link.
4. Caption: **max 3 λέξεις** + 1-3 emojis. Examples: "my secrets" / "ξέρεις πού" / "exclusive".
5. Position link sticker — όχι covering face/body/outfit reveal.
6. Tap Done → upload.
7. **Post-publish:** open το story → tap το link → verify ότι ανοίγει σωστή σελίδα. Broken → delete + repost.
8. Rotate wording daily — never το ίδιο caption 2 μέρες σε σειρά.

**Photo rules**
- Sexy clothes / lingerie covered / body-con / silhouette / mirror selfie — ΟΚ.
- Topless / explicit / nude — NEVER (OF only).
- Soft warm lighting, clean background, head-to-waist ή full body framing.

**Banned wording**
"OnlyFans", "OF", "nudes", "sexting", "porn", "xxx", "link in bio", "sugar daddy", "hookup".

**Time**
5-8 λεπτά.

**Common mistakes**
- Raw link χωρίς caption → zero context → zero clicks.
- Same caption κάθε μέρα → pattern-flag as bot.
- Caption >3 λέξεις → drop-off.
- Posting πριν 19:00 → off-peak, reach tanks.
- Link sticker covers face → broken visual.
- Forget να verify το link post-publish → broken funnel για 4h.

**Escalation**
- Link sticker unavailable → **Highlight redirect** (standard fallback — ποτέ bio για CTA). Escalate στο Marketing Manager.
- Story removed by IG → screenshot + Marketing Manager (content review).`,
  },
  {
    sort_order: 10,
    name: `Comment replies (own posts, 30-min window)`,
    kpi: `Top-liked comments answered <30min 100%, all comments <2h 100%, 0 banned replies`,
    cadence_type: `daily`,
    cadence_note: `Καθημερινά, ανά νέο post — top comments <30min, rest <2h`,
    sop_content: `**Σκοπός**
Reply σε όλα τα inbound comments στα posts του creator. Engagement velocity στις πρώτες 30' = strongest signal για viral push.

**Πότε**
Καθημερινά. **Top-liked comments: <30 min** από upload. Rest: <2h. Goal: 3+ reply thread → migrate σε DMs.

**Tools**
- IG/TT/FB app
- Account Master voice brief (creator tone)
- Reply category framework (8 categories)

**Steps**
1. Open post → tap comments → sort by Most Liked.
2. **Top comments first**: identify category (emoji-only / compliment / question / video positive / video negative / hate-troll / repeat high-intent / spam).
3. Write reply per category:
   - Emoji-only → playful + question back ("σου άρεσα;")
   - Compliment → confident playful ("έχω και καλύτερα")
   - Question → partial answer + mystery ("ξέρεις πού να με βρεις")
   - Video negative → flip με sharp irony, never anger
   - Hate/troll → 1 ironic line max, ή ignore
   - Spam/dick pic → hide/delete, no engagement
4. Like το original comment μετά το reply (doubles engagement signal).
5. Pin το best comment για extra reach.
6. 3+ replies από ίδιο user → migrate σε DMs (Conversion Funnel SOP).

**Banned replies**
"Ευχαριστώ" / "ναι" / "όχι" / "χαχα" / emoji-only / defensive explanations / "block" threats / explanation what OnlyFans is.

**Time**
15-30 λεπτά per post (κλιμακώνεται με engagement volume).

**Common mistakes**
- One-word replies → closes thread, kills algorithm signal.
- Copy-paste identical reply σε διαφορετικά comments → pattern flag.
- Engage τους trolls με anger → δίνεις τους reach.
- Skip top-liked στις πρώτες 30' → lose viral window.
- Forget να like το comment back → half engagement signal.

**Escalation**
- Mass hate from coordinated group → screenshot + Marketing Manager.
- Doxxing/personal threat → COO + Head of Account Defense immediately.`,
  },
  {
    sort_order: 11,
    name: `DM funnel work (Requests folder triage)`,
    kpi: `100% DMs funneled εντός 2-3 messages, 0 message-4+ without link, all spam muted same-day`,
    cadence_type: `daily`,
    cadence_note: `Καθημερινά, multiple times — Requests folder check`,
    sop_content: `**Σκοπός**
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
- DM funnel converting <5% → flag στο weekly KPI review.`,
  },
  {
    sort_order: 12,
    name: `Viral comment strategy (outbound 5-10/day)`,
    kpi: `5-10 outbound viral comments/day per Main, 1-3 σε videos με 100K+ views, comment-log filled`,
    cadence_type: `daily`,
    cadence_note: `Καθημερινά, embedded στο scroll session`,
    sop_content: `**Σκοπός**
Outbound commenting από Main account σε άλλων viral videos — hijack attention, drive traffic στο creator's profile. Piggybacks στο daily scroll, χωρίς separate time block.

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
   - **01 Identification** — "say what everyone thinks but hasn't said" (1st person, 1-2 sentences)
   - **02 Challenge/Counter** — confidently right OR confidently wrong, never hedging
   - **03 Debate trigger** — sharp irony, no profanity
   - **04 Role-model reference** — recognisable now, no explanation needed
   - **05 Controversial/provocative** — ironic, never aggressive
4. Write in <90 sec. If longer → skip.
5. Post comment.
6. Log: video link + comment type + outcome (likes / profile visits / follows / DMs attributed).

**Universal rules**
- Short (1-2 sentences). Longer doesn't rank.
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
- Mass-reply troll from outbound comment → ignore + report, never engage.`,
  },
  {
    sort_order: 13,
    name: `F4F + scrolling + likes routine (engagement)`,
    kpi: `Follow amounts per assigned Task checklist· ratio healthy· hard cap respected`,
    cadence_type: `daily`,
    cadence_note: `Καθημερινά, ανά account — Alt accounts F4F primary`,
    sop_content: `**Σκοπός**
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
6. **Unfollow** (Alt) — anyone who hasn't followed back 5-7 days. Never mass-unfollow. Spread δια της ημέρας.
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
- Follow ratio broken (following >> followers >2:1) → unfollow cycle, ping Marketing Manager.`,
  },
  {
    sort_order: 14,
    name: `End-of-day Discord/Telegram report`,
    kpi: `100% daily reports posted πριν end-of-shift, all blocks/anomalies flagged same-day`,
    cadence_type: `daily`,
    cadence_note: `Καθημερινά τέλος shift, στο Daily Reports channel`,
    sop_content: `**Σκοπός**
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
- Creator unresponsive 24h+ → flag στο report + CSM.`,
  },
  {
    sort_order: 15,
    name: `Account Defense compliance (shared ownership)`,
    kpi: `0 rule violations/session, 100% always-on rules followed, all flags reported same-minute, EOD compliance log 100% filled`,
    cadence_type: `daily`,
    cadence_note: `Always-on κάθε session + explicit EOD self-check`,
    sop_content: `**Σκοπός**

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
Full rules: Ultimate Account Safety & Restrictions SOP (Notion). Ban treatment: IG + FB Ban & Restriction Treatment SOP. Triage workflow: Ban triage SOP σε αυτό το library.`,
  },
  {
    sort_order: 16,
    name: `Weekly highlights & profile maintenance`,
    kpi: `Highlights refreshed weekly per creator categories (set with Marketing Manager); 0 stale (>2 weeks); bio/PFP matches Master`,
    cadence_type: `weekly`,
    cadence_note: `Μία φορά/εβδομάδα, ανά account`,
    sop_content: `**Σκοπός**
Weekly maintenance check στο profile — highlights refresh, covers update, bio sync, PFP verification. Profile drift = trust score erosion.

**Πότε**
Μία φορά/εβδομάδα (default Παρασκευή ή ώρα off-peak). Ανά account.

**Tools**
- Account Master Reference
- iCloud (highlight cover assets)
- IG app
- Marketing Manager (per-creator highlight category list)

**Steps**
1. Open creator's profile → check highlight categories **defined per-creator με Marketing Manager** (όχι fixed global list).
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
- Bio change που δεν made the VA → possible compromise, ping immediately.`,
  },
  {
    sort_order: 17,
    name: `Weekly KPI review με Marketing Manager`,
    kpi: `100% participation, all 8 KPIs reviewed per assigned creator, next-week priorities documented`,
    cadence_type: `weekly`,
    cadence_note: `Κάθε Δευτέρα, 30-45min sync`,
    sop_content: `**Σκοπός**
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
- Argue with KPIs → numbers don't lie, look for cause.
- Change το loop όταν χάνεις KPI → reset signal. Change το lever instead.
- Forget να document actions → next week ίδιο review.

**Escalation**
- 2 weeks missed targets + no clear cause → loop in Head of Marketing.
- Algorithmic anomaly suspected (mass shadowban) → Head of Account Defense.`,
  },
  {
    sort_order: 18,
    name: `Weekly content brief sync με Marketing Manager / Content Director`,
    kpi: `Briefs received 2-3 μέρες πριν filming, all questions resolved πριν shoot, 0 day-of-shoot brief gaps`,
    cadence_type: `weekly`,
    cadence_note: `2-3 μέρες πριν next filming day`,
    sop_content: `**Σκοπός**
Weekly sync για να λάβεις content briefs **2-3 μέρες πριν filming day**, να ρωτήσεις διευκρινίσεις, να align με τον filmer. Late briefs = panicked execution + bad content.

**Πότε**
2-3 μέρες πριν κάθε filming day (στο standard creator schedule).

**Tools**
- Discord/Telegram (brief drop)
- Notion → Content Brief template
- Templates & Assets channel

**Steps**
1. Receive brief από Content Director / Marketing Manager: caption variants, hooks, vertical mix, posting concepts.
2. Read end-to-end (don't skim).
3. Cross-check brief vs Account Master voice — does this fit creator's persona?
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
- Filmer unavailable for sync → CSM coordinate.`,
  },
  {
    sort_order: 19,
    name: `Winner identification & report (weekly scan)`,
    kpi: `100% videos meeting 2.5x threshold reported στο Winner Videos channel σε σωστό format, 0 raw-link reports`,
    cadence_type: `weekly`,
    cadence_note: `Μία φορά/εβδομάδα ή as winners hit threshold`,
    sop_content: `**Σκοπός**
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
   \`\`\`
   [WIN] | [creator] | [vertical]
   [account handle/link]
   Views: [count] (vs median [X])
   Posted: [date]
   Why we think it won: [1 sentence]
   [video file attached]
   \`\`\`
5. iCloud Manager handles από εκεί (downloads + saves σε \`/Creator_Name/Winners/\`).
6. Log winner στο weekly sheet.

**Time**
30-45 min weekly per creator's portfolio.

**Common mistakes**
- Use mean αντί median → 1 outlier skews threshold.
- Report raw link χωρίς template → iCloud Manager bounces back.
- Forget το "why we think it won" line → no learning.
- Late report (winner sat για 3 μέρες) → lose memory of why it worked.
- Σκορπίζεις winner reports σε άλλο channel → δεν πιάνει το pipeline.

**Escalation**
- 2 weeks zero winners από έναν creator → flag στο weekly KPI review (vertical fit problem).
- Winner can't be downloaded (deleted from IG) → ping iCloud Manager + see if backup.`,
  },
  {
    sort_order: 20,
    name: `Variant repurposing batch (από Trials folder)`,
    kpi: `100% trial variants edited unique per session, 0 duplicate-content flags, batch ready πριν next day's posting`,
    cadence_type: `weekly`,
    cadence_note: `Όταν iCloud Manager updates Trials folder`,
    sop_content: `**Σκοπός**
Batch-process Trial Reel variants από iCloud Manager → make each unique per upload (cut, brightness, overlay) → ready για posting. Same source = forever pipeline.

**Πότε**
Όταν iCloud Manager notify-άρει ότι Trial subfolder updated (typical: εβδομαδιαία ή 2x/week).

**Tools**
- iCloud → \`Model → Content to Upload → Video To Upload → … → Trial\`
- CapCut (work device)
- iPhone Photos app

**Steps**
1. Open \`Model → Content to Upload → Video To Upload → … → Trial\` → identify videos για επόμενη εβδομάδα.
2. Per video:
   - Download στο device (Photos app).
   - Open CapCut (όχι IG draft duplicate — never).
   - **Trim:** cut 0.1 sec από το τέλος (ή 1 sec start/end).
   - **Brightness:** +5 to +10 (subtle).
   - **Overlay:** Text → type creator's username → shrink as small as possible → opacity 0% → drag to corner (invisible to viewer, changes fingerprint).
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
- Same video flagged "similar content" after edit → escalate variant rotation, Marketing Manager input.`,
  },
  {
    sort_order: 21,
    name: `Weekly retro + next-week posting plan`,
    kpi: `100% Friday retros completed, next-week posting plan documented before EOW, all blocks flagged`,
    cadence_type: `weekly`,
    cadence_note: `Παρασκευή afternoon`,
    sop_content: `**Σκοπός**
Personal weekly retro — what worked, what didn't, what's blocked. Plan next week's posting cadence per creator. Submit blockers στο Management Team.

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
- Don't aggregate data → vibes, not signal.
- Identify blockers but δεν τα flag → next Monday same problem.
- Mix retro με Questions channel → noise.

**Escalation**
- Same blocker 2 εβδομάδες σε σειρά → loop in Marketing Manager directly.
- Burnout signals (skipped posts, missed shots, declining quality) → flag to CSM + Marketing Manager.`,
  },
  {
    sort_order: 22,
    name: `Monthly account performance retro (per creator)`,
    kpi: `100% creators retro'd εντός 1ης εβδομάδας μήνα, archived doc per creator, next-month plan documented`,
    cadence_type: `monthly`,
    cadence_note: `1η εβδομάδα μήνα`,
    sop_content: `**Σκοπός**
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
3. Cross-reference με Content Director's vertical scorecard (από Vertical Testing SOP).
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
- Don't compare με previous month → no progress baseline.
- Identify problems χωρίς proposed fixes → useless retro.
- Skip archive → lose institutional memory.
- Same retro template για όλους creators χωρίς customization.

**Escalation**
- 2 consecutive months declining → loop in Head of Marketing + CSM (creator-side issue?).
- Suspected device contamination (mass anomalies) → Head of Account Defense.`,
  },
  {
    sort_order: 23,
    name: `Monthly safety audit (device + account hygiene)`,
    kpi: `0 unauthorized Account Center connections, 0 banned-hashtag usage, 100% device-creator mapping verified`,
    cadence_type: `monthly`,
    cadence_note: `End-month, anti-ban discipline check`,
    sop_content: `**Σκοπός**
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
   - Pull last month's hashtag usage.
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
- Don't document → can't show pattern in monthly review.

**Escalation**
- ANY unauthorized Account Center link → Head of Account Defense + Marketing Manager IMMEDIATELY.
- iCloud Backup found enabled → factory reset path (with Marketing Manager approval).
- Banned hashtag found used → archive το post + replace strategy.`,
  },
  {
    sort_order: 24,
    name: `New IG/TikTok account setup (Day 1)`,
    kpi: `100% Day 1 setup complete πριν handoff, credentials logged same-minute, 0 Wi-Fi violations`,
    cadence_type: `daily`,
    cadence_note: `PER EVENT — όταν Head of Account Defense assigns νέο handle`,
    sop_content: `**[PER EVENT — δεν υπάρχει Per-event cadence στο dropdown, χρησιμοποιείται Daily ως placeholder. Trigger: Head of Account Defense assigns νέο handle για warm-up]**

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
9. Bio: \`19 | FL\` or \`19 | FL | fitness\` (per Master).
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
- IG/TT requires phone verification → escalate Head of Account Defense (may need separate SIM).`,
  },
  {
    sort_order: 25,
    name: `Account warm-up ramp (Days 1-3 new account)`,
    kpi: `100% 3-day warm-up completed πριν Phase 3 content go-live, 0 premature posting incidents, 0 follows/DMs during warm-up`,
    cadence_type: `daily`,
    cadence_note: `PER EVENT — αμέσως μετά Day 1 setup ενός νέου account`,
    sop_content: `**[PER EVENT — δεν υπάρχει Per-event cadence στο dropdown, χρησιμοποιείται Daily ως placeholder. Trigger: Day 1 setup complete σε νέο account]**

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
- Account asks για phone re-verification → Head of Account Defense.`,
  },
  {
    sort_order: 26,
    name: `Trial Reels launch (per new variant batch)`,
    kpi: `100% Trials posted με toggle ON, 0 grid contamination, post verified σε Trials section <60s, log filled`,
    cadence_type: `daily`,
    cadence_note: `PER EVENT — όταν Trial Reel variant ready από Cloud Manager batch`,
    sop_content: `*PER EVENT — δεν υπάρχει Per-event cadence στο dropdown, χρησιμοποιείται Daily ως placeholder. Trigger: iCloud Manager updates Trial subfolder + variant edited per Repurpose SOP]**

**Σκοπός**
Post a Trial Reel — IG feature που δείχνει reel μόνο σε non-followers, never στο grid, fully reusable. Gunzo's core cold-traffic scaling weapon.

**Πότε**
Per available variant from Cloud Manager. Daily cadence depends on account tier:
- New (<30d): 1-3/day
- Aged (30+d): 5-20/day
- Warmed (90+d): 20-50/day
- Power Pages (200+d): 50-100+/day

**Tools**
- iCloud → \`Model → Content to Upload → Video To Upload → … → Trial\`
- IG app (Professional account με Trial Reels enabled)
- Account tracker (tier info)

**Prerequisites (one-time per account)**
1. IG → Professional Dashboard → Tools → toggle "Trial Reels" ON.
2. Confirm via notification.
3. Log enablement στο account tracker (date + VA).

**Posting a Trial Reel**
1. Pull approved variant από \`/Trials/\`.
2. IG → New Reel → select video.
3. Apply creator-specific caption (από Templates & Assets).
4. Add cover image (matches Master grid aesthetic).
5. **Toggle "Trial" ON before posting — critical step.**
6. Post.
7. Wait 60s → verify: reel appears στο "Trials" section, NOT στο grid.
8. Screenshot to posting log.
9. Monitor first-hour views για anomalies.
10. Move variant στο \`Grid (posted) subfolder\` per Winners Vault SOP.

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
- Variant flagged 3x straight → escalate to Content Director (variant needs deeper remix).`,
  },
  {
    sort_order: 27,
    name: `Ban / restriction / shadowban triage (per incident)`,
    kpi: `100% incidents reported same-minute, all screenshots captured, 0 VA-independent appeals, backup activated εντός day για disables`,
    cadence_type: `daily`,
    cadence_note: `PER EVENT — όταν detect orange flag, action block, shadowban, disable, ή permanent ban`,
    sop_content: `**[PER EVENT — δεν υπάρχει Per-event cadence στο dropdown, χρησιμοποιείται Daily ως placeholder. Trigger: Account shows orange flag, action block popup, sudden reach drop >50%, disabled message, ή permanent ban screen]**

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
     - "Features you can't use" → Feature restriction (Scenario 1)
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
- VA's only role: provide screenshots + screen-recording showing Wi-Fi OFF + Mobile Data ON.

**Time**
- Detection: 5 min στο morning check.
- Triage + report: 10-15 min same-incident.
- Backup activation: 30-45 min.

**Common mistakes**
- Skim Account Status → miss the orange.
- Delay report "wait να δω αν φτιάχνει" → escalates to permanent.
- Submit appeal solo → kills Manager's ability to handle.
- Continue blocked actions thinking "just one more" → extends restriction.
- Factory reset without approval → may break recovery options.
- Log back into disabled από same device → contaminates device για backup.

**Escalation**
- ANY incident on Power Page (200+ days, high revenue) → immediate COO + Head of Account Defense.
- Cascade incident (multiple accounts orange same day) → Head of Account Defense + COO immediately (possible device-wide compromise).`,
  },
  {
    sort_order: 28,
    name: `Creative production support (carousel/story/edit requests από Content Director)`,
    kpi: `100% requests delivered εντός agreed turnaround, 0 voice/aesthetic mismatches, all assets archived στο iCloud`,
    cadence_type: `daily`,
    cadence_note: `PER EVENT — όταν Content Director queues creative request`,
    sop_content: `**[PER EVENT — δεν υπάρχει Per-event cadence στο dropdown, χρησιμοποιείται Daily ως placeholder. Trigger: Content Director / Marketing Manager queues ad-hoc creative request (carousel build, story template tweak, reel edit, captions remix)]**

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
4. Cross-check creator's Master voice + aesthetic.
5. Execute:
   - **Carousel:** 3-7 slides, hook on slide 1, CTA or cliffhanger slide last, consistent font/color, niche-tuned voice.
   - **Story set:** match creator's daily aesthetic, follow CTA Story SOP rules για link stickers.
   - **Caption remix:** rotate wording, no banned terms, match voice.
6. Quality-check vs Master voice + safety rules (no banned wording/emojis).
7. Deliver στο iCloud folder + post link στο request thread.
8. Confirm received με Content Director.
9. Archive το final asset στο \`/Creator_Name/Ready_To_Post/\` ή appropriate folder.

**Time**
30 min - 2h per request (variable on scope).

**Common mistakes**
- Skip Master voice cross-check → asset doesn't match creator, gets bounced.
- Use banned wording in captions → asset rejected μετά review.
- No ETA confirmation → Content Director assumes deprioritized.
- Skip archive → asset lost, rebuilt next time.

**Escalation**
- Request scope creep beyond original brief → flag to Content Director (revise brief or add capacity).
- Asset blocked by missing source → ping iCloud Manager + Content Director.
- Request conflicts με daily posting cadence → Marketing Manager prioritize.`,
  },
  {
    sort_order: 29,
    name: `Account handoff (offboarding / VA transition)`,
    kpi: `100% credentials transferred secure, factory reset done where required, 0 unauthorized access incidents post-handoff`,
    cadence_type: `daily`,
    cadence_note: `PER EVENT — όταν account μεταφέρεται σε άλλο VA, ή VA leaves`,
    sop_content: `**[PER EVENT — δεν υπάρχει Per-event cadence στο dropdown, χρησιμοποιείται Daily ως placeholder. Trigger: Account reassigned από έναν VA σε άλλο, ή VA leaves Gunzo, ή creator pauses]**

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
- Unauthorized Account Center connection found post-handoff → immediate forensics, Head of Account Defense.`,
  },
];
