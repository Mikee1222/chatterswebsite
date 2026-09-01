export type MarketingExecutivesUsFunctionSeed = {
  sort_order: number;
  name: string;
  kpi: string;
  cadence_type: "daily" | "weekly" | "monthly" | "per_event";
  cadence_note: string;
  sop_content: string;
};

export const MARKETING_EXECUTIVES_US_FUNCTIONS: MarketingExecutivesUsFunctionSeed[] = [
  {
    sort_order: 1,
    name: `Account status check (morning)`,
    kpi: `100% of sessions start with Account Status check; 0 incidents from missed status review`,
    cadence_type: `daily`,
    cadence_note: `Daily, before every session — first task`,
    sop_content: `**Purpose**
Before you touch any account, confirm Account Status is green on every handle you will work today. The device is farm-controlled — no IP management needed on your end.

**When**
First task of every session, and again each time you switch accounts on the same device.

**Tools**
- Phone (work device — assigned hardware)
- IG/FB/TT app → Settings → Account Status

**Steps**
1. Confirm the device is on mobile data — Wi-Fi OFF, eSIM/VPN/Proxy OFF.
2. Open each account you will work → Settings → Account Status. All sections must be green.
3. If you see an orange flag → screenshot immediately + ping Marketing Manager. Do NOT start posting/engagement until you have guidance.
4. Log in the daily sheet: timestamp + status per account.

**Time**
2–3 minutes (scales with number of accounts on the device).

**Common mistakes**
- Skipping Account Status to save time — most bans start from an ignored orange flag.
- Continuing to post with an orange flag — accelerates shadowban/disable.
- Turning on Wi-Fi "just for 2 minutes" — security violation.

**Escalation**
- Orange on Account Status → Marketing Manager + screenshot.
- Action block popup → STOP likes/follows/comments; continue only posting/stories/DM replies; report.`,
  },
  {
    sort_order: 2,
    name: `Master Account check & device assignment verify (morning)`,
    kpi: `0 cross-device incidents; 100% of posts made from the correct assigned device`,
    cadence_type: `daily`,
    cadence_note: `Daily before posting, per creator you will work`,
    sop_content: `**Purpose**
Before you post for any creator, verify the Master Account spec (template, bio, highlights) and that you are on the **correct device** for that specific handle. Cross-contamination = mass-ban risk.

**When**
Daily, before posting for each creator (and again if you switch creators mid-shift).

**Tools**
- Account Master Reference (Notion)
- Device-to-creator mapping sheet (from Head of Account Defense)
- Password manager

**Steps**
1. Open Account Master Reference and find your creator.
2. Confirm you are holding the **assigned device** for that creator. Different device = STOP, ping Head of Account Defense.
3. Cross-check bio + profile pic + highlights on the live account vs template. If anything does not match (random highlight, wrong PFP) → flag Marketing Manager.
4. Confirm there is no connection in Meta Account Center with unauthorized handles.
5. Quick scan: highlights stale? (>2 weeks no update) → add to weekly maintenance list.
6. Confirm credentials are accessible from the password manager (not plain text, not a sticky note).

**Time**
2–3 minutes per creator/account.

**Common mistakes**
- Posting from a personal phone "just once" → instant cross-link.
- Profile pic identical to another creator account → Meta fingerprint match.
- Skipping Master check when it "looks OK" — drift happens silently.
- Logging into a personal Apple ID on the work device → mass-ban risk.

**Escalation**
- Wrong device → Head of Account Defense + STOP.
- Meta Account Center shows unauthorized link → Marketing Manager immediately.
- Stale highlights >2 weeks → add to weekly task, not a blocker.`,
  },
  {
    sort_order: 3,
    name: `iCloud content pull & Templates & Assets check (morning)`,
    kpi: `100% of today's briefs/files identified before noon local time; 0 posting delays due to missing assets`,
    cadence_type: `daily`,
    cadence_note: `Daily morning, before posting`,
    sop_content: `**Purpose**
Gather all content assets you need for the day: today's brief from Content Director, video files in iCloud, and templates from the Templates & Assets channel.

**When**
Daily morning, after Account Status check, before you start posting.

**Tools**
- iCloud folders per creator:
  - **Social Media Posts:** Model → Content to Upload → Social Media Posts → Year → Month → Carousel 1, 2…
  - **Stories:** Model → Content to Upload → Stories To Upload → CTA or Daily → Year → Month → Week → Day (weeks 1–7, 8–15, etc.)
  - **Videos:** Model → Content to Upload → Video To Upload → Year → Month → Week → Day → Main Account or Secondary Account → Trial or Grid
- Telegram → Templates & Assets channel
- Discord → today's brief / caption drop from Marketing Manager

**Steps**
1. Open Discord/Telegram → check today's brief: captions, hooks, posting concepts.
2. Open iCloud → \`Model → Content to Upload → Video To Upload → … → Trial or Grid\` → identify videos in Video To Upload path (Main/Secondary → Trial or Grid).
3. Open \`Model → Content to Upload → Video To Upload → … → Trial\` — if not ready, ping iCloud Manager.
4. Open Templates & Assets channel — pull ready stories/captions before building from scratch.
5. Pre-check: all videos are 9:16 vertical.
6. Mental plan: which post goes where, what time (creator's US local time zone), which account.

**Time**
10–15 minutes.

**Common mistakes**
- Building from scratch when a template exists — duplicate effort + inconsistent voice.
- Not checking iCloud before posting → discover missing brief at noon.
- Re-using a file already marked posted in Grid/Trial folder → duplicate detection penalty.

**Escalation**
- Missing brief for the day after 10:00 AM local → ping Marketing Manager + Content Director.
- Trial subfolder empty → iCloud Manager.
- Template gap (no caption fits) → flag in Questions channel.`,
  },
  {
    sort_order: 4,
    name: `Account warm-up routine (daily 15-min)`,
    kpi: `100% of accounts warmed up before posting; 0 post-and-ghost incidents`,
    cadence_type: `daily`,
    cadence_note: `Daily before posting, per account`,
    sop_content: `**Purpose**
15-minute daily warm-up before any action — trains the algorithm that the account is a real user, not a bot. Strongest trust-score signal Gunzo has.

**When**
Daily before posting/engagement, per account. **Tools**
- IG/TT/FB app (platform-appropriate)

**Steps**
1. Open app → Explore/Reels/FYP feed.
2. Scroll for 15 minutes; watch videos to completion (do not skip at 1 sec).
3. Like 3–5 random posts outside the niche (natural behavior).
4. Watch 5–10 stories.
5. Send 1–2 reels via DM to other accounts (strongest human signal for the algorithm).
6. Stay active 5 minutes after warm-up — never post-and-ghost.
7. Only then → start posting/engagement.

**Time**
15 minutes per account.

**Common mistakes**
- Skipping warm-up "because I don't have time" — single biggest reason for shadowban.
- Liking 20 posts in 30 seconds → spam burst flag.
- Watching videos for 1–2 sec → negative algorithm signal (worse than no view).
- Posting immediately after warm-up without the 5-minute active window.

**Escalation**
- Account shows 0 engagement on warm-up content after 3 days → ping Marketing Manager (possible shadowban).`,
  },
  {
    sort_order: 5,
    name: `IG Reel/feed post (midday + evening)`,
    kpi: `100% of posts published on schedule; 0 duplicate flags; posting log complete`,
    cadence_type: `daily`,
    cadence_note: `12:00 PM and 8:00 PM local (creator US time zone) per Main account; +1 repurposed on Alt`,
    sop_content: `**Purpose**
Daily IG Reel posting from Main + Alt accounts at scheduled times, with correct caption, hashtags, and cover.

**When**
Main: **12:00 PM** and **8:00 PM** in the creator's local US time zone. Alt: +1 repurposed copy mid-shift. Min 2h gap between posts on the same account.

**Tools**
- iCloud → Video To Upload (assigned day/account)
- IG app
- Caption from Content Director (Discord/Telegram drop)
- Approved hashtag list

**Steps**
1. Account status check + warm-up done.
2. Download video from iCloud → Video To Upload → assigned day folder → Trial or Grid.
3. IG → + → Reel → select.
4. Pick a strong cover frame — not random.
5. Paste caption from Content Director **as-is** — do not rewrite.
6. Hashtags: 3–5 max, placed 3–4 line breaks below caption. Rotate set every 3–4 posts.
7. Audio: trending sound only if it fits; otherwise original.
8. Verify Trial toggle: OFF for normal Reel, ON for trial (separate SOP).
9. Share → confirm live → screenshot.
10. Move file: Video To Upload → [Year] → [Month] → [Week] → [Day] → [Account] → Grid (posted).
11. Stay in app 1–2 minutes (active-user signal).
12. Log post in daily sheet: account / time / post ID / first 30min views.

**Time**
8–12 minutes per post (scales with upload speed).

**Common mistakes**
- Random cover frame → low click-rate.
- Caption rewrite "for better tone" — breaks consistency with tested winners.
- Same hashtag set on every post → algorithm flag.
- Identical file on Main + Alt → duplicate penalty.
- Post + close app immediately → "post-and-ghost" penalty.
- Forgetting to move file to posted subfolder → re-upload risk.

**Escalation**
- Post stuck at 0 views >1h → possible shadowban, ping Marketing Manager.
- Audio missing/removed by IG → re-upload with different sound.
- Cover refuses to set → IG bug, force-quit + retry.`,
  },
  {
    sort_order: 6,
    name: `TikTok daily post`,
    kpi: `2 TT posts/account/day; vertical 9:16 100%`,
    cadence_type: `daily`,
    cadence_note: `Per assigned Task schedule — 2 posts/account/day`,
    sop_content: `**Purpose**
Daily TikTok posting — video from assigned iCloud Video To Upload folder (Trial or Grid path). You do not pick the source; follow the assigned Task.

**When**
Per assigned Task schedule (2 posts/account/day). Order: **Scroll → Like → Post → F4F**.

**Tools**
- iCloud → Video To Upload (assigned day/account/Trial or Grid)
- TikTok app
- Trending sounds library (TT)

**Steps**
1. 15-min FYP scroll (algorithm warm-up).
2. Download video from assigned iCloud Video To Upload folder.
3. TikTok → + → gallery → select.
4. Add **trending sound** — not original IG audio if repurposed.
5. Caption: 1–2 short lines + 3–5 niche hashtags.
6. Verify vertical 9:16.
7. Post.
8. Stay in app 1–2 minutes (active-user signal).
9. Log post ID/link in daily sheet.
10. Repeat for 2nd post/account per Task schedule.

**Time**
6–10 minutes per post.

**Common mistakes**
- Original IG audio instead of trending TT sound → no velocity push.
- Long caption → kills retention.
- Photo-only post → TT default rejection.
- Posting 2 videos within 5 minutes → split reach.

**Escalation**
- Trial option missing → account not eligible, ping Marketing Manager.
- Assigned folder empty → iCloud Manager.`,
  },
  {
    sort_order: 7,
    name: `Facebook cross-post & accept requests (daily)`,
    kpi: `1 FB Reel cross-posted/day same-day; 100% of legitimate friend requests accepted`,
    cadence_type: `daily`,
    cadence_note: `Daily, min 30min after IG post`,
    sop_content: `**Purpose**
Daily FB Reel cross-post from IG (+50% distribution boost when same-day) + accept inbound friend requests. FB is a live channel, not a passive mirror.

**When**
Daily. Order: **Cross Post → Accept Requests → Scrolling → Liking**. Min 30 min gap from IG upload on the same device.

**Tools**
- IG app (source)
- FB app

**Steps**
1. IG → find today's Reel → download video to phone.
2. FB → Reels → select video.
3. Caption: same as IG, optionally slightly different hook for FB.
4. Post.
5. Open Friend Requests → accept ALL legitimate (not spam/non-target language/zero-photo profiles).
6. 20–30min Feed scroll; watch niche videos to completion.
7. 30–50 niche post likes with 5-sec gaps. 10–15 niche story likes.

**Time**
20–30 minutes (cross-post + accept + scroll).

**Common mistakes**
- Cross-posting IG + FB simultaneously → FB flags as bot.
- Accepting Arabic/spam requests → engagement rate tanks.
- 50 likes in a 2-minute burst → spam flag.
- Skipping same-day crosspost → lose distribution boost.

**Escalation**
- FB locks accept feature → Marketing Manager (possible feature restriction).
- Friend requests stuck at 0 inbound for 3+ days → re-engage groups (separate SOP).`,
  },
  {
    sort_order: 8,
    name: `Daily Stories cadence (lifestyle slots)`,
    kpi: `2 lifestyle/engagement stories/day delivered; 100% mix; 0 explicit story bans`,
    cadence_type: `daily`,
    cadence_note: `Daily, 2 stories spread across day (creator local US time)`,
    sop_content: `**Purpose**
Daily IG stories — closest touchpoint with the audience. 2 lifestyle/engagement stories/day. Builds trust + warms audience before the CTA story.

**When**
Daily, 2 stories spread across the day. Never batch. CTA story follows weekly Link A/B schedule (model_story_link_config): Monday Link A, Wednesday Link B, Friday Highlights redirect, Saturday Link A.

**Tools**
- iCloud → Stories To Upload → Daily (assigned week/day)
- Templates & Assets channel (ready stickers/copy)
- IG app

**Steps**
1. Story 1 (morning/midday): lifestyle or activity — coffee, gym, walk, outfit.
2. Story 2 (afternoon/evening): engagement sticker — poll, quiz, "this or that" or suggestive tease (not explicit).
3. Reshare today's Reel to story **within the 1st hour** of the Reel post (velocity signal).
4. At least 2 stories/week with poll or quiz sticker (boosts engagement rank).
5. Reply to story replies within 30 min per reply.

**Time**
10–15 minutes spread across the day.

**Common mistakes**
- Batching both stories in the morning → low read-rate.
- Explicit story → ban risk + downrank.
- Story replies ignored >30 min → miss conversion window.

**Escalation**
- Link sticker unavailable → **Highlight redirect** (standard fallback — never bio for CTA). Ping Marketing Manager.
- 3 consecutive days with 0 story views → possible shadowban, escalate.`,
  },
  {
    sort_order: 9,
    name: `Evening CTA story with link sticker`,
    kpi: `1 CTA story/day per weekly Link A/B schedule; 100% link verified post-publish; 0 explicit ban incidents`,
    cadence_type: `daily`,
    cadence_note: `Per weekly Link A/B schedule (model_story_link_config): Monday Link A, Wednesday Link B, Friday Highlights redirect, Saturday Link A — 1 CTA story on assigned slot`,
    sop_content: `**Purpose**
The main daily CTA push — evening story with link sticker, sexy but not explicit, curiosity-driven, drives clicks → OnlyFans funnel.

**When**
Per weekly Link A/B schedule (model_story_link_config): Monday Link A, Wednesday Link B, Friday Highlights redirect, Saturday Link A. 1 CTA story on the assigned slot (in addition to the 2 lifestyle stories).

**Tools**
- iCloud → Stories To Upload → CTA (assigned week/day)
- OF link or landing URL (clipboard ready)
- IG app

**Steps**
2. Tap **+** → Camera → upload approved photo.
3. Swipe up → sticker bar → **Link** sticker → paste link per weekly schedule (Link A or Link B from model_story_link_config).
4. Caption: **max 3 words** + 1–3 emojis. Examples: "my secrets" / "you know where" / "exclusive".
5. Position link sticker — do not cover face/body/outfit reveal.
6. Tap Done → upload.
7. **Post-publish:** open the story → tap the link → verify it opens the correct page. Broken → delete + repost.
8. Rotate wording daily — never the same caption 2 days in a row.

**Photo rules**
- Sexy clothes / lingerie covered / body-con / silhouette / mirror selfie — OK.
- Topless / explicit / nude — NEVER (OF only).
- Soft warm lighting, clean background, head-to-waist or full body framing.

**Banned wording**
"OnlyFans", "OF", "nudes", "sexting", "porn", "xxx", "link in bio", "sugar daddy", "hookup".

**Time**
5–8 minutes.

**Common mistakes**
- Raw link without caption → zero context → zero clicks.
- Same caption every day → pattern-flag as bot.
- Caption >3 words → drop-off.
- Posting before 7:00 PM local → off-peak, reach tanks.
- Link sticker covers face → broken visual.
- Forgetting to verify link post-publish → broken funnel for 4h.

**Escalation**
- Link sticker unavailable → **Highlight redirect** (standard fallback — never bio for CTA). Escalate to Marketing Manager.
- Story removed by IG → screenshot + Marketing Manager (content review).`,
  },
  {
    sort_order: 10,
    name: `Comment replies (own posts, 30-min window)`,
    kpi: `Top-liked comments answered <30min 100%; all comments <2h 100%; 0 banned replies`,
    cadence_type: `daily`,
    cadence_note: `Daily, per new post — top comments <30min, rest <2h`,
    sop_content: `**Purpose**
Reply to all inbound comments on the creator's posts. Engagement velocity in the first 30 minutes = strongest signal for viral push.

**When**
Daily. **Top-liked comments: <30 min** from upload. Rest: <2h. Goal: 3+ reply thread → migrate to DMs.

**Tools**
- IG/TT/FB app
- Account Master voice brief (creator tone)
- Reply category framework (8 categories)

**Steps**
1. Open post → tap comments → sort by Most Liked.
2. **Top comments first**: identify category (emoji-only / compliment / question / video positive / video negative / hate-troll / repeat high-intent / spam).
3. Write reply per category:
   - Emoji-only → playful + question back ("did you like it?")
   - Compliment → confident playful ("I've got even better ones")
   - Question → partial answer + mystery ("you know where to find me")
   - Video negative → flip with sharp irony, never anger
   - Hate/troll → 1 ironic line max, or ignore
   - Spam/dick pic → hide/delete, no engagement
4. Like the original comment after your reply (doubles engagement signal).
5. Pin the best comment for extra reach.
6. 3+ replies from same user → migrate to DMs (Conversion Funnel SOP).

**Banned replies**
"Thanks" / "yes" / "no" / "haha" / emoji-only / defensive explanations / "block" threats / explaining what OnlyFans is.

**Time**
15–30 minutes per post (scales with engagement volume).

**Common mistakes**
- One-word replies → closes thread, kills algorithm signal.
- Copy-paste identical reply on different comments → pattern flag.
- Engaging trolls with anger → gives them reach.
- Skipping top-liked in the first 30 minutes → lose viral window.
- Forgetting to like the comment back → half engagement signal.

**Escalation**
- Mass hate from coordinated group → screenshot + Marketing Manager.
- Doxxing/personal threat → COO + Head of Account Defense immediately.`,
  },
  {
    sort_order: 11,
    name: `DM funnel work (Requests folder triage)`,
    kpi: `100% of DMs funneled within 2–3 messages; 0 message-4+ without link; all spam muted same-day`,
    cadence_type: `daily`,
    cadence_note: `Daily, multiple times — Requests folder check`,
    sop_content: `**Purpose**
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
"Give me your phone" / "let's meet up" / "come over" / promises for real meeting / explaining what OF is / same copy 2x in a row / replying to dick pics.

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
- DM funnel converting <5% → flag in weekly KPI review.`,
  },
  {
    sort_order: 12,
    name: `Viral comment strategy (outbound 5–10/day)`,
    kpi: `5–10 outbound viral comments/day per Main; 1–3 on videos with 100K+ views; comment log filled`,
    cadence_type: `daily`,
    cadence_note: `Daily, embedded in scroll session`,
    sop_content: `**Purpose**
Outbound commenting from Main account on others' viral videos — hijack attention, drive traffic to the creator's profile. Piggybacks on the daily scroll, no separate time block.

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
   - **01 Identification** — say what everyone thinks but hasn't said (1st person, 1–2 sentences)
   - **02 Challenge/Counter** — confidently right OR confidently wrong, never hedging
   - **03 Debate trigger** — sharp irony, no profanity
   - **04 Role-model reference** — recognizable now, no explanation needed
   - **05 Controversial/provocative** — ironic, never aggressive
4. Write in <90 sec. If longer → skip.
5. Post comment.
6. Log: video link + comment type + outcome (likes / profile visits / follows / DMs attributed).

**Universal rules**
- Short (1–2 sentences). Longer doesn't rank.
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
- Mass-reply troll from outbound comment → ignore + report, never engage.`,
  },
  {
    sort_order: 13,
    name: `F4F + scrolling + likes routine (engagement)`,
    kpi: `Follow amounts per assigned Task checklist; ratio healthy; hard cap respected`,
    cadence_type: `daily`,
    cadence_note: `Daily, per account — Alt accounts F4F primary`,
    sop_content: `**Purpose**
Daily engagement routine — F4F (Alt accounts), unfollow stale, scroll algorithm-training, niche post + story likes. Follow amounts defined in the assigned Task checklist — not hardcoded here.

**When**
Daily, on all accounts. Order: **Scrolling → Likes → F4F → Unfollow (delayed 5–7 days)**.

**Tools**
- IG/TT/FB app
- Niche shortlist (creators to F4F from)
- Assigned Task checklist (follow/like targets)

**Steps**
1. **Scrolling** — Reels/FYP tab, niche only. Watch to completion. Skip <2s = negative signal, do not.
2. **Post likes** — amounts per assigned Task checklist, 5-sec pause between. Niche only.
3. **Story likes** — per Task checklist, mix likes + short replies.
4. **F4F (Alt accounts):** follow amounts per Task checklist, **1 follow per 5–10 sec**. Niche-relevant only. Glance at 1–2 posts before following.
5. **F4F (Main):** follow amounts per Task checklist, split 2–3 sessions.
6. **Unfollow** (Alt) — anyone who hasn't followed back in 5–7 days. Never mass-unfollow. Spread throughout the day.
7. **Hard cap (safety ceiling):** 150 follows + 200 likes per device per day combined across all accounts — never exceed even if Task asks more.

**Time**
45–60 min daily total.

**Common mistakes**
- Scrolling Following tab instead of FYP → wrong algorithm signal.
- Skip videos in <2s → negative preference signal.
- Mass-follow burst → instant flag. Likes burst → spam.
- Exceed 150/200 device hard cap.
- Mass-unfollow in 1 batch → shadowban.

**Escalation**
- Action block popup → STOP follows/likes/comments, continue posting/stories/DMs, report + wait 48h.
- Follow ratio broken (following >> followers >2:1) → unfollow cycle, ping Marketing Manager.`,
  },
  {
    sort_order: 14,
    name: `End-of-day Discord/Telegram report`,
    kpi: `100% of daily reports posted before end-of-shift; all blocks/anomalies flagged same-day`,
    cadence_type: `daily`,
    cadence_note: `Daily end of shift, in Daily Reports channel`,
    sop_content: `**Purpose**
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
Ban/lock/orange → Account Defense + COO if Power Page. Equipment broken → Management Team. Creator unresponsive 24h+ → CSM.`,
  },
  {
    sort_order: 15,
    name: `Account Defense compliance (shared ownership)`,
    kpi: `0 rule violations/session; 100% always-on rules followed; all flags reported same-minute; EOD compliance log 100% filled`,
    cadence_type: `daily`,
    cadence_note: `Always-on every session + explicit EOD self-check`,
    sop_content: `**Purpose**

**When**
Always-on every session. Explicit self-check in EOD report.

**Tools**
- Ultimate Account Safety & Restrictions SOP (Notion)
- Account Status page (Settings → Account Status)
- Discord/Telegram Account Defense channel
- EOD compliance log

**Daily compliance — 12 always-on rules**
1. **Device:** Assigned device only, physical SIM, iCloud Backup + Find My OFF, no personal accounts.
3. **Warm-up:** 15-min warm-up before action. Never post-and-ghost (stay 5min post-post).
4. **Visual content:** Zero prohibited content. Lifestyle-first.
5. **Caption:** Zero forbidden words ("OnlyFans", "OF", "exclusive content", etc.).
6. **Posting mix:** 70–80% safe, 20–30% slight edge. Max 3 Reels/24h/account. Unique PFP + bio + highlights.
8. **Hashtags:** Verify each new hashtag. Max 5/post. Rotate every 3–4 posts.
9. **Stories & link sticker:** Link sticker only on verified or with Manager approval. Never direct OF link.
10. **Action limits:** Max 150 follows/day per device, max 200 likes/day per device. Never same DM to multiple users. Never link in DM.
11. **Bio & links:** Zero "OnlyFans"/"OF" anywhere. Zero direct links in bio/caption/DM.
12. **Account Center:** Never connect IG-FB-Threads without Marketing Manager approval.

**Early signal capture**
Orange flag → screenshot + report Head of Account Defense within minutes. Action block → STOP as required, continue allowed actions, report. Reach drop >50% in 24h → screenshot + report. Mass-removed content → screenshot + report. Login security check → screenshot + STOP, report.

**EOD self-check (5 min)**

**Time**
~7 min standalone overhead/day plus always-on discipline.

**Escalation**
Orange flag → immediate Head of Account Defense + STOP. Unauthorized Account Center link → Head of Account Defense + Marketing Manager. Permanent ban → Head of Account Defense owns appeal; VA does not act independently.`,
  },
  {
    sort_order: 16,
    name: `Weekly highlights & profile maintenance`,
    kpi: `Highlights refreshed weekly per creator categories (set with Marketing Manager); 0 stale (>2 weeks no update); bio/PFP matches Master`,
    cadence_type: `weekly`,
    cadence_note: `Once per week, per account (default Friday or off-peak)`,
    sop_content: `**Purpose**
Weekly profile maintenance — highlights refresh, cover updates, bio sync, PFP verification. Profile drift = trust score erosion.

**When**
Once per week (default Friday or off-peak). Per account.

**Tools**
- Account Master Reference
- iCloud (highlight cover assets)
- IG app
- Marketing Manager (per-creator highlight category list)

**Steps**
1. Open creator's profile → check highlight categories **defined per-creator with Marketing Manager** (not a fixed global list).
2. Per highlight: last update <14 days. Stale → add 1–2 new stories.
3. Refresh highlight covers. Verify bio matches Master template. Verify PFP is approved and not identical to another creator account.
4. Verify link in bio works. Account Center check for unauthorized Meta connections.
5. Log maintenance in weekly sheet.

**Time**
15–25 minutes per account.

**Common mistakes**
- Assuming default categories instead of per-creator list → wrong profile structure.
- Skipping because it "looks fine" → drift accumulates.
- Identical PFP cross-creator → Meta fingerprint match.
- Forgetting Account Center check → unauthorized link sneaks in.

**Escalation**
Unauthorized Meta connection → Marketing Manager + Head of Account Defense. Unexpected bio change → possible compromise, ping immediately.`,
  },
  {
    sort_order: 17,
    name: `Weekly KPI review with Marketing Manager`,
    kpi: `100% participation; all 8 KPIs reviewed per assigned creator; next-week priorities documented`,
    cadence_type: `weekly`,
    cadence_note: `Every Monday, 30–45min sync`,
    sop_content: `**Purpose**
Weekly sync with Marketing Manager — review 8 KPIs per creator, identify levers to pull, plan next week. You don't change the loop; you change the lever.

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
2 weeks missed targets + no clear cause → Head of Marketing. Suspected mass shadowban → Head of Account Defense.`,
  },
  {
    sort_order: 18,
    name: `Weekly content brief sync with Marketing Manager / Content Director`,
    kpi: `Briefs received 2–3 days before filming; all questions resolved before shoot; 0 day-of-shoot brief gaps`,
    cadence_type: `weekly`,
    cadence_note: `2–3 days before next filming day`,
    sop_content: `**Purpose**
Weekly sync to receive content briefs **2–3 days before filming day**, ask clarifications, align with filmer. Late briefs = panicked execution + bad content.

**Steps**
1. Receive brief: caption variants, hooks, vertical mix, posting concepts.
2. Read end-to-end. Cross-check vs Account Master voice and Templates & Assets.
3. Compile questions in one message. Sync with filmer on shots/angles. Sync with creator on expectations.
4. Confirm iCloud folder ready. Identify blockers (props, location, outfit).

**Time**
~45 min (review + sync).

**Escalation**
Brief arrives <24h before shoot → flag Marketing Manager. Brief contradicts Master voice → Content Director clarify.`,
  },
  {
    sort_order: 19,
    name: `Winner identification & report (weekly scan)`,
    kpi: `100% of videos meeting 2.5x threshold reported to Winner Videos channel in correct format; 0 raw-link reports`,
    cadence_type: `weekly`,
    cadence_note: `Once per week or when winners hit threshold mid-week`,
    sop_content: `**Purpose**
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
2 weeks zero winners → weekly KPI review. Winner deleted from IG → ping iCloud Manager for backup.`,
  },
  {
    sort_order: 20,
    name: `Variant repurposing batch (from Trials folder)`,
    kpi: `100% trial variants edited unique per session; 0 duplicate-content flags; batch ready before next day's posting`,
    cadence_type: `weekly`,
    cadence_note: `When iCloud Manager updates Trials folder`,
    sop_content: `**Purpose**
Batch-process Trial Reel variants from iCloud Manager → make each unique per upload (cut, brightness, overlay) → ready for posting.

**Steps**
2. Delete downloaded copy from device; keep iCloud master intact.
3. Max 2 settings per session dramatic. Always cut min 1 sec. Source always Trials, never Winners directly.

**Time**
3–5 min per video; batch 10–15 = ~45–75 min weekly.

**Escalation**
Trial subfolder empty → iCloud Manager. Similar content flag after edit → escalate variant rotation.`,
  },
  {
    sort_order: 21,
    name: `Weekly retro + next-week posting plan`,
    kpi: `100% Friday retros completed; next-week posting plan documented before EOW; all blocks flagged`,
    cadence_type: `weekly`,
    cadence_note: `Friday afternoon`,
    sop_content: `**Purpose**
Personal weekly retro — what worked, what didn't, what's blocked. Plan next week's posting cadence per creator.

**When**
Friday afternoon, before end of week.

**Steps**
1. Pull last 7 days daily logs. Aggregate per creator: posts, best/worst performer, DM funnel count.
2. Self-review: what changed this week that worked / didn't.
3. Identify blockers to resolve before Monday. Plan next week cadence, trials pipeline, filming alignment, highlight maintenance.
4. Post retro summary in Daily Reports (200–300 words). Flag blockers in Questions channel.

**Time**
30–45 min.

**Escalation**
Same blocker 2 weeks running → Marketing Manager. Burnout signals → CSM + Marketing Manager.`,
  },
  {
    sort_order: 22,
    name: `Monthly account performance retro (per creator)`,
    kpi: `100% of creators retro'd within 1st week of month; archived doc per creator; next-month plan documented`,
    cadence_type: `monthly`,
    cadence_note: `First week of each month`,
    sop_content: `**Purpose**
Monthly deep retro per creator — follower growth, vertical performance, cadence efficiency, KPI trends. Output: next-month adjustment plan.

**Steps**
1. Pull last 30 days: net follower growth, total posts, top/bottom 5 by views, 8 KPI trends, DM funnel conversion.
2. Identify which verticals worked/died, cadence sustainability, Master drift, device issues.
3. Cross-reference Content Director vertical scorecard. Document next-month plan: mix, cadence, experiments, highlight schedule.
4. Submit to Marketing Manager + Head of Marketing. Archive in Notion creator page.

**Time**
1.5–2 hours per creator.

**Escalation**
2 consecutive months declining → Head of Marketing + CSM. Suspected device contamination → Head of Account Defense.`,
  },
  {
    sort_order: 23,
    name: `Monthly safety audit (device + account hygiene)`,
    kpi: `0 unauthorized Account Center connections; 0 banned-hashtag usage; 100% device-creator mapping verified`,
    cadence_type: `monthly`,
    cadence_note: `End of month, anti-ban discipline check`,
    sop_content: `**Purpose**
Monthly anti-ban audit — device hygiene, Account Center clean, no banned hashtag drift, no Wi-Fi incidents, password manager integrity.

**Steps**
1. Per device: iCloud Backup + Find My disabled; no Wi-Fi use; dedicated Apple ID/Gmail; physical SIM; storage check.
2. Per account: Account Center unauthorized links; Account Status GREEN; bio/PFP match Master; pinned posts match strategy.
3. Hashtag audit vs banned list; verify rotation. Password manager credentials + recovery info correct.
4. Document in monthly safety log. Flag issues to Head of Account Defense same-day.

**Time**
1–1.5 hours for full portfolio.

**Escalation**
ANY unauthorized Account Center link → Head of Account Defense + Marketing Manager IMMEDIATELY. iCloud Backup enabled → factory reset path with Manager approval.`,
  },
  {
    sort_order: 24,
    name: `New IG/TikTok account setup (Day 1)`,
    kpi: `100% Day 1 setup complete before handoff; credentials logged same-minute; 0 Wi-Fi violations`,
    cadence_type: `daily`,
    cadence_note: `PER EVENT — when Head of Account Defense assigns new handle`,
    sop_content: `**[PER EVENT — Daily cadence used as placeholder. Trigger: Head of Account Defense assigns new handle for warm-up]**

**Purpose**

**IG Steps**
Mobile data only → fresh Gmail/Yahoo → 30min email warm-up → create IG account per Master → verify email → no link in bio, no posts → approved PFP → bio \`19 | FL\` or \`19 | FL | fitness\` → save credentials → idle 24h → hand off.

**TikTok Steps**
Fresh Gmail/Outlook → register → username/display per Master → PFP + bio → **log credentials in Google Sheet same-minute** → Day 1 warm-up only, NO posts (20–30 min FYP scroll, niche likes, 3–5 comments).

**Hard rules**
Never reuse email. Never TT password = email password. Never personal Apple ID on work device. Never skip credentials logging.

**Time**
~2 hours spread over Day 1.

**Escalation**`,
  },
  {
    sort_order: 25,
    name: `Account warm-up ramp (Days 1–3 new account)`,
    kpi: `100% 3-day warm-up completed before Phase 3 content go-live; 0 premature posting; 0 follows/DMs during warm-up`,
    cadence_type: `daily`,
    cadence_note: `PER EVENT — immediately after Day 1 setup of new account`,
    sop_content: `**[PER EVENT — Daily cadence placeholder. Trigger: Day 1 setup complete on new account]**

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
Action block during warm-up → STOP, screenshot, Marketing Manager. Phone re-verification → Head of Account Defense.`,
  },
  {
    sort_order: 26,
    name: `Trial Reels launch (per new variant batch)`,
    kpi: `100% Trials posted with toggle ON; 0 grid contamination; post verified in Trials section <60s; log filled`,
    cadence_type: `daily`,
    cadence_note: `PER EVENT — when Trial Reel variant ready from Cloud Manager batch`,
    sop_content: `**[PER EVENT — Daily cadence placeholder. Trigger: iCloud Manager updates Trial subfolder + variant edited per Repurpose SOP]**

**Purpose**
Post a Trial Reel — IG feature showing reel only to non-followers, never on grid, fully reusable. Gunzo's core cold-traffic scaling weapon.

**Cadence by tier**
New (<30d): 1–3/day. Aged (30+d): 5–20/day. Warmed (90+d): 20–50/day. Power Pages (200+d): 50–100+/day.

**Steps**
Enable Trial Reels in Professional Dashboard (one-time). Pull variant → New Reel → caption from Templates → cover → **Toggle Trial ON** → post → wait 60s verify in Trials section NOT grid → screenshot log → move to Grid (posted) subfolder.

**Time**
5–8 min per Trial post.

**Escalation**
Reel on grid → delete + repost with toggle ON. Trial feature lost → Marketing Manager. Variant flagged 3x → Content Director.`,
  },
  {
    sort_order: 27,
    name: `Ban / restriction / shadowban triage (per incident)`,
    kpi: `100% incidents reported same-minute; all screenshots captured; 0 VA-independent appeals; backup activated within day for disables`,
    cadence_type: `daily`,
    cadence_note: `PER EVENT — orange flag, action block, shadowban, disable, or permanent ban`,
    sop_content: `**[PER EVENT — Daily cadence placeholder]**

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
Power Page incident → COO + Head of Account Defense. Cascade (multiple accounts orange same day) → immediate Head of Account Defense + COO.`,
  },
  {
    sort_order: 28,
    name: `Creative production support (carousel/story/edit requests from Content Director)`,
    kpi: `100% requests delivered within agreed turnaround; 0 voice/aesthetic mismatches; all assets archived in iCloud`,
    cadence_type: `daily`,
    cadence_note: `PER EVENT — when Content Director queues creative request`,
    sop_content: `**[PER EVENT — Daily cadence placeholder]**

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
Scope creep → Content Director. Missing source → iCloud Manager. Conflicts with daily cadence → Marketing Manager prioritize.`,
  },
  {
    sort_order: 29,
    name: `Account handoff (offboarding / VA transition)`,
    kpi: `100% credentials transferred securely; factory reset where required; 0 unauthorized access post-handoff`,
    cadence_type: `daily`,
    cadence_note: `PER EVENT — account transferred to another VA, or VA leaves`,
    sop_content: `**[PER EVENT — Daily cadence placeholder]**

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
Departing VA refuses device → HR + Head of Account Defense. Unauthorized Account Center post-handoff → immediate forensics. New VA fails Day 1 checks → re-training before continuing.`,
  },
];
