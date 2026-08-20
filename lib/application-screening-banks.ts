/**
 * Cognitive & Emotional Intelligence Screening — question banks + copy.
 *
 * Framing: relative practical screening among candidates — NOT a clinically
 * validated IQ/EQ assessment. Keep candidate-facing copy honest.
 */

export const SCREENING_PRODUCT_NAME = "Cognitive & Emotional Intelligence Screening";

/** Honest framing shown to candidates (intro) and admins. */
export const SCREENING_FRAMING_COPY = {
  shortTitle: "Cognitive & Emotional Intelligence Screening",
  introHeadline: "A short practical screening",
  introBody:
    "This screening helps us compare how candidates approach reasoning and workplace situations. It is a relative practical tool among applicants — not a clinically validated IQ or EQ test, and not a diagnosis of ability or personality.",
  cognitiveTitle: "Cognitive ability",
  cognitiveBody:
    "Pattern recognition, logical reasoning, numerical, and verbal questions. You’ll have a limited time; unanswered items are scored as incorrect when time ends.",
  eqTitle: "Emotional intelligence — situational judgment",
  eqBody:
    "Short workplace scenarios. Choose the response that best reflects thoughtful interpersonal judgment. There is no single “perfect” answer; options are graded for practical EQ skills.",
  adminDisclaimer:
    "Scores are relative among candidates who completed this screening — not clinically validated IQ/EQ measures.",
} as const;

export const COGNITIVE_TIME_LIMIT_SECONDS = 18 * 60; // 18 minutes
export const COGNITIVE_CATEGORIES = [
  "pattern",
  "logical",
  "numerical",
  "verbal",
] as const;
export type CognitiveCategory = (typeof COGNITIVE_CATEGORIES)[number];

export type CognitiveDifficulty = "easy" | "medium" | "hard";

export type CognitiveQuestion = {
  id: string;
  category: CognitiveCategory;
  difficulty: CognitiveDifficulty;
  prompt: string;
  options: string[];
  /** 0-based correct option index — never sent to the client before submit. */
  correctIndex: number;
};

export const EQ_DIMENSIONS = [
  "conflict_resolution",
  "empathy",
  "self_regulation",
  "self_awareness",
  "social_awareness",
  "adaptability",
] as const;
export type EqDimension = (typeof EQ_DIMENSIONS)[number];

export const EQ_DIMENSION_LABELS: Record<EqDimension, string> = {
  conflict_resolution: "Conflict resolution",
  empathy: "Empathy",
  self_regulation: "Self-regulation",
  self_awareness: "Self-awareness",
  social_awareness: "Social awareness",
  adaptability: "Adaptability",
};

export type EqOption = {
  text: string;
  /** Points 0–3 for the scenario’s primary dimension. */
  points: number;
  dimension: EqDimension;
};

export type EqScenario = {
  id: string;
  prompt: string;
  options: EqOption[];
};

/** Public cognitive payload (no correct answers). */
export type PublicCognitiveQuestion = Omit<CognitiveQuestion, "correctIndex">;

