/**
 * Recording brief template for one bunch slot (one idea = 1 original + 2 variations).
 * The Creative Director writes the brief with Claude and pastes it into the script form;
 * the form checks that every section is there and that each take says where it will be
 * posted (main grid or trial).
 *
 * Sections are recognised by their emoji marker, so the brief can be written in any language.
 */

export type RecordingBriefPlacement = "grid" | "trial";

export const RECORDING_BRIEF_SECTIONS = [
  { key: "concept", marker: "💡", label: "Concept & why it works" },
  { key: "setup", marker: "📱", label: "Setup" },
  { key: "act", marker: "🗣", label: "How to talk / act" },
  { key: "variations", marker: "📝", label: "Variations" },
  { key: "checklist", marker: "✅", label: "Checklist" },
  { key: "upload", marker: "📂", label: "Upload path & deadline" },
] as const;

export type RecordingBriefSectionKey = (typeof RECORDING_BRIEF_SECTIONS)[number]["key"];

export type RecordingBriefTake = {
  /** 1 = original, 2 and 3 = variations. */
  number: 1 | 2 | 3;
  placement: RecordingBriefPlacement | null;
  heading: string;
};

export type RecordingBriefCheck = {
  /** True when the text has at least one recording-brief section marker. */
  isBrief: boolean;
  sections: Record<RecordingBriefSectionKey, boolean>;
  missingSections: string[];
  takes: RecordingBriefTake[];
  /** Human-readable problems, empty when the brief is complete. */
  problems: string[];
};

/** The empty template, prefilled with what the slot already knows. */
export function buildRecordingBriefTemplate(opts?: { creator?: string; reference?: string }): string {
  const creator = opts?.creator?.trim() || "[CREATOR]";
  const reference = opts?.reference?.trim() || "[REFERENCE LINK]";
  return [
    '🎬 RECORDING BRIEF — "[NAME OF THE CONCEPT]"',
    `Creator: ${creator}`,
    `Reference: ${reference} (watch it twice before filming)`,
    "",
    "💡 THE CONCEPT & WHY IT WORKS (read first)",
    "What it is: ",
    "Why viewers love it: ",
    "Why it works for you: ",
    "The vibe: ",
    "",
    "📱 SETUP",
    "Who is needed: ",
    "Camera: ",
    "Framing: ",
    "Location: ",
    "Outfit (same for ALL clips): ",
    "Light: ",
    "Sound: ",
    "",
    "🗣 HOW TO TALK / HOW TO ACT",
    "- ",
    "- 2 takes of each variation.",
    "",
    "📝 VARIATIONS",
    "",
    "V1 — ORIGINAL (main grid)",
    "",
    "",
    "V2 — VARIATION (trial)",
    "What changes visually: ",
    "",
    "",
    "V3 — VARIATION (trial)",
    "What changes visually: ",
    "",
    "",
    "✅ CHECKLIST BEFORE YOU UPLOAD",
    "- [N] clips total ([variations] x [takes])",
    "- Same outfit and same place in all clips",
    "- No music, no text, no filters",
    "- File names: V1_take1, V1_take2, V2_take1, V2_take2, V3_take1, V3_take2",
    "",
    "📂 UPLOAD",
    "1. Files app → iCloud Drive",
    "2. [USA Marketing Agency / GR Marketing Agency]",
    `3. ${creator}`,
    "4. Content To Edit",
    "5. Raw Videos",
    "6. [YEAR]",
    "7. [MONTH]",
    "8. [FOLDER]",
    "9. Main Account",
    "Deadline: [DAY, TIME Greece time]",
  ].join("\n");
}

function placementOf(heading: string): RecordingBriefPlacement | null {
  const h = heading.toLowerCase();
  // "trial grid" must read as trial, so trial is tested first.
  if (/\btrials?\b/.test(h)) return "trial";
  if (/\bgrid\b/.test(h)) return "grid";
  return null;
}

/** Checks a pasted brief: which sections are present and where each take is posted. */
export function checkRecordingBrief(text: string): RecordingBriefCheck {
  const src = String(text ?? "");
  const sections = {} as Record<RecordingBriefSectionKey, boolean>;
  for (const s of RECORDING_BRIEF_SECTIONS) sections[s.key] = src.includes(s.marker);
  const isBrief = RECORDING_BRIEF_SECTIONS.some((s) => sections[s.key]);
  const missingSections = RECORDING_BRIEF_SECTIONS.filter((s) => !sections[s.key]).map((s) => s.label);

  const takes: RecordingBriefTake[] = [];
  const seen = new Set<number>();
  for (const line of src.split(/\r?\n/)) {
    const m = /^\s*V([123])\b(?!_)\s*[—–\-:·(]/.exec(line);
    if (!m) continue;
    const number = Number(m[1]) as 1 | 2 | 3;
    if (seen.has(number)) continue;
    seen.add(number);
    takes.push({ number, placement: placementOf(line), heading: line.trim().slice(0, 120) });
  }
  takes.sort((a, b) => a.number - b.number);

  const problems: string[] = [];
  if (isBrief) {
    if (missingSections.length) problems.push(`Missing sections: ${missingSections.join(", ")}`);
    for (const n of [1, 2, 3] as const) {
      const take = takes.find((t) => t.number === n);
      if (!take) problems.push(`V${n} is missing`);
      else if (!take.placement) problems.push(`V${n} has no tag: write (main grid) or (trial) in its heading`);
    }
    const grid = takes.filter((t) => t.placement === "grid").length;
    if (takes.length === 3 && takes.every((t) => t.placement) && grid !== 1) {
      problems.push("Exactly one take goes to the main grid (the original); the other two are trials");
    }
  }
  return { isBrief, sections, missingSections, takes, problems };
}
