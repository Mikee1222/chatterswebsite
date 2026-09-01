#!/usr/bin/env python3
"""Generate corrected Greek + English Marketing Executive SOP seed TS files."""
from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
GREEK_JSON = Path("/tmp/greek-source.json")

ICLOUD_TOOLS_GR = """- iCloud folders per creator:
  - **Social Media Posts:** Model → Content to Upload → Social Media Posts → Year → Month → Carousel 1, 2…
  - **Stories:** Model → Content to Upload → Stories To Upload → CTA or Daily → Year → Month → Week → Day (weeks 1–7, 8–15, κ.λπ.)
  - **Videos:** Model → Content to Upload → Video To Upload → Year → Month → Week → Day → Main Account ή Secondary Account → Trial ή Grid"""

ICLOUD_TOOLS_EN = """- iCloud folders per creator:
  - **Social Media Posts:** Model → Content to Upload → Social Media Posts → Year → Month → Carousel 1, 2…
  - **Stories:** Model → Content to Upload → Stories To Upload → CTA or Daily → Year → Month → Week → Day (weeks 1–7, 8–15, etc.)
  - **Videos:** Model → Content to Upload → Video To Upload → Year → Month → Week → Day → Main Account or Secondary Account → Trial or Grid"""

CTA_SCHEDULE_GR = (
    "weekly Link A/B schedule (model_story_link_config): Δευτέρα Link A, Τετάρτη Link B, "
    "Παρασκευή Highlights redirect, Σάββατο Link A"
)
CTA_SCHEDULE_EN = (
    "weekly Link A/B schedule (model_story_link_config): Monday Link A, Wednesday Link B, "
    "Friday Highlights redirect, Saturday Link A"
)


def ts_escape(s: str) -> str:
    return s.replace("\\", "\\\\").replace("`", "\\`").replace("${", "\\${")


def emit_ts(path: Path, type_name: str, const_name: str, funcs: list[dict]) -> None:
    lines = [
        f"export type {type_name} = {{",
        "  sort_order: number;",
        "  name: string;",
        "  kpi: string;",
        '  cadence_type: "daily" | "weekly" | "monthly" | "per_event";',
        "  cadence_note: string;",
        "  sop_content: string;",
        "};",
        "",
        f"export const {const_name}: {type_name}[] = [",
    ]
    for fn in funcs:
        lines.append("  {")
        lines.append(f"    sort_order: {fn['sort_order']},")
        lines.append(f"    name: `{ts_escape(fn['name'])}`,")
        lines.append(f"    kpi: `{ts_escape(fn['kpi'])}`,")
        lines.append(f"    cadence_type: `{fn['cadence_type']}`,")
        lines.append(f"    cadence_note: `{ts_escape(fn['cadence_note'])}`,")
        lines.append(f"    sop_content: `{ts_escape(fn['sop_content'])}`,")
        lines.append("  },")
    lines.append("];")
    lines.append("")
    path.write_text("\n".join(lines), encoding="utf-8")


def strip_ip_lines(text: str) -> str:
    skip = [
        r"WhatIsMyIp",
        r"IP rotation",
        r"IP switch",
        r"IP check",
        r"IP must differ",
        r"IP last 2 digits",
        r"IP rotated",
        r"Same IP after",
        r"verified IP",
        r"missed IP",
        r"IP-safe",
        r"accounts linked via IP",
        r"Airplane mode",
        r"airplane mode",
        r"airplane-mode",
    ]
    out = []
    for line in text.split("\n"):
        if any(re.search(p, line, re.I) for p in skip):
            continue
        if re.search(r"\bIP\b", line) and re.search(
            r"check|rotation|switch|verify|digits|changed|differ", line, re.I
        ):
            continue
        out.append(line)
    return re.sub(r"\n{3,}", "\n\n", "\n".join(out)).strip()


