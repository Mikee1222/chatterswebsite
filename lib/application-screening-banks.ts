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
    prompt: "Which number comes next in the series: 2, 4, 8, 16, …?",
    options: ["18", "24", "32", "30"],
    correctIndex: 2,
  },
  {
    id: "cog_p2",
    category: "pattern",
    difficulty: "easy",
    prompt: "What letter comes next in the pattern: A, C, E, G, …?",
    options: ["H", "I", "J", "K"],
    correctIndex: 1,
  },
  {
    id: "cog_p3",
    category: "pattern",
    difficulty: "medium",
    prompt: "What number comes next: 1, 1, 2, 3, 5, 8, …?",
    options: ["10", "11", "13", "12"],
    correctIndex: 2,
  },
  {
    id: "cog_p4",
    category: "pattern",
    difficulty: "medium",
    prompt: "Which item does not belong with the others: square, circle, triangle, rectangle, cube?",
    options: ["square", "circle", "triangle", "cube"],
    correctIndex: 3,
  },
  {
    id: "cog_p5",
    category: "pattern",
    difficulty: "hard",
    prompt: "What number comes next in the series: 3, 6, 18, 72, …?",
    options: ["144", "216", "360", "288"],
    correctIndex: 2,
  },
  {
    id: "cog_p6",
    category: "pattern",
    difficulty: "hard",
    prompt:
      "Each shape maps to its number of sides: triangle → 3, square → 4, hexagon → 6. What does a pentagon map to?",
    options: ["4", "5", "6", "7"],
    correctIndex: 1,
  },
  // Logical
  {
    id: "cog_l1",
    category: "logical",
    difficulty: "easy",
    prompt:
      "All managers are employees. Some employees work from home. Which conclusion is valid?",
    options: [
      "All employees who work from home are managers",
      "It is possible that some managers work from home",
      "No managers work from home",
      "All employees are managers",
    ],
    correctIndex: 1,
  },
  {
    id: "cog_l2",
    category: "logical",
    difficulty: "easy",
    prompt:
      "Rule: If it rains, the event is held indoors. The event is held outdoors. What follows?",
    options: [
      "It is raining",
      "It is not raining",
      "The venue was changed",
      "Nothing can be concluded about the rain",
    ],
    correctIndex: 1,
  },
  {
    id: "cog_l3",
    category: "logical",
    difficulty: "medium",
    prompt:
      "A is taller than B. C is shorter than B. D is taller than A. Who is the shortest?",
    options: ["A", "B", "C", "D"],
    correctIndex: 2,
  },
  {
    id: "cog_l4",
    category: "logical",
    difficulty: "medium",
    prompt:
      "Exactly one of these three statements is true: (1) The package arrived. (2) The package did not arrive. (3) Statement (1) is true. Which option is consistent?",
    options: [
      "The package arrived, and statement (3) is true",
      "The package did not arrive, and statement (3) is false",
      "Both (1) and (2) are true",
      "None of these",
    ],
    correctIndex: 1,
  },
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
  {
    id: "cog_l6",
    category: "logical",
    difficulty: "hard",
    prompt: "If P → Q and Q → R, and R is false, then:",
    options: [
      "P is true",
      "P is false",
      "Q is true",
      "Nothing can be concluded about P",
    ],
    correctIndex: 1,
  },
  // Numerical
  {
    id: "cog_n1",
    category: "numerical",
    difficulty: "easy",
    prompt: "What is 15% of 200?",
    options: ["20", "25", "30", "35"],
    correctIndex: 2,
  },
  {
    id: "cog_n2",
    category: "numerical",
    difficulty: "easy",
    prompt: "One task takes 40 minutes. How many of these tasks can be completed in 4 hours?",
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
    prompt: "What is the average of 10, 20, 30, and 40?",
    options: ["20", "25", "30", "35"],
    correctIndex: 1,
  },
  {
    id: "cog_n5",
    category: "numerical",
    difficulty: "hard",
    prompt:
      "A team of 4 people finishes a job in 6 days. How many days would a team of 6 need for the same job, working at the same rate?",
    options: ["3", "4", "5", "8"],
    correctIndex: 1,
  },
  {
    id: "cog_n6",
    category: "numerical",
    difficulty: "hard",
    prompt: "If 3x + 5 = 20, what is the value of x?",
    options: ["3", "4", "5", "6"],
    correctIndex: 2,
  },
  // Verbal
  {
    id: "cog_v1",
    category: "verbal",
    difficulty: "easy",
    prompt: "Which word is the best synonym for “concise”?",
    options: ["lengthy", "brief", "confused", "loud"],
    correctIndex: 1,
  },
  {
    id: "cog_v2",
    category: "verbal",
    difficulty: "easy",
    prompt: "Which word is the best opposite of “scarce”?",
    options: ["rare", "abundant", "limited", "sparse"],
    correctIndex: 1,
  },
  {
    id: "cog_v3",
    category: "verbal",
    difficulty: "medium",
    prompt: "Which word is closest in meaning to “mitigate”?",
    options: ["worsen", "ignore", "lessen", "celebrate"],
    correctIndex: 2,
  },
  {
    id: "cog_v4",
    category: "verbal",
    difficulty: "medium",
    prompt: "Choose the word that best completes the sentence: “She was praised for her ____ attention to detail.”",
    options: ["careless", "meticulous", "hasty", "vague"],
    correctIndex: 1,
  },
  {
    id: "cog_v5",
    category: "verbal",
    difficulty: "hard",
    prompt: "Analogy: Architect is to blueprint as chef is to:",
    options: ["Kitchen", "Recipe", "Oven", "Restaurant"],
    correctIndex: 1,
  },
  {
    id: "cog_v6",
    category: "verbal",
    difficulty: "hard",
    prompt: "Which sentence is the clearest and most natural?",
    options: [
      "The report was written by me yesterday quickly.",
      "Yesterday I quickly wrote the report.",
      "Quickly the report yesterday by me was written.",
      "I the report wrote quickly yesterday.",
    ],
    correctIndex: 1,
  },
];