export const COGNITIVE_QUESTIONS: CognitiveQuestion[] = [
  // Pattern — easy/medium/hard
  {
    id: "cog_p1",
    category: "pattern",
    difficulty: "easy",
    prompt: "Which number continues the series: 2, 4, 8, 16, …?",
    options: ["18", "24", "32", "30"],
    correctIndex: 2,
  },
  {
    id: "cog_p2",
    category: "pattern",
    difficulty: "easy",
    prompt: "Complete the pattern: A, C, E, G, …",
    options: ["H", "I", "J", "K"],
    correctIndex: 1,
  },
  {
    id: "cog_p3",
    category: "pattern",
    difficulty: "medium",
    prompt: "What comes next: 1, 1, 2, 3, 5, 8, …?",
    options: ["10", "11", "13", "12"],
    correctIndex: 2,
  },
  {
    id: "cog_p4",
    category: "pattern",
    difficulty: "medium",
    prompt: "Find the odd one out: square, circle, triangle, rectangle, cube",
    options: ["square", "circle", "triangle", "cube"],
    correctIndex: 3,
  },
  {
    id: "cog_p5",
    category: "pattern",
    difficulty: "hard",
    prompt: "Series: 3, 6, 18, 72, … What is next?",
    options: ["144", "216", "360", "288"],
    correctIndex: 2,
  },
  {
    id: "cog_p6",
    category: "pattern",
    difficulty: "hard",
    prompt: "If △ → 3, □ → 4, ⬡ → 6, then ⬠ → ?",
    options: ["4", "5", "6", "7"],
    correctIndex: 1,
  },
  // Logical
  {
    id: "cog_l1",
    category: "logical",
    difficulty: "easy",
    prompt: "All managers are employees. Some employees are remote. Which must be true?",
    options: [
      "All remote workers are managers",
      "Some managers may be remote",
      "No managers are remote",
      "All employees are managers",
    ],
    correctIndex: 1,
  },
  {
    id: "cog_l2",
    category: "logical",
    difficulty: "easy",
    prompt: "If it rains, the event is indoors. The event is outdoors. Therefore:",
    options: [
      "It is raining",
      "It is not raining",
      "The venue changed",
      "Cannot conclude about rain",
    ],
    correctIndex: 1,
  },
  {
    id: "cog_l3",
    category: "logical",
    difficulty: "medium",
    prompt: "A is taller than B. C is shorter than B. D is taller than A. Who is shortest?",
    options: ["A", "B", "C", "D"],
    correctIndex: 2,
  },
  {
    id: "cog_l4",
    category: "logical",
    difficulty: "medium",
    prompt: "Only one statement is true: (1) The package arrived. (2) The package did not arrive. (3) Statement 1 is false. Which is consistent?",
    options: [
      "Package arrived and (3) is true",
      "Package did not arrive and (3) is true",
      "Both (1) and (2) are true",
      "None of these",
    ],
    correctIndex: 1,
  },
  {
    id: "cog_l5",
    category: "logical",
    difficulty: "hard",
    prompt: "Every Friday the team ships. Today is not Friday. Which follows?",
    options: [
      "They will not ship today",
      "They might still ship today",
      "They ship only on Fridays so they never ship other days — wait, that would mean they won’t; actually: shipping on Friday doesn’t forbid other days. So they might still ship.",
      "They ship tomorrow",
    ],
    correctIndex: 1,
  },
  {
    id: "cog_l6",
    category: "logical",
    difficulty: "hard",
    prompt: "If P → Q and Q → R, and R is false, then:",
    options: ["P is true", "P is false", "Q is true", "Nothing about P"],
    correctIndex: 1,
  },
  // Numerical
  {
    id: "cog_n1",
    category: "numerical",
    difficulty: "easy",
    prompt: "15% of 200 is:",
    options: ["20", "25", "30", "35"],
    correctIndex: 2,
  },
  {
    id: "cog_n2",
    category: "numerical",
    difficulty: "easy",
    prompt: "A task takes 40 minutes. How many such tasks fit in 4 hours?",
    options: ["4", "5", "6", "8"],
    correctIndex: 2,
  },
  {
    id: "cog_n3",
    category: "numerical",
    difficulty: "medium",
    prompt: "A price rises from $80 to $100. What is the percent increase?",
    options: ["20%", "25%", "22%", "18%"],
    correctIndex: 1,
  },
  {
    id: "cog_n4",
    category: "numerical",
    difficulty: "medium",
    prompt: "Average of 10, 20, 30, 40 is:",
    options: ["20", "25", "30", "35"],
    correctIndex: 1,
  },
  {
    id: "cog_n5",
    category: "numerical",
    difficulty: "hard",
    prompt: "A team of 4 finishes in 6 days. How many days for a team of 6 at the same rate?",
    options: ["3", "4", "5", "8"],
    correctIndex: 1,
  },
  {
    id: "cog_n6",
    category: "numerical",
    difficulty: "hard",
    prompt: "If 3x + 5 = 20, then x = ?",
    options: ["3", "4", "5", "6"],
    correctIndex: 2,
  },
  // Verbal
  {
    id: "cog_v1",
    category: "verbal",
    difficulty: "easy",
    prompt: "Choose the best synonym for “concise”:",
    options: ["lengthy", "brief", "confused", "loud"],
    correctIndex: 1,
  },
  {
    id: "cog_v2",
    category: "verbal",
    difficulty: "easy",
    prompt: "Which word is most opposite of “scarce”?",
    options: ["rare", "abundant", "limited", "sparse"],
    correctIndex: 1,
  },
  {
    id: "cog_v3",
    category: "verbal",
    difficulty: "medium",
    prompt: "“Mitigate” most nearly means:",
    options: ["worsen", "ignore", "lessen", "celebrate"],
    correctIndex: 2,
  },
  {
    id: "cog_v4",
    category: "verbal",
    difficulty: "medium",
    prompt: "Complete: “She was praised for her ____ attention to detail.”",
    options: ["careless", "meticulous", "hasty", "vague"],
    correctIndex: 1,
  },
  {
    id: "cog_v5",
    category: "verbal",
    difficulty: "hard",
    prompt: "Analogy: Architect is to Blueprint as Chef is to:",
    options: ["Kitchen", "Recipe", "Oven", "Restaurant"],
    correctIndex: 1,
  },
  {
    id: "cog_v6",
    category: "verbal",
    difficulty: "hard",
    prompt: "Which sentence is clearest?",
    options: [
      "The report was written by me yesterday quickly.",
      "Yesterday I quickly wrote the report.",
      "Quickly the report yesterday by me was written.",
      "I the report wrote quickly yesterday.",
    ],
    correctIndex: 1,
  },
];