def strip_watermark_lines(text: str) -> str:
    patterns = [
        r".*[Ww]atermark.*\n?",
        r".*CapCut watermark.*\n?",
        r".*CapCut pre-check.*\n?",
        r".*Watermark removal tool.*\n?",
        r".*watermarks in today.*\n?",
        r".*Never reupload.*watermark.*\n?",
        r".*watermark leftover.*\n?",
    ]
    for p in patterns:
        text = re.sub(p, "", text, flags=re.I)
    return re.sub(r"\n{3,}", "\n\n", text).strip()


def replace_icloud(text: str, lang: str) -> str:
    tools = ICLOUD_TOOLS_GR if lang == "gr" else ICLOUD_TOOLS_EN
    trial = "Trial ή Grid" if lang == "gr" else "Trial or Grid"
    pairs = [
        (r"iCloud folder per creator \(`[^`]+`\)", tools),
        (r"- iCloud folder per creator \([^)]+\)", tools),
        (r"`/Creator_Name/Not Used/`", f"`Model → Content to Upload → Video To Upload → … → {trial}`"),
        (r"`/Month_Day/Trials/`", "`Model → Content to Upload → Video To Upload → … → Trial`"),
        (r"/Month_Day/Trials/", "Video To Upload → … → Trial"),
        (
            r"Not Used → Used → IG → \[Date\] → Main",
            "Video To Upload → [Year] → [Month] → [Week] → [Day] → [Account] → Grid (posted)",
        ),
        (r"Not Used → Used", "Video To Upload → posted subfolder"),
        (
            r"Download video (?:από|from) iCloud → Not Used",
            f"Download video {'από' if lang=='gr' else 'from'} iCloud → Video To Upload → assigned day folder → {trial}",
        ),
        (
            r"Pull source from iCloud/Templates",
            "Pull source from iCloud (Social Media Posts / Stories / Video To Upload) + Templates",
        ),
        (
            r"Archive in Ready_To_Post folder",
            "Archive in Social Media Posts folder (correct month/carousel slot)",
        ),
        (
            r"identify (?:τα )?videos (?:για|for) Main \+ Alt \+ Trial",
            f"identify videos {'στο' if lang=='gr' else 'in'} Video To Upload path (Main/Secondary → {trial})",
        ),
        (r"Trials folder", "Trial subfolder"),
        (
            r"Pre-check: (?:όλα τα|all) videos (?:είναι|are) 9:16 vertical,[^\n]+",
            "Pre-check: όλα τα videos είναι 9:16 vertical."
            if lang == "gr"
            else "Pre-check: all videos are 9:16 vertical.",
        ),
        (
            r"iCloud \(approved CTA photo\)",
            "iCloud → Stories To Upload → CTA (assigned week/day)",
        ),
        (
            r"iCloud \(story-approved photos\)",
            "iCloud → Stories To Upload → Daily (assigned week/day)",
        ),
    ]
    for old, new in pairs:
        text = re.sub(old, new, text)
    return text