export const EQ_SCENARIOS: EqScenario[] = [
  {
    id: "eq_1",
    prompt:
      "A teammate criticizes your work publicly in a group chat. What do you do first?",
    options: [
      { text: "Reply right away in the same thread, defending yourself", points: 0, dimension: "self_regulation" },
      { text: "Ask to continue in a private call so you can understand their concern", points: 3, dimension: "conflict_resolution" },
      { text: "Ignore the message completely and never bring it up", points: 1, dimension: "self_regulation" },
      { text: "Report them to leadership immediately without speaking to them first", points: 1, dimension: "conflict_resolution" },
    ],
  },
  {
    id: "eq_2",
    prompt:
      "After a difficult client call, a colleague looks quiet and withdrawn. What do you do?",
    options: [
      { text: "Make a joke about the call to lighten the mood for everyone", points: 1, dimension: "empathy" },
      { text: "Check in privately: “That looked rough — want to talk, or take a short break?”", points: 3, dimension: "empathy" },
      { text: "Assume they are fine unless they ask for help", points: 1, dimension: "social_awareness" },
      { text: "Tell their manager they might be struggling, without checking with them first", points: 0, dimension: "empathy" },
    ],
  },
  {
    id: "eq_3",
    prompt:
      "Mid-shift, you feel frustrated because priorities keep changing. What is the best next step?",
    options: [
      { text: "Vent loudly so others know how unfair it feels", points: 0, dimension: "self_regulation" },
      { text: "Pause, write down what you need clarified, then ask for a short priority check-in", points: 3, dimension: "self_regulation" },
      { text: "Quietly keep doing what you prefer and ignore new requests", points: 0, dimension: "adaptability" },
      { text: "Leave the shift early", points: 0, dimension: "self_regulation" },
    ],
  },
  {
    id: "eq_4",
    prompt:
      "You realize you made a mistake that delayed a teammate’s deadline. What do you do?",
    options: [
      { text: "Hope they do not notice", points: 0, dimension: "self_awareness" },
      { text: "Own it promptly, explain the impact, and propose a fix", points: 3, dimension: "self_awareness" },
      { text: "Blame unclear instructions without checking the facts", points: 0, dimension: "self_awareness" },
      { text: "Wait until your performance review to mention it", points: 1, dimension: "self_awareness" },
    ],
  },
  {
    id: "eq_5",
    prompt:
      "In a meeting, two people talk over a quieter teammate who was mid-sentence. What do you do?",
    options: [
      { text: "Stay silent — it is not your meeting to manage", points: 1, dimension: "social_awareness" },
      { text: "Gently redirect: “I’d like to hear the rest of what Jordan was saying”", points: 3, dimension: "social_awareness" },
      { text: "Side with whoever is more senior", points: 0, dimension: "social_awareness" },
      { text: "Change the topic entirely", points: 0, dimension: "social_awareness" },
    ],
  },
  {
    id: "eq_6",
    prompt:
      "Tools and processes change overnight. What do you do?",
    options: [
      { text: "Resist until you are forced — the old way worked", points: 0, dimension: "adaptability" },
      { text: "Learn the new process, ask clarifying questions, and help others adapt", points: 3, dimension: "adaptability" },
      { text: "Complain in public channels first", points: 0, dimension: "adaptability" },
      { text: "Only adapt after others have adapted first", points: 1, dimension: "adaptability" },
    ],
  },
  {
    id: "eq_7",
    prompt:
      "A client is upset and speaking harshly. You feel your temper rising. What do you do?",
    options: [
      { text: "Match their tone so they take you seriously", points: 0, dimension: "self_regulation" },
      { text: "Take a breath, acknowledge their frustration, and restate how you will help", points: 3, dimension: "empathy" },
      { text: "End the call or chat immediately", points: 0, dimension: "conflict_resolution" },
      { text: "Argue the facts until they give in", points: 0, dimension: "conflict_resolution" },
    ],
  },
  {
    id: "eq_8",
    prompt:
      "You receive critical feedback that stings. What is the healthiest response?",
    options: [
      { text: "Dismiss it as personal bias", points: 0, dimension: "self_awareness" },
      { text: "Thank them, ask one clarifying question, and choose one improvement to try", points: 3, dimension: "self_awareness" },
      { text: "Defend every point in detail", points: 1, dimension: "self_regulation" },
      { text: "Avoid that person from now on", points: 0, dimension: "adaptability" },
    ],
  },
  {
    id: "eq_9",
    prompt:
      "Two teammates disagree on how to handle a shared task. You are not their manager. What do you do?",
    options: [
      { text: "Pick a side and lobby others to agree with you", points: 0, dimension: "conflict_resolution" },
      { text: "Help them clarify shared goals and options, then write down the agreed plan", points: 3, dimension: "conflict_resolution" },
      { text: "Stay completely out of it, even if they ask for your help", points: 1, dimension: "social_awareness" },
      { text: "Do the task your own way without telling them", points: 0, dimension: "conflict_resolution" },
    ],
  },
  {
    id: "eq_10",
    prompt:
      "A teammate celebrates a win you also contributed to, but they do not mention you. What do you do?",
    options: [
      { text: "Call them out publicly for taking the credit", points: 0, dimension: "self_regulation" },
      { text: "Congratulate them, then later clarify contributions privately if needed", points: 3, dimension: "self_regulation" },
      { text: "Withdraw effort on future joint work", points: 0, dimension: "adaptability" },
      { text: "Email leadership immediately about unfairness", points: 1, dimension: "conflict_resolution" },
    ],
  },
  {
    id: "eq_11",
    prompt:
      "You notice a new hire looking lost during a busy handoff. What do you do?",
    options: [
      { text: "Assume they will figure it out on their own", points: 0, dimension: "empathy" },
      { text: "Offer a five-minute orientation and a short written checklist", points: 3, dimension: "social_awareness" },
      { text: "Tell them to read the documentation and not interrupt", points: 1, dimension: "empathy" },
      { text: "Help only if a manager assigns you to do so", points: 1, dimension: "social_awareness" },
    ],
  },
  {
    id: "eq_12",
    prompt:
      "Midday priorities change and your carefully planned work is no longer the top priority. What do you do?",
    options: [
      { text: "Refuse until your original plan is finished", points: 0, dimension: "adaptability" },
      { text: "Confirm the new priority, leave unfinished work in a clear state, and switch", points: 3, dimension: "adaptability" },
      { text: "Pretend you did not see the update", points: 0, dimension: "self_awareness" },
      { text: "Try to do both tasks poorly so you do not have to choose", points: 1, dimension: "adaptability" },
    ],
  },
  {
    id: "eq_13",
    prompt:
      "You sense tension between two people that is affecting the whole room. What is the best move?",
    options: [
      { text: "Gossip with others to find out what happened", points: 0, dimension: "social_awareness" },
      { text: "Keep work moving calmly, and if you can, invite a constructive reset", points: 3, dimension: "social_awareness" },
      { text: "Force them to resolve it on the spot in front of everyone", points: 1, dimension: "conflict_resolution" },
      { text: "Leave the room and hope it blows over", points: 1, dimension: "self_regulation" },
    ],
  },
  {
    id: "eq_14",
    prompt:
      "You are tired and notice you are being shorter than usual with people. What do you do?",
    options: [
      { text: "Keep pushing — feelings do not matter at work", points: 0, dimension: "self_awareness" },
      { text: "Recognize the pattern, take a short reset, and say something if you need support", points: 3, dimension: "self_awareness" },
      { text: "Blame coworkers for being too sensitive", points: 0, dimension: "empathy" },
      { text: "Hide it and hope nobody notices", points: 1, dimension: "self_regulation" },
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