/** Fix cog_l5 — the options are messy. Simplify. */
COGNITIVE_QUESTIONS.splice(
  COGNITIVE_QUESTIONS.findIndex((q) => q.id === "cog_l5"),
  1,
  {
    id: "cog_l5",
    category: "logical",
    difficulty: "hard",
    prompt:
      "Rule: “If it is Friday, the team ships.” Today is not Friday. What can you conclude?",
    options: [
      "The team will not ship today",
      "The team might still ship today",
      "The team ships every day",
      "Today must be Saturday",
    ],
    correctIndex: 1,
  },
);

export const EQ_SCENARIOS: EqScenario[] = [
  {
    id: "eq_1",
    prompt:
      "A teammate publicly criticizes your work in a group chat. What do you do first?",
    options: [
      { text: "Reply instantly defending yourself in the same thread", points: 0, dimension: "self_regulation" },
      { text: "Ask to move the conversation to a private call to understand their concern", points: 3, dimension: "conflict_resolution" },
      { text: "Ignore it completely and never mention it", points: 1, dimension: "self_regulation" },
      { text: "Escalate to leadership immediately without talking to them", points: 1, dimension: "conflict_resolution" },
    ],
  },
  {
    id: "eq_2",
    prompt:
      "A colleague seems quiet and withdrawn after a tough client call. You:",
    options: [
      { text: "Joke about the call to lighten the mood for everyone", points: 1, dimension: "empathy" },
      { text: "Check in privately: “That looked rough — want to talk or take a breather?”", points: 3, dimension: "empathy" },
      { text: "Assume they’re fine unless they ask for help", points: 1, dimension: "social_awareness" },
      { text: "Tell the manager they might be struggling", points: 0, dimension: "empathy" },
    ],
  },
  {
    id: "eq_3",
    prompt:
      "You feel frustrated mid-shift because priorities keep changing. Best next step?",
    options: [
      { text: "Vent loudly so others know how unfair it is", points: 0, dimension: "self_regulation" },
      { text: "Pause, note what you need clarified, then ask for a short priority reset", points: 3, dimension: "self_regulation" },
      { text: "Quietly do whatever you prefer and ignore new asks", points: 0, dimension: "adaptability" },
      { text: "Leave the shift early", points: 0, dimension: "self_regulation" },
    ],
  },
  {
    id: "eq_4",
    prompt:
      "You realize you made a mistake that affected a teammate’s deadline. You:",
    options: [
      { text: "Hope they don’t notice", points: 0, dimension: "self_awareness" },
      { text: "Own it promptly, explain impact, and propose a fix", points: 3, dimension: "self_awareness" },
      { text: "Blame unclear instructions without checking facts", points: 0, dimension: "self_awareness" },
      { text: "Wait until your review to mention it", points: 1, dimension: "self_awareness" },
    ],
  },
  {
    id: "eq_5",
    prompt:
      "In a meeting, two people talk over a quieter teammate who was mid-sentence. You:",
    options: [
      { text: "Stay silent — it’s not your meeting to run", points: 1, dimension: "social_awareness" },
      { text: "Gently redirect: “I’d like to hear the rest of what Jordan was saying”", points: 3, dimension: "social_awareness" },
      { text: "Side with whoever is more senior", points: 0, dimension: "social_awareness" },
      { text: "Change the topic entirely", points: 0, dimension: "social_awareness" },
    ],
  },
  {
    id: "eq_6",
    prompt:
      "Tools and processes change overnight. Your instinct?",
    options: [
      { text: "Resist until forced — the old way worked", points: 0, dimension: "adaptability" },
      { text: "Learn the new flow, ask clarifying questions, help others adapt", points: 3, dimension: "adaptability" },
      { text: "Complain in public channels first", points: 0, dimension: "adaptability" },
      { text: "Only adapt if others do first", points: 1, dimension: "adaptability" },
    ],
  },
  {
    id: "eq_7",
    prompt:
      "A client is upset and speaking harshly. You feel your temper rising. You:",
    options: [
      { text: "Match their tone so they take you seriously", points: 0, dimension: "self_regulation" },
      { text: "Breathe, acknowledge their frustration, and restate how you’ll help", points: 3, dimension: "empathy" },
      { text: "Hang up / end the chat immediately", points: 0, dimension: "conflict_resolution" },
      { text: "Argue the facts until they concede", points: 0, dimension: "conflict_resolution" },
    ],
  },
  {
    id: "eq_8",
    prompt:
      "You receive critical feedback that stings. Healthiest response?",
    options: [
      { text: "Dismiss it as personal bias", points: 0, dimension: "self_awareness" },
      { text: "Thank them, ask one clarifying question, and decide one improvement", points: 3, dimension: "self_awareness" },
      { text: "Defend every point in detail", points: 1, dimension: "self_regulation" },
      { text: "Avoid that person going forward", points: 0, dimension: "adaptability" },
    ],
  },
  {
    id: "eq_9",
    prompt:
      "Two teammates disagree about how to handle a shared task. You are not the manager. You:",
    options: [
      { text: "Pick a side and lobby others", points: 0, dimension: "conflict_resolution" },
      { text: "Help them name shared goals and options, then document the agreed path", points: 3, dimension: "conflict_resolution" },
      { text: "Stay completely out of it even if asked", points: 1, dimension: "social_awareness" },
      { text: "Do the task your own way without telling them", points: 0, dimension: "conflict_resolution" },
    ],
  },
  {
    id: "eq_10",
    prompt:
      "Someone on your team celebrates a win that you also contributed to, but they don’t mention you. You:",
    options: [
      { text: "Call them out publicly for stealing credit", points: 0, dimension: "self_regulation" },
      { text: "Congratulate them, then later clarify contributions privately if needed", points: 3, dimension: "self_regulation" },
      { text: "Withdraw effort on future joint work", points: 0, dimension: "adaptability" },
      { text: "Immediately email leadership about unfairness", points: 1, dimension: "conflict_resolution" },
    ],
  },
  {
    id: "eq_11",
    prompt:
      "You notice a new hire looking lost during a busy handoff. You:",
    options: [
      { text: "Assume they’ll figure it out — sink or swim", points: 0, dimension: "empathy" },
      { text: "Offer a 5-minute orientation and a written checklist", points: 3, dimension: "social_awareness" },
      { text: "Tell them to read the docs and not interrupt", points: 1, dimension: "empathy" },
      { text: "Only help if a manager assigns you", points: 1, dimension: "social_awareness" },
    ],
  },
  {
    id: "eq_12",
    prompt:
      "Priorities flip mid-day and your carefully planned work is deprioritized. You:",
    options: [
      { text: "Refuse until your original plan is done", points: 0, dimension: "adaptability" },
      { text: "Confirm the new priority, park unfinished work cleanly, and switch", points: 3, dimension: "adaptability" },
      { text: "Pretend you didn’t see the update", points: 0, dimension: "self_awareness" },
      { text: "Do both poorly to avoid choosing", points: 1, dimension: "adaptability" },
    ],
  },
  {
    id: "eq_13",
    prompt:
      "You sense tension between two people affecting the whole room. Best move?",
    options: [
      { text: "Gossip about it with others to get the story", points: 0, dimension: "social_awareness" },
      { text: "Keep the work moving calmly and invite a constructive reset if you’re in position to", points: 3, dimension: "social_awareness" },
      { text: "Force them to resolve it on the spot in public", points: 1, dimension: "conflict_resolution" },
      { text: "Leave the room and hope it blows over", points: 1, dimension: "self_regulation" },
    ],
  },
  {
    id: "eq_14",
    prompt:
      "You’re tired and notice you’re being shorter than usual with people. You:",
    options: [
      { text: "Keep pushing — feelings don’t matter at work", points: 0, dimension: "self_awareness" },
      { text: "Recognize the pattern, take a short reset, and communicate if you need support", points: 3, dimension: "self_awareness" },
      { text: "Blame coworkers for being sensitive", points: 0, dimension: "empathy" },
      { text: "Hide it and hope nobody notices forever", points: 1, dimension: "self_regulation" },
    ],
  },
];

