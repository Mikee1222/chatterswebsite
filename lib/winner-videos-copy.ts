import type { WinnerVideoRecord } from "@/services/winner-videos";

const BULK_SEPARATOR = "—————";

/** Copy-friendly date, e.g. "3 Jul 2026". */
export function formatWinnerVideoCopyDate(isoString: string | null | undefined): string {
  if (!isoString?.trim()) return "—";
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatWinnerVideoSingleCopy(video: WinnerVideoRecord): string {
  const lines = [
    video.reference_model_name?.trim() || "—",
    video.video_link?.trim() || "",
  ].filter(Boolean);

  if (video.note?.trim()) lines.push(video.note.trim());
  if (video.content_type) lines.push(`Type: ${video.content_type}`);
  lines.push(`Submitted: ${formatWinnerVideoCopyDate(video.submitted_at)}`);
  return lines.join("\n");
}

export function formatWinnerVideoBulkCopy(videos: WinnerVideoRecord[]): string {
  return videos
    .map((video, index) => {
      const header = `${index + 1}. ${(video.reference_model_name?.trim() || "—").toUpperCase()} — ${formatWinnerVideoCopyDate(video.submitted_at)}`;
      const lines = [header, video.video_link?.trim() || ""].filter(Boolean);
      if (video.note?.trim()) lines.push(video.note.trim());
      if (video.content_type) lines.push(`Type: ${video.content_type}`);
      return lines.join("\n");
    })
    .join(`\n${BULK_SEPARATOR}\n`);
}

export async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to execCommand (still works inside some gesture contexts).
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "0";
    ta.style.left = "-9999px";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    ta.setSelectionRange(0, text.length);
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

/**
 * Copy text while preserving the user-gesture when the value itself must be
 * fetched asynchronously (mobile Safari/Chrome revoke clipboard after await fetch).
 * Prefer ClipboardItem + Promise when available; otherwise resolve then fallback copy.
 */
export async function copyTextPreservingGesture(
  textOrPromise: string | Promise<string>,
): Promise<boolean> {
  if (typeof textOrPromise === "string") {
    return copyTextToClipboard(textOrPromise);
  }

  const supportsDeferredClipboardItem =
    typeof ClipboardItem !== "undefined" &&
    typeof navigator.clipboard?.write === "function";

  if (supportsDeferredClipboardItem) {
    try {
      const blobPromise = textOrPromise.then(
        (text) => new Blob([text], { type: "text/plain" }),
      );
      await navigator.clipboard.write([
        new ClipboardItem({ "text/plain": blobPromise }),
      ]);
      return true;
    } catch {
      // Fall through — some browsers reject Promise-valued ClipboardItem.
    }
  }

  try {
    const text = await textOrPromise;
    return copyTextToClipboard(text);
  } catch {
    return false;
  }
}

export function truncateNote(note: string | null | undefined, maxLen = 80): string {
  const trimmed = note?.trim() ?? "";
  if (!trimmed) return "";
  if (trimmed.length <= maxLen) return trimmed;
  return `${trimmed.slice(0, maxLen).trimEnd()}…`;
}
