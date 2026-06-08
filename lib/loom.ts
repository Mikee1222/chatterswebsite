/**
 * Parse Loom share or embed URLs into the video id used in embed iframes.
 */
export function extractLoomId(url: string): string | null {
  const trimmed = (url ?? "").trim();
  if (!trimmed) return null;

  try {
    const normalized = trimmed.startsWith("http") ? trimmed : `https://${trimmed}`;
    const parsed = new URL(normalized);
    const match = parsed.pathname.match(/\/(?:share|embed)\/([a-zA-Z0-9_-]+)/);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}
