/**
 * Shared nested key lookup and `{param}` interpolation for JSON message packs.
 */

export function getNestedMessageString(root: unknown, path: string): string | undefined {
  const parts = path.split(".").filter(Boolean);
  let cur: unknown = root;
  for (const p of parts) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return typeof cur === "string" ? cur : undefined;
}

export function interpolate(
  template: string,
  params?: Record<string, string | number | undefined | null>
): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, k: string) => {
    const v = params[k];
    return v != null && v !== "" ? String(v) : `{${k}}`;
  });
}
