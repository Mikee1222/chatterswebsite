import type { TaskStepType } from "@/lib/task-step-types";
import type { TaskTemplateCreateInput } from "@/services/task-templates-supabase";

export const NEW_ACCOUNT_WARMUP_US_PLATFORMS = [
  "Instagram",
  "Facebook",
  "TikTok",
  "Snapchat",
] as const;

type Platform = (typeof NEW_ACCOUNT_WARMUP_US_PLATFORMS)[number];

type SeedItem = {
  title: string;
  description?: string;
  requires_screenshot?: boolean;
  sort_order?: number;
  step_type?: TaskStepType;
};

function stage1PlatformItems(platform: Platform, sortStart: number): SeedItem[] {
  return [
    {
      title: `${platform} Scroll Time (20m)`,
      description: "",
      step_type: "Warm-up" satisfies TaskStepType,
      requires_screenshot: false,
      sort_order: sortStart,
    },
    {
      title: `${platform} Like 30 posts`,
      description: "Niche-relevant only",
      step_type: "Engagement",
      requires_screenshot: false,
      sort_order: sortStart + 1,
    },
    {
      title: `${platform} Repost 3`,
      description: "",
      step_type: "Engagement",
      requires_screenshot: false,
      sort_order: sortStart + 2,
    },
    {
      title: `${platform} Engagement Comments (3)`,
      description: "3 comments on other accounts' content to boost engagement",
      step_type: "Engagement",
      requires_screenshot: true,
      sort_order: sortStart + 3,
    },
  ];
}

function stage1PhaseItems(): SeedItem[] {
  const items: SeedItem[] = [];
  NEW_ACCOUNT_WARMUP_US_PLATFORMS.forEach((platform, platformIdx) => {
    items.push(...stage1PlatformItems(platform, platformIdx * 4));
  });
  return items;
}

function stage2PlatformItems(platform: Platform, sortStart: number): SeedItem[] {
  return [
    {
      title: `${platform} Scroll Time (25m)`,
      description: "",
      step_type: "Warm-up",
      requires_screenshot: false,
      sort_order: sortStart,
    },
    {
      title: `${platform} Like 35 posts`,
      description: "Niche-relevant only",
      step_type: "Engagement",
      requires_screenshot: false,
      sort_order: sortStart + 1,
    },
    {
      title: `${platform} Repost 4`,
      description: "",
      step_type: "Engagement",
      requires_screenshot: false,
      sort_order: sortStart + 2,
    },
    {
      title: `${platform} Engagement Comments (4)`,
      description: "4 comments on other accounts' content to boost engagement",
      step_type: "Engagement",
      requires_screenshot: true,
      sort_order: sortStart + 3,
    },
    {
      title: `${platform} Follow 10 accounts`,
      description: "",
      step_type: "Engagement",
      requires_screenshot: false,
      sort_order: sortStart + 4,
    },
  ];
}

function stage2BasePhaseItems(): SeedItem[] {
  const items: SeedItem[] = [];
  NEW_ACCOUNT_WARMUP_US_PLATFORMS.forEach((platform, platformIdx) => {
    items.push(...stage2PlatformItems(platform, platformIdx * 5));
  });
  return items;
}

function stage2Phase4Extras(): SeedItem[] {
  const items: SeedItem[] = [];
  let sort = NEW_ACCOUNT_WARMUP_US_PLATFORMS.length * 5;
  for (const platform of NEW_ACCOUNT_WARMUP_US_PLATFORMS) {
    items.push({
      title: `Post ${platform} Content`,
      description: "",
      step_type: "Posting",
      requires_screenshot: false,
      sort_order: sort++,
    });
  }
  for (const platform of NEW_ACCOUNT_WARMUP_US_PLATFORMS) {
    items.push({
      title: `Post ${platform} Story (Daily)`,
      description: "",
      step_type: "Posting",
      requires_screenshot: false,
      sort_order: sort++,
    });
  }
  return items;
}

function stage2Phase6Extras(): SeedItem[] {
  const items: SeedItem[] = [];
  let sort = NEW_ACCOUNT_WARMUP_US_PLATFORMS.length * 5;
  for (const platform of NEW_ACCOUNT_WARMUP_US_PLATFORMS) {
    items.push({
      title: `Post ${platform} Story (CTA)`,
      description: "",
      step_type: "Posting",
      requires_screenshot: false,
      sort_order: sort++,
    });
  }
  for (const platform of NEW_ACCOUNT_WARMUP_US_PLATFORMS) {
    items.push({
      title: `${platform} Reply to Comments (if any)`,
      description: "",
      step_type: "Engagement",
      requires_screenshot: true,
      sort_order: sort++,
    });
  }
  return items;
}

export const NEW_ACCOUNT_WARMUP_US_TEMPLATE_NAME = "New Account Warm-Up (US)";

export const NEW_ACCOUNT_WARMUP_US_TEMPLATE: TaskTemplateCreateInput = {
  name: NEW_ACCOUNT_WARMUP_US_TEMPLATE_NAME,
  description:
    "7-day gradual warm-up protocol for newly-created accounts before resuming normal daily posting cadence. Days 1-4: engagement-only, no posting, no follows. Days 4-7: engagement + first content + follows. After Day 7, manager decides next steps.",
  category: "marketing",
  phases: [
    {
      phase_number: 1,
      title: "Stage 1 - Days 1-4 (11am-2pm)",
      description:
        "Days 1-4 warm-up — engagement only (scroll, likes, reposts, comments). No posting or follows.",
      items: stage1PhaseItems(),
    },
    {
      phase_number: 2,
      title: "Stage 1 - Days 1-4 (3pm-6pm)",
      description:
        "Days 1-4 warm-up — engagement only (scroll, likes, reposts, comments). No posting or follows.",
      items: stage1PhaseItems(),
    },
    {
      phase_number: 3,
      title: "Stage 1 - Days 1-4 (7pm-9pm)",
      description:
        "Days 1-4 warm-up — engagement only (scroll, likes, reposts, comments). No posting or follows.",
      items: stage1PhaseItems(),
    },
    {
      phase_number: 4,
      title: "Stage 2 - Days 4-7 (11am-2pm)",
      description:
        "Days 4-7 ramp — increased engagement, follows, and first content (post + daily story).",
      items: [...stage2BasePhaseItems(), ...stage2Phase4Extras()],
    },
    {
      phase_number: 5,
      title: "Stage 2 - Days 4-7 (3pm-6pm)",
      description: "Days 4-7 ramp — increased engagement and follows.",
      items: stage2BasePhaseItems(),
    },
    {
      phase_number: 6,
      title: "Stage 2 - Days 4-7 (7pm-9pm)",
      description:
        "Days 4-7 ramp — increased engagement, follows, CTA stories, and comment replies.",
      items: [...stage2BasePhaseItems(), ...stage2Phase6Extras()],
    },
  ],
};

export function countNewAccountWarmupUsItems(): {
  total: number;
  stage1: number;
  stage2: number;
  byPhase: number[];
} {
  const byPhase = NEW_ACCOUNT_WARMUP_US_TEMPLATE.phases!.map((p) => p.items?.length ?? 0);
  const stage1 = byPhase.slice(0, 3).reduce((a, b) => a + b, 0);
  const stage2 = byPhase.slice(3).reduce((a, b) => a + b, 0);
  return { total: stage1 + stage2, stage1, stage2, byPhase };
}
