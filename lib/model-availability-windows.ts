import { formatTimeRange } from "@/lib/format";
import type { ModelAvailabilityTimeWindow } from "@/types";

const HH_MM = /^(\d{2}):(\d{2})/;

export function hhmmSlice(raw: string | null | undefined): string {
  if (raw == null || typeof raw !== "string") return "";
  const t = raw.trim();
  const m = t.match(HH_MM);
  return m ? `${m[1]}:${m[2]}` : t.slice(0, 5);
}

function parseMinutes(hhmm: string): number | null {
  const m = hhmm.trim().match(HH_MM);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (!Number.isFinite(h) || !Number.isFinite(min) || h > 23 || min > 59) return null;
  return h * 60 + min;
}

export function windowsFromRecord(
  start: string | null | undefined,
  end: string | null | undefined,
  rawJson: unknown
): ModelAvailabilityTimeWindow[] {
  const parsed = parseAvailabilityWindows(rawJson);
  if (parsed && parsed.length > 0) return parsed;
  const s = hhmmSlice(start ?? "");
  const e = hhmmSlice(end ?? "");
  if (s && e) return [{ start: s, end: e }];
  return [];
}

export function parseAvailabilityWindows(raw: unknown): ModelAvailabilityTimeWindow[] | null {
  if (raw == null) return null;
  const text = typeof raw === "string" ? raw.trim() : "";
  if (!text || text === "[]") return [];
  try {
    const val = JSON.parse(text) as unknown;
    if (!Array.isArray(val)) return null;
    const out: ModelAvailabilityTimeWindow[] = [];
    for (const item of val) {
      if (!item || typeof item !== "object") continue;
      const o = item as { start?: unknown; end?: unknown };
      const start = hhmmSlice(typeof o.start === "string" ? o.start : "");
      const end = hhmmSlice(typeof o.end === "string" ? o.end : "");
      if (!start || !end) continue;
      out.push({ start, end });
    }
    return out.length ? out : [];
  } catch {
    return null;
  }
}

/** Sort by start time for stable storage / overlap checks */
export function sortWindows(ws: ModelAvailabilityTimeWindow[]): ModelAvailabilityTimeWindow[] {
  return [...ws].sort((a, b) => parseMinutes(a.start)! - parseMinutes(b.start)!);
}

export type WindowsValidation =
  | { ok: true; normalized: ModelAvailabilityTimeWindow[] }
  | { ok: false; error: string };

export function validateTimeWindows(ws: ModelAvailabilityTimeWindow[]): WindowsValidation {
  const normalized = ws.map((w) => ({
    start: hhmmSlice(w.start),
    end: hhmmSlice(w.end),
  }));
  if (normalized.length === 0) {
    return { ok: false, error: "At least one time window is required." };
  }
  for (const w of normalized) {
    if (!w.start.trim() || !w.end.trim()) {
      return { ok: false, error: "Each window needs a start and end time." };
    }
    const a = parseMinutes(w.start);
    const b = parseMinutes(w.end);
    if (a == null || b == null) {
      return { ok: false, error: "Invalid time format." };
    }
    if (a >= b) {
      return { ok: false, error: "End time must be after start time." };
    }
  }
  const sorted = sortWindows(normalized);
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]!;
    const cur = sorted[i]!;
    const prevEnd = parseMinutes(prev.end)!;
    const curStart = parseMinutes(cur.start)!;
    if (curStart < prevEnd) {
      return { ok: false, error: "Windows cannot overlap." };
    }
  }
  return { ok: true, normalized: sorted };
}

export function airtablePayloadFromWindows(
  normalizedSorted: ModelAvailabilityTimeWindow[]
): { start_time: string; end_time: string; availability_windows: string } {
  const first = normalizedSorted[0]!;
  return {
    start_time: first.start,
    end_time: first.end,
    availability_windows: JSON.stringify(normalizedSorted),
  };
}

export function emptyTimeFieldsPayload(): { start_time: null; end_time: null; availability_windows: string } {
  return { start_time: null, end_time: null, availability_windows: "[]" };
}

export function formatModelAvailabilityWindows(windows: ModelAvailabilityTimeWindow[]): string {
  if (!windows.length) return "";
  return windows.map((w) => formatTimeRange(w.start, w.end)).join(" · ");
}
