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
    name: "IP rotation & account status check (morning)",
    kpi: "100% of sessions start with verified IP + Account Status check; 0 incidents from Wi-Fi or missed IP rotation",
    cadence_type: "daily",
    cadence_note: "Daily, before every session — first task",
    sop_content: `**Purpose**
Before you touch any account, confirm the device is on mobile data, the IP has changed, and Account Status is green on every handle you will work today.

**When**
First task of every session, and again each time you switch accounts on the same device.

**Tools**
- Phone (work device — assigned hardware)
- WhatIsMyIp.com (bookmarked)
- IG/FB/TT app → Settings → Account Status

**Steps**
1. Confirm the device is on mobile data — Wi-Fi OFF, eSIM/VPN/Proxy OFF.
2. Airplane mode ON → wait 10–30 seconds → airplane mode OFF → mobile data ON.
3. Open WhatIsMyIp.com and confirm the IP changed from the previous session. Same IP → retry.
4. Open each account you will work → Settings → Account Status. All sections must be green.
5. If you see an orange flag → screenshot immediately + ping Marketing Manager. Do NOT start posting/engagement until you have guidance.
6. Log in the daily sheet: timestamp + last 2 digits of IP + status per account.

**Time**
3–5 minutes for IP rotation + status check (scales with number of accounts on the device).

**Common mistakes**
- Saying "I changed IP" without verifying on WhatIsMyIp — the same IP can hide behind an airplane-mode toggle if you do not wait long enough.
- Turning on Wi-Fi "just for 2 minutes to download something" — instant link between accounts.
- Skipping Account Status to save time — most bans start from an ignored orange flag.
- Continuing to post with an orange flag — accelerates shadowban/disable.

**Escalation**
- Orange on Account Status → Marketing Manager + screenshot.
- Action block popup → STOP likes/follows/comments; continue only posting/stories/DM replies; report.
- Same IP after 3 retries → swap SIM/device with Marketing Manager.`,
  },
  {
    sort_order: 2,
    name: "Master Account check & device assignment verify (morning)",
    kpi: "0 cross-device incidents; 100% of posts made from the correct assigned device",
    cadence_type: "daily",
    cadence_note: "Daily before posting, per creator you will work",
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
    name: "iCloud content pull & Templates & Assets check (morning)",
    kpi: "100% of today's briefs/files identified before noon local time; 0 posting delays due to missing assets",
    cadence_type: "daily",
    cadence_note: "Daily morning, before posting",
    sop_content: `**Purpose**
Gather all content assets you need for the day: today's brief from Content Director, video files in iCloud, and templates from the Templates & Assets channel.

**When**
Daily morning, after IP/status check, before you start posting.

**Tools**
- iCloud folder per creator (\`/Creator_Name/Not Used/\`, \`/Used/\`, \`/Trials/\`)
- Telegram → Templates & Assets channel
- Discord → today's brief / caption drop from Marketing Manager

**Steps**
1. Open Discord/Telegram → check today's brief: captions, hooks, posting concepts.
2. Open iCloud → \`/Creator_Name/Not Used/\` → identify videos for Main + Alt + Trial.
3. Open \`/Month_Day/Trials/\` — if not ready, ping iCloud Manager.
4. Open Templates & Assets channel — pull ready stories/captions before building from scratch.
5. Pre-check: all videos are 9:16 vertical, no IG/TikTok watermark, no CapCut watermark/outro.
6. Mental plan: which post goes where, what time (creator's US local time zone), which account.

**Time**
10–15 minutes.

**Common mistakes**
- Building from scratch when a template exists — duplicate effort + inconsistent voice.
- Not checking iCloud before posting → discover missing brief at noon.
- Using a file already marked "Used" → duplicate detection penalty.
- Watermark left on video → instant downrank.

**Escalation**
- Missing brief for the day after 10:00 AM local → ping Marketing Manager + Content Director.
- Trials folder empty → iCloud Manager.
- Template gap (no caption fits) → flag in Questions channel.`,
  },
  {
    sort_order: 4,
    name: "Account warm-up routine (daily 10-min)",
    kpi: "100% of accounts warmed up before posting; 0 post-and-ghost incidents",
    cadence_type: "daily",
    cadence_note: "Daily before posting, per account",
    sop_content: `**Purpose**
10-minute daily warm-up before any action — trains the algorithm that the account is a real user, not a bot. Strongest trust-score signal Gunzo has.

**When**
Daily before posting/engagement, per account. Again after every IP switch.

**Tools**
- IG/TT/FB app (platform-appropriate)

**Steps**
1. Open app → Explore/Reels/FYP feed.
2. Scroll for 3–5 minutes; watch videos to completion (do not skip at 1 sec).
3. Like 3–5 random posts outside the niche (natural behavior).
4. Watch 5–10 stories.
5. Send 1–2 reels via DM to other accounts (strongest human signal for the algorithm).
6. Stay active 5 minutes after warm-up — never post-and-ghost.
7. Only then → start posting/engagement.

**Time**
10 minutes per account.

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
    name: "IG Reel/feed post (midday + evening)",
    kpi: "100% of posts published on schedule; 0 watermark/duplicate flags; posting log complete",
    cadence_type: "daily",
    cadence_note: "12:00 PM and 8:00 PM local (creator US time zone) per Main account; +1 repurposed on Alt",
    sop_content: `**Purpose**
Daily IG Reel posting from Main + Alt accounts at scheduled times, with correct caption, hashtags, and cover.

**When**
Main: **12:00 PM** and **8:00 PM** in the creator's local US time zone. Alt: +1 repurposed copy mid-shift. Min 2h gap between posts on the same account.

**Tools**
- iCloud (assigned video)
- IG app
- Caption from Content Director (Discord/Telegram drop)
- Approved hashtag list

**Steps**
1. IP check + warm-up done.
2. Download video from iCloud → Not Used.
3. IG → + → Reel → select.
4. Pick a strong cover frame — not random.
5. Paste caption from Content Director **as-is** — do not rewrite.
6. Hashtags: 3–5 max, placed 3–4 line breaks below caption. Rotate set every 3–4 posts.
7. Audio: trending sound only if it fits; otherwise original.
8. Verify Trial toggle: OFF for normal Reel, ON for trial (separate SOP).
9. Share → confirm live → screenshot.
10. Move file: \`Not Used → Used → IG → [Date] → Main\`.
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
- Forgetting to move file to Used → re-upload risk.

**Escalation**
- Post stuck at 0 views >1h → possible shadowban, ping Marketing Manager.
- Audio missing/removed by IG → re-upload with different sound.
- Cover refuses to set → IG bug, force-quit + retry.`,
  },
  {
    sort_order: 6,
    name: "TikTok daily post (midday)",
    kpi: "1 TT post/account/day; 0 IG watermark incidents; vertical 9:16 100%",
    cadence_type: "daily",
    cadence_note: "Daily midday, 1 post/account",
    sop_content: `**Purpose**
Daily TikTok post — repurposed from IG winner (default) or recreated trend (when no IG match exists).

**When**
Daily midday window. Order: **Scroll → Like → Post → F4F**.

**Tools**
- IG (source video)
- Watermark removal tool (approved)
- TikTok app
- Trending sounds library (TT)

**Steps**
1. IP check + 20–30min FYP scroll (algorithm warm-up).
2. Pick yesterday's IG Reel with best engagement OR find a trending format to recreate.
3. Download IG video **without watermark** (approved tool). Any other watermark = downrank.
4. TikTok → + → gallery → select.
5. Add **trending sound** — not original IG audio.
6. Caption: 1–2 short lines + 3–5 niche hashtags.
7. Verify vertical 9:16.
8. Post.
9. Stay in app 1–2 minutes (active-user signal).
10. Log post ID/link in daily sheet.

**Time**
6–10 minutes per post (includes pre-post scroll).

**Common mistakes**
- Keeping IG watermark → instant downrank.
- Original IG audio instead of trending TT sound → no velocity push.
- Long caption → kills retention.
- Photo-only post → TT default rejection.
- Posting 2 videos within 5 minutes → split reach.

**Escalation**
- Trial option missing → account not eligible, ping Marketing Manager.
- Watermark removal tool down → use alternative listed in Templates & Assets, or delay post.`,
  },
  {
    sort_order: 7,
    name: "Facebook cross-post & accept requests (daily)",
    kpi: "1 FB Reel cross-posted/day same-day; 100% of legitimate friend requests accepted",
    cadence_type: "daily",
    cadence_note: "Daily, min 30min after IG post",
    sop_content: `**Purpose**
Daily FB Reel cross-post from IG (+50% distribution boost when same-day) + accept inbound friend requests. FB is a live channel, not a passive mirror.

**When**
Daily. Order: **IP Check → Cross Post → Accept Requests → Scrolling → Liking**. Min 30 min gap from IG upload on the same device.

**Tools**
- IG app (source)
- FB app
- WhatIsMyIp.com

**Steps**
1. IG → find today's Reel → download video to phone.
2. IP check **before** switching apps. IP must differ from what you used for IG upload.
3. FB → Reels → select video.
4. Caption: same as IG, optionally slightly different hook for FB.
5. Post.
6. Open Friend Requests → accept ALL legitimate (not spam/non-target language/zero-photo profiles).
7. 20–30min Feed scroll; watch niche videos to completion.
8. 30–50 niche post likes with 5-sec gaps. 10–15 niche story likes.

**Time**
20–30 minutes (cross-post + accept + scroll).

**Common mistakes**
- Cross-posting IG + FB simultaneously → FB flags as bot.
- Using Wi-Fi to save data → accounts linked via IP.
- Accepting Arabic/spam requests → engagement rate tanks.
- 50 likes in a 2-minute burst → spam flag.
- Skipping same-day crosspost → lose distribution boost.

**Escalation**
- FB locks accept feature → Marketing Manager (possible feature restriction).
- Friend requests stuck at 0 inbound for 3+ days → re-engage groups (separate SOP).`,
  },
  {
    sort_order: 8,
    name: "Daily Stories cadence (lifestyle slots)",
    kpi: "3–5 stories/day delivered; 100% mix (lifestyle + engagement); 0 explicit story bans",
    cadence_type: "daily",
    cadence_note: "Daily, 3–5 stories spread morning/midday/evening (creator local US time)",
    sop_content: `**Purpose**
Daily IG stories — closest touchpoint with the audience. Mix lifestyle + activity + engagement sticker. Builds trust + warms audience before the evening CTA story.

**When**
Daily, 3–5 stories spread across morning / midday / afternoon / evening. Never batch.

**Tools**
- iCloud (story-approved photos)
- Templates & Assets channel (ready stickers/copy)
- IG app

**Steps**
1. Morning slot (8:00–11:00 AM local): soft lifestyle — coffee, breakfast, gym mirror selfie.
2. Midday slot (12:00–3:00 PM local): activity — gym set, food, walk, outfit.
3. Afternoon slot (4:00–6:00 PM local): engagement sticker — poll, quiz, "this or that".
4. Evening slot (7:00–10:00 PM local): suggestive tease (but not explicit). Low-light selfie, outfit reveal.
5. Reshare today's Reel to story **within the 1st hour** of the Reel post (velocity signal).
6. At least 2 stories/week with poll or quiz sticker (boosts engagement rank).
7. Reply to story replies within 30 min per reply.
8. Stop at 5 stories/day max — past 5, read-rate collapses.

**Time**
15–25 minutes spread across the day (3–5 min per slot).

**Common mistakes**
- Batching all 5 stories in the morning → 80% never get seen.
- Explicit story → ban risk + downrank.
- No CTA story all day — leaves Evening CTA SOP without buildup.
- Story replies ignored >30 min → miss conversion window.

**Escalation**
- Link sticker unavailable → bio-only CTA today, ping Marketing Manager (possible feature restriction).
- 3 consecutive days with 0 story views → possible shadowban, escalate.`,
  },
];
