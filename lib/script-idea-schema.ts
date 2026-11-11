/**
 * Script idea block — what a Creative Director submits for ONE slot of a bunch:
 * the concept, how to act, the ORIGINAL (goes to the main grid) and exactly two
 * VARIATIONS (go to trials). It follows the recording-brief structure for a single
 * idea. Setup / outfit / upload path are NOT here: they are written once per shoot,
 * when 7–10 ideas are grouped into a Recording Brief.
 */

export const SCRIPT_IDEA_TOOL_NAME = "write_script_idea";
export const SCRIPT_IDEA_MAX_TOKENS = 2600;

export type ScriptIdeaTake = {
  /** What changes versus the original (empty for the original itself). */
  angle?: string;
  /** Full script: spoken lines or shot list, in order. */
  script: string;
  /** Exact overlay text, or "" when the take has none. */
  text_on_screen?: string;
};

export type ScriptIdeaJson = {
  concept: string;
  why_it_works: string;
  must_keep: string[];
  how_to_act: string;
  original: ScriptIdeaTake;
  variations: ScriptIdeaTake[];
};

const take = (withAngle: boolean) => ({
  type: "object",
  properties: {
    ...(withAngle
      ? { angle: { type: "string", description: "One line: what changes versus the original, and why it can still hit." } }
      : {}),
    script: { type: "string", description: "Full script for this take: spoken lines or shot list, in order, ready to film." },
    text_on_screen: { type: "string", description: "Exact overlay text for this take, or an empty string if it has none." },
  },
  required: withAngle ? ["angle", "script"] : ["script"],
});

export const SCRIPT_IDEA_TOOL = {
  name: SCRIPT_IDEA_TOOL_NAME,
  description: "Write the script idea block for one bunch slot: concept, how to act, the original and exactly two variations.",
  input_schema: {
    type: "object",
    properties: {
      concept: { type: "string", description: "2–3 sentences: what the video is." },
      why_it_works: { type: "string", description: "2–4 sentences: why viewers watch, share or tag, and why it fits this creator." },
      must_keep: { type: "array", items: { type: "string" }, description: "The elements that made the reference go viral. Every take keeps all of them." },
      how_to_act: { type: "string", description: "Delivery rules: tone, energy, pacing, length, what to avoid." },
      original: take(false),
      variations: { type: "array", minItems: 2, maxItems: 2, items: take(true) },
    },
    required: ["concept", "why_it_works", "must_keep", "how_to_act", "original", "variations"],
  },
} as const;

export const SCRIPT_IDEA_SYSTEM_PROMPT = [
  "You write filming scripts for short-form social videos (Instagram Reels) for a creator-management agency.",
  "You are given the breakdown of a reference video that went viral and the persona of the creator who will film it.",
  "Write ONE idea block: the original recreation plus exactly two variations.",
  "Rules:",
  "- Every take keeps ALL must-keep elements of the breakdown. Variations change only what the breakdown marks as flexible (lines, angle, setting detail), never the element that made it viral.",
  "- All three takes are filmed in the same session with the same outfit and location. Never ask for a different outfit or location per take.",
  "- Each variation must differ from the original in wording AND in something visual, never in wording alone.",
  "- Do not write setup, wardrobe, upload paths or deadlines: those are written once per shoot, elsewhere.",
  "- Be relatable and clever; use innuendo, never explicit wording. No links, no mention of paid platforms.",
  "- Use only what the breakdown and the persona state. Do not invent facts about the creator.",
].join("\n");

function cleanStr(v: unknown, max: number): string {
  return String(v ?? "").trim().slice(0, max);
}

function cleanTake(v: unknown): ScriptIdeaTake | null {
  if (!v || typeof v !== "object") return null;
  const r = v as Record<string, unknown>;
  const script = cleanStr(r.script, 4000);
  if (!script) return null;
  return {
    angle: cleanStr(r.angle, 400),
    script,
    text_on_screen: cleanStr(r.text_on_screen, 600),
  };
}

export function sanitizeScriptIdea(raw: unknown): ScriptIdeaJson | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const original = cleanTake(r.original);
  const variations = (Array.isArray(r.variations) ? r.variations : [])
    .map(cleanTake)
    .filter((t): t is ScriptIdeaTake => Boolean(t))
    .slice(0, 2);
  if (!original || variations.length < 2) return null;
  return {
    concept: cleanStr(r.concept, 1200),
    why_it_works: cleanStr(r.why_it_works, 1500),
    must_keep: (Array.isArray(r.must_keep) ? r.must_keep : [])
      .map((x) => cleanStr(x, 300))
      .filter(Boolean)
      .slice(0, 10),
    how_to_act: cleanStr(r.how_to_act, 1500),
    original,
    variations,
  };
}

/** Placement of each take: the original is posted on the main grid, variations on trials. */
export const SCRIPT_TAKE_PLACEMENT = { original: "GRID", variation: "TRIAL" } as const;

/** The Script field text. Headings carry the placement tag of every take. */
export function scriptIdeaToText(idea: ScriptIdeaJson): string {
  const out: string[] = [];
  out.push("💡 THE CONCEPT & WHY IT WORKS");
  if (idea.concept) out.push(idea.concept);
  if (idea.why_it_works) out.push(idea.why_it_works);
  if (idea.must_keep.length) {
    out.push("", "MUST KEEP (in every take):");
    for (const m of idea.must_keep) out.push(`• ${m}`);
  }
  if (idea.how_to_act) out.push("", "🗣 HOW TO ACT", idea.how_to_act);
  out.push("", `📝 ORIGINAL — [${SCRIPT_TAKE_PLACEMENT.original}]`, idea.original.script);
  idea.variations.forEach((v, i) => {
    out.push("", `📝 VARIATION ${i + 1} — [${SCRIPT_TAKE_PLACEMENT.variation}]`);
    if (v.angle) out.push(`What changes: ${v.angle}`);
    out.push(v.script);
  });
  return out.join("\n").trim();
}

/** The Text on Screen field: one tagged line per take that has an overlay. */
export function scriptIdeaToTextOnScreen(idea: ScriptIdeaJson): string {
  const lines: string[] = [];
  if (idea.original.text_on_screen) {
    lines.push(`ORIGINAL [${SCRIPT_TAKE_PLACEMENT.original}]: ${idea.original.text_on_screen}`);
  }
  idea.variations.forEach((v, i) => {
    if (v.text_on_screen) {
      lines.push(`VARIATION ${i + 1} [${SCRIPT_TAKE_PLACEMENT.variation}]: ${v.text_on_screen}`);
    }
  });
  return lines.join("\n");
}