def build_greek(source: list[dict]) -> list[dict]:
    out: list[dict] = []
    for fn in source:
        so = fn["sort_order"]
        row = dict(fn)
        content = fn["sop_content"]

        if so == 1:
            row["name"] = "Account status check (morning)"
            row["kpi"] = (
                "100% sessions ξεκινούν με Account Status check· 0 incidents από missed status review"
            )
            row["sop_content"] = """**Σκοπός**
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
- Action block popup → STOP likes/follows/comments, continue μόνο posting/stories/DM replies, report."""

        elif so == 4:
            row["name"] = "Account warm-up routine (daily 15-min)"
            row["kpi"] = row["kpi"].replace("10-min", "15-min")
            content = content.replace("10λεπτο", "15λεπτο")
            content = re.sub(r"Ξανά μετά από κάθε IP switch\.\n?", "", content)
            content = content.replace("Scroll για 3-5 λεπτά", "Scroll για 15 λεπτά")
            content = content.replace("**Time**\n10 λεπτά", "**Time**\n15 λεπτά")
            row["sop_content"] = content

        elif so == 6:
            row["kpi"] = "2 TT posts/account/day· vertical 9:16 100%"
            row["cadence_note"] = "Ανά assigned Task schedule — 2 posts/account/day"
            row["sop_content"] = f"""**Σκοπός**
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
- Assigned folder empty → iCloud Manager."""

        elif so == 7:
            row["sop_content"] = """**Σκοπός**
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
- Friend requests stuck at 0 inbound για 3+ μέρες → re-engage groups (separate SOP)."""

        elif so == 8:
            row["kpi"] = "2 lifestyle/engagement stories/day· 100% mix· 0 explicit story bans"
            row["cadence_note"] = "Καθημερινά, 2 stories spread across day (creator local time)"
            row["sop_content"] = f"""**Σκοπός**
Daily IG stories — closest touchpoint με audience. 2 lifestyle/engagement stories/day. Builds trust + warms audience πριν το CTA story.

**Πότε**
Καθημερινά, 2 stories spread across the day. Never batch. CTA story ακολουθεί {CTA_SCHEDULE_GR}.

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
- 3 consecutive days με 0 story views → possible shadowban, escalate."""

        elif so == 9:
            content = strip_ip_lines(content)
            content = content.replace("1. IP check πρώτα.\n2. ", "1. ")
            content = content.replace(
                "**Πότε**\nΚαθημερινά **19:00-23:00**. 1 story/day (additional to the 3-5 lifestyle slots).",
                f"**Πότε**\nΑνά {CTA_SCHEDULE_GR}. 1 CTA story στο assigned slot (επιπλέον των 2 lifestyle stories).",
            )
            content = content.replace(
                "- Link sticker unavailable on this account → bio-driven CTA, escalate (verified account or Marketing Manager approval needed).",
                "- Link sticker unavailable → **Highlight redirect** (standard fallback — ποτέ bio για CTA). Escalate στο Marketing Manager.",
            )
            row["sop_content"] = replace_icloud(content, "gr")

        elif so == 13:
            row["kpi"] = "Follow amounts per assigned Task checklist· ratio healthy· hard cap respected"
            row["sop_content"] = """**Σκοπός**
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
- Follow ratio broken (following >> followers >2:1) → unfollow cycle, ping Marketing Manager."""

        elif so == 16:
            row["kpi"] = (
                "Highlights refreshed weekly per creator categories (set with Marketing Manager); "
                "0 stale (>2 weeks); bio/PFP matches Master"
            )
            row["sop_content"] = """**Σκοπός**
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
- Bio change που δεν made the VA → possible compromise, ping immediately."""

        else:
            if so == 5:
                row["kpi"] = "100% posts ανέβηκαν στην ώρα τους, 0 duplicate flags, posting log complete"
                row["sop_content"] = """**Σκοπός**
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
- Cover refuses to set → IG bug, force-quit + retry."""
            else:
                content = replace_icloud(content, "gr")
                content = content.replace(
                    "1. IP check + warm-up done.\n2.",
                    "1. Account status check + warm-up done.\n2.",
                ) if "IP check" in content else content
                content = strip_ip_lines(content)
                content = strip_watermark_lines(content)
                content = re.sub(r"\d+\. IP check[^\n]*\n", "", content)
                if so == 3:
                    content = content.replace("μετά το IP/status check", "μετά το Account Status check")
                if so in (24, 25):
                    content = strip_ip_lines(content)
                    if so == 24:
                        content = content.replace("- New work device + assigned IP plan\n", "- New work device (farm-controlled)\n")
                        content = content.replace("- Reuse phone/IP across creators", "- Reuse phone across creators")
                    if so == 25:
                        content = re.sub(r"3\. Log each session[^\n]+\n", "", content)
                        content = re.sub(r"- IP keeps returning[^\n]+(\n|$)", "", content)
                        content = re.sub(r"IP verified[^\n]*(\n|$)", "", content)
                if so == 29:
                    content = content.replace("keep IP rotation; log pause date", "log pause date")
                if so == 26:
                    content = replace_icloud(content, "gr")
                    content = content.replace("/AlreadyPosted/", "Grid (posted) subfolder")
                if so == 15:
                    content = content.replace("10-min warm-up", "15-min warm-up")
                    content = content.replace(
                        "Wi-Fi, missed warm-up, banned hashtag, watermark leftover",
                        "Wi-Fi, missed warm-up, banned hashtag",
                    )
                    content = re.sub(
                        r"2\. \*\*Network:\*\*[^\n]+\n",
                        "2. **Network:** Mobile data only — NEVER Wi-Fi/VPN/Proxy/eSIM.\n",
                        content,
                    )
                    content = re.sub(r"; IP rotated before each switch \(Y/N\)[^;]*;", ";", content)
                if so == 28:
                    content = replace_icloud(content, "gr")
                row["sop_content"] = content.strip()

        if so not in (1, 4, 6, 7, 8, 9, 13, 16):
            row["name"] = row["name"].replace(
                "IP rotation & account status check", "Account status check"
            )
            if "10-min" in row["name"]:
                row["name"] = row["name"].replace("10-min", "15-min")
            row["kpi"] = re.sub(r"verified IP \+ ", "", row["kpi"])
            row["kpi"] = re.sub(r"IP \+ ", "", row["kpi"])
            row["kpi"] = re.sub(r"missed IP[^;,]*", "missed status review", row["kpi"])
            row["kpi"] = re.sub(r"0 Wi-Fi/IP violations", "0 Wi-Fi violations", row["kpi"])
            row["kpi"] = re.sub(r"IG watermark incidents[^;]*", "duplicate-content flags", row["kpi"])
            row["kpi"] = re.sub(r"5 active highlights", "highlights per creator categories", row["kpi"])

        out.append(row)
    return out


