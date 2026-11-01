/**
 * Template-based Daily Review flag messages (Greek / English).
 * No AI — plain text for Telegram/Discord paste.
 */

export type FlagMessageLanguage = "el" | "en";

export type FlagMessageItemInput = {
  title: string;
  note?: string | null;
  model_name?: string | null;
  phase_title?: string | null;
  phase_number?: number | null;
  platform?: string | null;
};

export type BuildFlagMessageInput = {
  language: FlagMessageLanguage;
  recipientFullName: string;
  senderFullName: string;
  /** Athens YMD YYYY-MM-DD */
  reviewDate: string;
  items: FlagMessageItemInput[];
};

export type FlagMessagePart = {
  index: number;
  total: number;
  text: string;
};

/** Soft limit for Telegram-ish paste; split at item boundaries above this. */
export const FLAG_MESSAGE_SOFT_LIMIT = 3500;

const LANG_STORAGE_PREFIX = "daily-review-flag-msg-lang:v1:";

export function firstNameFromFullName(fullName: string): string {
  const trimmed = fullName.trim();
  if (!trimmed) return "";
  return trimmed.split(/\s+/)[0] ?? trimmed;
}

export function formatFlagMessageDate(ymd: string, _language: FlagMessageLanguage): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!m) return ymd;
  const [, y, mo, d] = m;
  return `${d}/${mo}/${y}`;
}

export function readStoredFlagMessageLanguage(vaId: string): FlagMessageLanguage | null {
  try {
    if (typeof window === "undefined") return null;
    const raw = window.localStorage.getItem(`${LANG_STORAGE_PREFIX}${vaId}`);
    if (raw === "el" || raw === "en") return raw;
    return null;
  } catch {
    return null;
  }
}

export function writeStoredFlagMessageLanguage(vaId: string, language: FlagMessageLanguage): void {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(`${LANG_STORAGE_PREFIX}${vaId}`, language);
  } catch {
    // ignore quota / private mode
  }
}

function phasePlatformLabel(item: FlagMessageItemInput): string {
  const phase =
    (item.phase_title || "").trim() ||
    (item.phase_number != null ? `Phase ${item.phase_number}` : "");
  const platform = (item.platform || "").trim();
  if (phase && platform) return `${phase} · ${platform}`;
  return phase || platform || "";
}

function formatItemLine(item: FlagMessageItemInput): string {
  const title = (item.title || "Untitled").trim() || "Untitled";
  const note = item.note != null ? String(item.note) : "";
  // Preserve note emoji / line breaks exactly; omit ": " when note empty/whitespace-only.
  if (note.trim().length === 0) return `- ${title}`;
  return `- ${title}: ${note}`;
}

/**
 * Ordered body segments: each entry is either a header block or a single item line.
 * Used so long messages can split on item boundaries without cutting mid-item.
 */
export function buildFlagMessageBodySegments(items: FlagMessageItemInput[]): string[] {
  const segments: string[] = [];
  let lastModel = "";
  let lastSection = "";

  for (const item of items) {
    const model = (item.model_name || "").trim() || "General";
    const section = phasePlatformLabel(item);
    const headers: string[] = [];
    if (model !== lastModel) {
      if (segments.length) headers.push(""); // blank line between models
      headers.push(model);
      lastModel = model;
      lastSection = "";
    }
    if (section !== lastSection) {
      if (section) headers.push(section);
      lastSection = section;
    }
    const headerBlock = headers.join("\n");
    if (headerBlock) segments.push(headerBlock);
    segments.push(formatItemLine(item));
  }
  return segments;
}

function joinBodySegments(segments: string[]): string {
  // Headers may end with blank line marker ""; item lines always start with "- "
  const out: string[] = [];
  for (const seg of segments) {
    if (seg === "") {
      if (out.length && out[out.length - 1] !== "") out.push("");
      continue;
    }
    out.push(seg);
  }
  return out.join("\n");
}

/** Build the full message (single string, no part headers). */
export function buildFlagMessage(input: BuildFlagMessageInput): string {
  const name =
    firstNameFromFullName(input.recipientFullName) ||
    input.recipientFullName.trim() ||
    "there";
  const sender =
    firstNameFromFullName(input.senderFullName) || input.senderFullName.trim() || "Team";
  const date = formatFlagMessageDate(input.reviewDate, input.language);
  const n = input.items.length;
  const body = joinBodySegments(buildFlagMessageBodySegments(input.items));

  if (input.language === "el") {
    return [
      `Γεια σου ${name}, στο daily review της ${date} βρέθηκαν ${n} σημεία που χρειάζονται διόρθωση:`,
      "",
      body,
      "",
      "Παρακαλώ τα διορθώνεις και μου γράφεις όταν είναι έτοιμα.",
      `Ευχαριστώ, ${sender}`,
    ].join("\n");
  }

  return [
    `Hi ${name}, in the daily review of ${date} ${n} items need fixing:`,
    "",
    body,
    "",
    "Please fix them and let me know when they're done.",
    `Thanks, ${sender}`,
  ].join("\n");
}

