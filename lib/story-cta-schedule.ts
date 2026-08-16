/**
 * Fixed weekly Story CTA rotation — Link A/B URLs are per-model (model_story_link_config).
 */

import { ymdInAthens } from "@/lib/airtable-datetime";

const ATHENS_IANA = "Europe/Athens";

export const STORY_CTA_WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
export type StoryCtaWeekday = (typeof STORY_CTA_WEEKDAYS)[number];

export type StoryCtaLinkSlot = "A" | "B";

export type StoryCtaDayAction =
  | { kind: "story_link"; label: string; linkSlot: StoryCtaLinkSlot }
  | { kind: "continuation"; label: string }
  | { kind: "redirect_highlights"; label: string };

/** Fixed Mon–Sun pattern (only Link A/B URLs vary per model). */
export const STORY_CTA_WEEKLY_PATTERN: Record<StoryCtaWeekday, StoryCtaDayAction> = {
  Mon: { kind: "story_link", label: "48h story w/ Instagram Plus", linkSlot: "A" },
  Tue: { kind: "continuation", label: "Continuation (no new action)" },
  Wed: { kind: "story_link", label: "48h story w/ Instagram Plus", linkSlot: "B" },
  Thu: { kind: "continuation", label: "Continuation (no new action)" },
  Fri: { kind: "redirect_highlights", label: "Redirect → Highlights" },
  Sat: { kind: "story_link", label: "48h story w/ Instagram Plus", linkSlot: "A" },
  Sun: { kind: "continuation", label: "Continuation (no new action)" },
};

export type StoryCtaScheduleRow = {
  weekday: StoryCtaWeekday;
  action: StoryCtaDayAction;
  linkUrl: string | null;
  linkLabel: string | null;
  isToday: boolean;
};

export type StoryCtaScheduleModel = {
  model_id: string;
  model_name: string;
  link_a_url: string | null;
  link_b_url: string | null;
  schedule: StoryCtaScheduleRow[];
};

export type StoryCtaModelLinks = {
  link_a_url: string | null;
  link_b_url: string | null;
};

/** Today YYYY-MM-DD for the widget — matches VA task date nav bucketing. */
export function getStoryCtaTodayYmd(): string {
  return ymdInAthens(new Date().toISOString());
}

function weekdayShortInAthens(ymd: string): StoryCtaWeekday {
  const target = ymd.trim().slice(0, 10);
  const d = new Date(`${target}T12:00:00.000Z`);
  const short = new Intl.DateTimeFormat("en-US", {
    timeZone: ATHENS_IANA,
    weekday: "short",
  }).format(d);
  const hit = STORY_CTA_WEEKDAYS.find((w) => w === short);
  return hit ?? "Mon";
}

export function getStoryCtaWeekdayForYmd(ymd: string): StoryCtaWeekday {
  return weekdayShortInAthens(ymd);
}

export function buildStoryCtaScheduleRows(
  links: StoryCtaModelLinks,
  todayYmd?: string,
): StoryCtaScheduleRow[] {
  const today = (todayYmd ?? getStoryCtaTodayYmd()).slice(0, 10);
  const todayWeekday = getStoryCtaWeekdayForYmd(today);

  return STORY_CTA_WEEKDAYS.map((weekday) => {
    const action = STORY_CTA_WEEKLY_PATTERN[weekday];
    let linkUrl: string | null = null;
    let linkLabel: string | null = null;

    if (action.kind === "story_link") {
      linkLabel = `Link ${action.linkSlot}`;
      linkUrl =
        action.linkSlot === "A"
          ? links.link_a_url?.trim() || null
          : links.link_b_url?.trim() || null;
    }

    return {
      weekday,
      action,
      linkUrl,
      linkLabel,
      isToday: weekday === todayWeekday,
    };
  });
}