def parse_us_original(path: Path) -> list[dict]:
    """Parse marketing-executives-us-functions.ts from git HEAD."""
    text = path.read_text(encoding="utf-8")
    blocks = re.split(r"\n  \{\n", text)[1:]
    funcs: list[dict] = []
    for block in blocks:
        so = int(re.search(r"sort_order: (\d+)", block).group(1))
        name = re.search(r'name: "([^"]+)"', block).group(1)
        kpi = re.search(r'kpi: "([^"]+)"', block).group(1)
        cadence_type = re.search(r'cadence_type: "([^"]+)"', block).group(1)
        cadence_note = re.search(r'cadence_note: "([^"]+)"', block).group(1)
        content_m = re.search(r"sop_content: `((?:\\.|[^`])*)`", block, re.DOTALL)
        content = content_m.group(1).replace("\\`", "`") if content_m else ""
        funcs.append(
            {
                "sort_order": so,
                "name": name,
                "kpi": kpi,
                "cadence_type": cadence_type,
                "cadence_note": cadence_note,
                "sop_content": content,
            }
        )
    return sorted(funcs, key=lambda f: f["sort_order"])


def apply_corrections_en(fn: dict) -> dict:
    """Apply all 9 correction sets to an original English function."""
    so = fn["sort_order"]
    row = dict(fn)
    content = fn["sop_content"]

    if so == 1:
        row["name"] = "Account status check (morning)"
        row["kpi"] = (
            "100% of sessions start with Account Status check; 0 incidents from missed status review"
        )
        row["sop_content"] = """**Purpose**
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
- Action block popup → STOP likes/follows/comments; continue only posting/stories/DM replies; report."""

    elif so == 3:
        content = replace_icloud(content, "en")
        content = strip_watermark_lines(content)
        content = content.replace("after IP/status check", "after Account Status check")
        content = content.replace(
            '- Using a file already marked "Used" → duplicate detection penalty.',
            "- Re-using a file already marked posted in Grid/Trial folder → duplicate detection penalty.",
        )
        row["sop_content"] = content

    elif so == 4:
        row["name"] = "Account warm-up routine (daily 15-min)"
        content = content.replace("10-minute", "15-minute").replace("10 minutes", "15 minutes")
        content = re.sub(r"Again after every IP switch\.\s*", "", content)
        content = content.replace("Scroll for 3–5 minutes", "Scroll for 15 minutes")
        row["sop_content"] = content

    elif so == 5:
        row["kpi"] = "100% of posts published on schedule; 0 duplicate flags; posting log complete"
        row["sop_content"] = """**Purpose**
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
- Cover refuses to set → IG bug, force-quit + retry."""

    elif so == 6:
        row["name"] = "TikTok daily post"
        row["kpi"] = "2 TT posts/account/day; vertical 9:16 100%"
        row["cadence_note"] = "Per assigned Task schedule — 2 posts/account/day"
        row["sop_content"] = """**Purpose**
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
- Assigned folder empty → iCloud Manager."""

    elif so == 7:
        row["sop_content"] = """**Purpose**
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
- Friend requests stuck at 0 inbound for 3+ days → re-engage groups (separate SOP)."""

    elif so == 8:
        row["kpi"] = "2 lifestyle/engagement stories/day delivered; 100% mix; 0 explicit story bans"
        row["cadence_note"] = "Daily, 2 stories spread across day (creator local US time)"
        row["sop_content"] = f"""**Purpose**
Daily IG stories — closest touchpoint with the audience. 2 lifestyle/engagement stories/day. Builds trust + warms audience before the CTA story.

**When**
Daily, 2 stories spread across the day. Never batch. CTA story follows {CTA_SCHEDULE_EN}.

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
- 3 consecutive days with 0 story views → possible shadowban, escalate."""

    elif so == 9:
        row["kpi"] = (
            "1 CTA story/day per weekly Link A/B schedule; 100% link verified post-publish; "
            "0 explicit ban incidents"
        )
        row["cadence_note"] = f"Per {CTA_SCHEDULE_EN} — 1 CTA story on assigned slot"
        content = strip_ip_lines(content)
        content = content.replace("1. IP check first.\n2. ", "1. ")
        content = content.replace(
            "Daily **7:00–11:00 PM** in the creator's local US time zone. 1 story/day (in addition to the 3–5 lifestyle slots).",
            f"Per {CTA_SCHEDULE_EN}. 1 CTA story on the assigned slot (in addition to the 2 lifestyle stories).",
        )
        content = content.replace(
            "- Link sticker unavailable on this account → bio-driven CTA, escalate (verified account or Marketing Manager approval needed).",
            "- Link sticker unavailable → **Highlight redirect** (standard fallback — never bio for CTA). Escalate to Marketing Manager.",
        )
        content = content.replace(
            "- iCloud (approved CTA photo)",
            "- iCloud → Stories To Upload → CTA (assigned week/day)",
        )
        content = content.replace(
            "3. Swipe up → sticker bar → **Link** sticker → paste link.",
            "3. Swipe up → sticker bar → **Link** sticker → paste link per weekly schedule (Link A or Link B from model_story_link_config).",
        )
        row["sop_content"] = content

    elif so == 13:
        row["kpi"] = "Follow amounts per assigned Task checklist; ratio healthy; hard cap respected"
        row["sop_content"] = """**Purpose**
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
- Follow ratio broken (following >> followers >2:1) → unfollow cycle, ping Marketing Manager."""

    elif so == 15:
        content = strip_ip_lines(content)
        content = strip_watermark_lines(content)
        content = content.replace("10-min warm-up", "15-min warm-up")
        content = content.replace(
            "Wi-Fi, missed warm-up, banned hashtag, watermark leftover",
            "Wi-Fi, missed warm-up, banned hashtag",
        )
        content = re.sub(
            r"2\. \*\*Network:\*\*[^\n]+\n",
            "2. **Network:** Mobile data only — NEVER Wi-Fi/VPN/Proxy/eSIM.\n",
            content,
        )
        content = re.sub(r"- WhatIsMyIp\.com bookmark\n", "", content)
        content = re.sub(r"; IP rotated before each switch \(Y/N\)[^;]*;", ";", content)
        content = re.sub(r"; watermarks in today's posts \(Y/N expected N\)", "", content)
        row["sop_content"] = content

    elif so == 16:
        row["kpi"] = (
            "Highlights refreshed weekly per creator categories (set with Marketing Manager); "
            "0 stale (>2 weeks no update); bio/PFP matches Master"
        )
        row["sop_content"] = """**Purpose**
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
Unauthorized Meta connection → Marketing Manager + Head of Account Defense. Unexpected bio change → possible compromise, ping immediately."""

    elif so == 20:
        content = replace_icloud(content, "en")
        content = strip_watermark_lines(content)
        row["sop_content"] = content

    elif so == 24:
        row["kpi"] = "100% Day 1 setup complete before handoff; credentials logged same-minute; 0 Wi-Fi violations"
        content = strip_ip_lines(content)
        content = content.replace("IP-safe creation", "farm-controlled device")
        content = content.replace("- New work device + assigned IP plan\n", "- New work device (farm-controlled)\n")
        content = content.replace(
            "- Reuse phone/IP across creators → cross-contamination → mass-ban.",
            "- Reuse phone across creators → cross-contamination → mass-ban.",
        )
        content = re.sub(r"- Same IP after 3 retries[^\n]+\n", "", content)
        row["sop_content"] = content

    elif so == 25:
        content = strip_ip_lines(content)
        content = content.replace("10-min warm-up", "15-min warm-up")
        row["sop_content"] = content

    elif so == 26:
        content = replace_icloud(content, "en")
        content = content.replace("move to AlreadyPosted", "move to Grid (posted) subfolder")
        row["sop_content"] = content

    elif so == 28:
        content = replace_icloud(content, "en")
        row["sop_content"] = content

    elif so == 29:
        content = content.replace("keep IP rotation; log pause date", "log pause date")
        row["sop_content"] = content

    else:
        content = replace_icloud(content, "en")
        content = strip_ip_lines(content)
        content = strip_watermark_lines(content)
        content = re.sub(r"\d+\. IP check[^\n]*\n", "", content)
        row["name"] = row["name"].replace("IP rotation & account status check", "Account status check")
        if "10-min" in row["name"]:
            row["name"] = row["name"].replace("10-min", "15-min")
        row["kpi"] = re.sub(r"verified IP \+ ", "", row["kpi"])
        row["kpi"] = re.sub(r"IP \+ ", "", row["kpi"])
        row["kpi"] = re.sub(r"missed IP[^;,]*", "missed status review", row["kpi"])
        row["kpi"] = re.sub(r"0 Wi-Fi/IP violations", "0 Wi-Fi violations", row["kpi"])
        row["kpi"] = re.sub(r"IG watermark incidents[^;]*", "duplicate-content flags", row["kpi"])
        row["kpi"] = re.sub(r"5 active highlights", "highlights per creator categories", row["kpi"])
        row["sop_content"] = content

    return row