/**
 * Split a built message into pasteable parts at item boundaries when over soft limit.
 * Part headers use "Part i/n".
 */
export function splitFlagMessage(
  fullText: string,
  softLimit = FLAG_MESSAGE_SOFT_LIMIT,
): FlagMessagePart[] {
  if (fullText.length <= softLimit) {
    return [{ index: 1, total: 1, text: fullText }];
  }

  const lines = fullText.split("\n");
  const firstItemIdx = lines.findIndex((l) => l.startsWith("- "));
  if (firstItemIdx < 0) {
    const chunks: string[] = [];
    for (let i = 0; i < fullText.length; i += softLimit) {
      chunks.push(fullText.slice(i, i + softLimit));
    }
    const total = chunks.length;
    return chunks.map((text, idx) => ({
      index: idx + 1,
      total,
      text: `Part ${idx + 1}/${total}\n\n${text}`,
    }));
  }

  let lastItemIdx = firstItemIdx;
  for (let i = firstItemIdx; i < lines.length; i++) {
    if (lines[i].startsWith("- ")) lastItemIdx = i;
  }

  const intro = lines.slice(0, firstItemIdx).join("\n").replace(/\n+$/, "");
  const outro = lines.slice(lastItemIdx + 1).join("\n").replace(/^\n+/, "");
  const middleLines = lines.slice(firstItemIdx, lastItemIdx + 1);

  // Group middle into units: optional headers + one item line
  const units: string[] = [];
  let pendingHeaders: string[] = [];
  for (const line of middleLines) {
    if (line.startsWith("- ")) {
      const unit = [...pendingHeaders, line].join("\n");
      units.push(unit);
      pendingHeaders = [];
    } else {
      pendingHeaders.push(line);
    }
  }
  if (pendingHeaders.length) {
    if (units.length) units[units.length - 1] += `\n${pendingHeaders.join("\n")}`;
    else units.push(pendingHeaders.join("\n"));
  }

  const partOverhead = 20; // "Part X/Y\n\n"
  const packs: string[][] = [];
  let pack: string[] = [];
  let packLen = 0;

  function flush() {
    if (!pack.length) return;
    packs.push(pack);
    pack = [];
    packLen = 0;
  }

  for (let i = 0; i < units.length; i++) {
    const unit = units[i];
    const sep = pack.length ? 2 : 0; // \n\n between units
    const nextLen = packLen + sep + unit.length;
    const withShell =
      nextLen +
      partOverhead +
      (packs.length === 0 ? intro.length + 2 : 0) +
      (i === units.length - 1 ? outro.length + 2 : 0);

    if (pack.length && withShell > softLimit) {
      flush();
    }
    pack.push(unit);
    packLen += (pack.length > 1 ? 2 : 0) + unit.length;
  }
  flush();

  if (!packs.length) {
    return [{ index: 1, total: 1, text: fullText }];
  }

  const total = packs.length;
  return packs.map((unitsInPack, idx) => {
    const body = unitsInPack.join("\n\n");
    const pieces: string[] = [];
    if (idx === 0 && intro) pieces.push(intro);
    pieces.push(body);
    if (idx === total - 1 && outro) pieces.push(outro);
    const core = pieces.join("\n\n");
    const text = total === 1 ? core : `Part ${idx + 1}/${total}\n\n${core}`;
    return { index: idx + 1, total, text };
  });
}

/** Build + split in one call. */
export function buildFlagMessageParts(input: BuildFlagMessageInput): FlagMessagePart[] {
  return splitFlagMessage(buildFlagMessage(input));
}

/** Collect flagged checklist items for one person (supervisor or shared admin tree). */
export function collectFlaggedItemsForVa(va: {
  tasks: Array<{
    items: Array<{
      title: string;
      model_name?: string;
      phase_title?: string;
      phase_number?: number;
      platform?: string | null;
      verification?: { verified_status: string; note?: string | null } | null;
      verifications?: Array<{ verified_status: string; note?: string | null }>;
    }>;
  }>;
}): FlagMessageItemInput[] {
  const out: FlagMessageItemInput[] = [];
  for (const task of va.tasks) {
    for (const item of task.items) {
      const list =
        item.verifications ??
        (item.verification ? [item.verification] : []);
      const flagged = list.find((v) => v.verified_status === "flagged_not_done");
      if (!flagged) continue;
      out.push({
        title: item.title,
        note: flagged.note ?? null,
        model_name: item.model_name,
        phase_title: item.phase_title,
        phase_number: item.phase_number,
        platform: item.platform ?? null,
      });
    }
  }
  return out;
}