export function toPublicCognitiveQuestions(): PublicCognitiveQuestion[] {
  return COGNITIVE_QUESTIONS.map(({ correctIndex: _c, ...rest }) => rest);
}

export function scoreCognitive(
  answers: { question_id: string; selected_index: number | null }[],
): {
  raw_score: number;
  total_questions: number;
  category_breakdown: Record<CognitiveCategory, { correct: number; total: number }>;
} {
  const category_breakdown = Object.fromEntries(
    COGNITIVE_CATEGORIES.map((c) => [c, { correct: 0, total: 0 }]),
  ) as Record<CognitiveCategory, { correct: number; total: number }>;

  let raw = 0;
  const byId = new Map(answers.map((a) => [a.question_id, a.selected_index]));

  for (const q of COGNITIVE_QUESTIONS) {
    category_breakdown[q.category].total += 1;
    const sel = byId.get(q.id);
    if (sel != null && sel === q.correctIndex) {
      raw += 1;
      category_breakdown[q.category].correct += 1;
    }
  }

  return {
    raw_score: raw,
    total_questions: COGNITIVE_QUESTIONS.length,
    category_breakdown,
  };
}

export function scoreEq(
  answers: { scenario_id: string; selected_index: number | null }[],
): {
  overall_score: number;
  dimension_breakdown: Record<EqDimension, { points: number; max: number }>;
} {
  const dimension_breakdown = Object.fromEntries(
    EQ_DIMENSIONS.map((d) => [d, { points: 0, max: 0 }]),
  ) as Record<EqDimension, { points: number; max: number }>;

  const byId = new Map(answers.map((a) => [a.scenario_id, a.selected_index]));
  let earned = 0;
  let maxTotal = 0;

  for (const s of EQ_SCENARIOS) {
    const maxPts = Math.max(...s.options.map((o) => o.points));
    maxTotal += maxPts;
    // Attribute max to each option's dimension for denominator clarity —
    // use primary (highest) option's dimension for max bucket
    const best = s.options.reduce((a, b) => (b.points > a.points ? b : a));
    dimension_breakdown[best.dimension].max += maxPts;

    const sel = byId.get(s.id);
    if (sel == null || sel < 0 || sel >= s.options.length) continue;
    const opt = s.options[sel]!;
    earned += opt.points;
    dimension_breakdown[opt.dimension].points += opt.points;
  }

  const overall_score =
    maxTotal <= 0 ? 0 : Math.round((earned / maxTotal) * 1000) / 10;

  return { overall_score, dimension_breakdown };
}

export function toPublicEqScenarios(): {
  id: string;
  prompt: string;
  options: string[];
}[] {
  return EQ_SCENARIOS.map((s) => ({
    id: s.id,
    prompt: s.prompt,
    options: s.options.map((o) => o.text),
  }));
}
