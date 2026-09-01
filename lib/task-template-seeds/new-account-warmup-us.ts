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

/** Legacy combined template name — removed by split migration/seed. */
export const NEW_ACCOUNT_WARMUP_US_LEGACY_TEMPLATE_NAME = "New Account Warm-Up (US)";

export const NEW_ACCOUNT_WARMUP_US_DAYS_1_4_TEMPLATE_NAME =
  "New Account Warm-Up (US) - Days 1-4";
export const NEW_ACCOUNT_WARMUP_US_DAYS_4_7_TEMPLATE_NAME =
  "New Account Warm-Up (US) - Days 4-7";

export const NEW_ACCOUNT_WARMUP_US_TEMPLATE_NAMES = [
  NEW_ACCOUNT_WARMUP_US_DAYS_1_4_TEMPLATE_NAME,
  NEW_ACCOUNT_WARMUP_US_DAYS_4_7_TEMPLATE_NAME,
] as const;

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

function stage2Phase1Extras(): SeedItem[] {
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

function stage2Phase3Extras(): SeedItem[] {
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

export const NEW_ACCOUNT_WARMUP_US_DAYS_1_4_TEMPLATE: TaskTemplateCreateInput = {
  name: NEW_ACCOUNT_WARMUP_US_DAYS_1_4_TEMPLATE_NAME,
  description:
    "Days 1-4 warm-up for newly-created US accounts. Engagement only: scroll, likes, reposts, and comments. No posting or follows.",
  category: "marketing",
  phases: [
    {
      phase_number: 1,
      title: "Stage 1 (11am-2pm)",
      description:
        "Days 1-4 warm-up — engagement only (scroll, likes, reposts, comments). No posting or follows.",
      items: stage1PhaseItems(),
    },
    {
      phase_number: 2,
      title: "Stage 1 (3pm-6pm)",
      description:
        "Days 1-4 warm-up — engagement only (scroll, likes, reposts, comments). No posting or follows.",
      items: stage1PhaseItems(),
    },
    {
      phase_number: 3,
      title: "Stage 1 (7pm-9pm)",
      description:
        "Days 1-4 warm-up — engagement only (scroll, likes, reposts, comments). No posting or follows.",
      items: stage1PhaseItems(),
    },
  ],
};

export const NEW_ACCOUNT_WARMUP_US_DAYS_4_7_TEMPLATE: TaskTemplateCreateInput = {
  name: NEW_ACCOUNT_WARMUP_US_DAYS_4_7_TEMPLATE_NAME,
  description:
    "Days 4-7 ramp for newly-created US accounts. Increased engagement, follows, first content posts, CTA stories, and comment replies. After Day 7, manager decides next steps.",
  category: "marketing",
  phases: [
    {
      phase_number: 1,
      title: "Stage 2 (11am-2pm)",
      description:
        "Days 4-7 ramp — increased engagement, follows, and first content (post + daily story).",
      items: [...stage2BasePhaseItems(), ...stage2Phase1Extras()],
    },
    {
      phase_number: 2,
      title: "Stage 2 (3pm-6pm)",
      description: "Days 4-7 ramp — increased engagement and follows.",
      items: stage2BasePhaseItems(),
    },
    {
      phase_number: 3,
      title: "Stage 2 (7pm-9pm)",
      description:
        "Days 4-7 ramp — increased engagement, follows, CTA stories, and comment replies.",
      items: [...stage2BasePhaseItems(), ...stage2Phase3Extras()],
    },
  ],
};

export const NEW_ACCOUNT_WARMUP_US_TEMPLATES: TaskTemplateCreateInput[] = [
  NEW_ACCOUNT_WARMUP_US_DAYS_1_4_TEMPLATE,
  NEW_ACCOUNT_WARMUP_US_DAYS_4_7_TEMPLATE,
];

export type NewAccountWarmupUsTemplateSeed = {
  slug: string;
  logicalTemplateId: string;
  template: TaskTemplateCreateInput;
};

export const NEW_ACCOUNT_WARMUP_US_TEMPLATE_SEEDS: NewAccountWarmupUsTemplateSeed[] = [
  {
    slug: "d14",
    logicalTemplateId: "tpl_new_account_warmup_us_days_1_4",
    template: NEW_ACCOUNT_WARMUP_US_DAYS_1_4_TEMPLATE,
  },
  {
    slug: "d47",
    logicalTemplateId: "tpl_new_account_warmup_us_days_4_7",
    template: NEW_ACCOUNT_WARMUP_US_DAYS_4_7_TEMPLATE,
  },
];

export function countNewAccountWarmupUsItems(template: TaskTemplateCreateInput): {
  total: number;
  byPhase: number[];
} {
  const byPhase = template.phases?.map((p) => p.items?.length ?? 0) ?? [];
  return { total: byPhase.reduce((a, b) => a + b, 0), byPhase };
}

export function countAllNewAccountWarmupUsItems(): {
  days14: ReturnType<typeof countNewAccountWarmupUsItems>;
  days47: ReturnType<typeof countNewAccountWarmupUsItems>;
  combined: number;
} {
  const days14 = countNewAccountWarmupUsItems(NEW_ACCOUNT_WARMUP_US_DAYS_1_4_TEMPLATE);
  const days47 = countNewAccountWarmupUsItems(NEW_ACCOUNT_WARMUP_US_DAYS_4_7_TEMPLATE);
  return { days14, days47, combined: days14.total + days47.total };
}