def build_english(us_original: list[dict]) -> list[dict]:
    """Apply corrections to original US English functions."""
    return [apply_corrections_en(fn) for fn in us_original]


def main() -> int:
    if not GREEK_JSON.exists():
        subprocess.run(
            ["git", "show", "7dee4c1^:scripts/.marketing-exec-greek-source.json"],
            cwd=ROOT,
            stdout=GREEK_JSON.open("w"),
            check=True,
        )

    us_original_path = Path("/tmp/us-original.ts")
    if not us_original_path.exists():
        subprocess.run(
            ["git", "show", "HEAD:lib/sop-seed/marketing-executives-us-functions.ts"],
            cwd=ROOT,
            stdout=us_original_path.open("w"),
            check=True,
        )

    source = json.loads(GREEK_JSON.read_text(encoding="utf-8"))
    greek = build_greek(source)
    us_original = parse_us_original(us_original_path)
    english = build_english(us_original)

    gr_path = ROOT / "lib/sop-seed/marketing-executive-functions.ts"
    en_path = ROOT / "lib/sop-seed/marketing-executives-us-functions.ts"

    emit_ts(gr_path, "MarketingExecutiveFunctionSeed", "MARKETING_EXECUTIVE_FUNCTIONS", greek)
    emit_ts(en_path, "MarketingExecutivesUsFunctionSeed", "MARKETING_EXECUTIVES_US_FUNCTIONS", english)

    print(f"Wrote {len(greek)} Greek functions → {gr_path.relative_to(ROOT)}")
    print(f"Wrote {len(english)} English functions → {en_path.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
