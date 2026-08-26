/**
 * Lightweight fuzzy score for command palette / global search.
 * Higher = better match. Returns 0 when no match.
 */

export function fuzzyScore(haystack: string | null | undefined, query: string): number {
  const h = (haystack ?? "").toLowerCase().trim();
  const q = query.toLowerCase().trim();
  if (!q || !h) return 0;
  if (h === q) return 1000;
  if (h.startsWith(q)) return 800 + Math.min(q.length, 50);
  if (h.includes(q)) return 500 + Math.min(q.length, 50);

  // Subsequence match (e.g. "mdl" → "model")
  let qi = 0;
  let consecutive = 0;
  let bonus = 0;
  for (let i = 0; i < h.length && qi < q.length; i++) {
    if (h[i] === q[qi]) {
      qi++;
      consecutive++;
      bonus += consecutive * 2;
    } else {
      consecutive = 0;
    }
  }
  if (qi === q.length) return 200 + bonus;
  return 0;
}

export function fuzzyMatchAny(
  fields: Array<string | null | undefined>,
  query: string,
): number {
  let best = 0;
  for (const f of fields) {
    const s = fuzzyScore(f, query);
    if (s > best) best = s;
  }
  return best;
}
