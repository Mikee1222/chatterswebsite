/**
 * Active model profile selection for multi-profile model login users.
 * Cookie persists across SSR so Content/Live/Earnings/Schedule/Customs scope correctly.
 */

import { cookies } from "next/headers";

export const MODEL_ACTIVE_PROFILE_COOKIE = "model_active_profile";

/** Cookie max-age: 1 year. */
export const MODEL_ACTIVE_PROFILE_MAX_AGE = 60 * 60 * 24 * 365;

export function pickActiveModelProfileId(
  linkedModelIds: string[],
  primaryModelId: string | null | undefined,
  cookieValue: string | null | undefined
): string | null {
  const ids = linkedModelIds.map((id) => id.trim()).filter(Boolean);
  if (!ids.length) return null;
  const cookie = cookieValue?.trim() || "";
  if (cookie && ids.includes(cookie)) return cookie;
  const primary = primaryModelId?.trim() || "";
  if (primary && ids.includes(primary)) return primary;
  return ids[0] ?? null;
}

export async function readActiveModelProfileCookie(): Promise<string | null> {
  try {
    const jar = await cookies();
    const v = jar.get(MODEL_ACTIVE_PROFILE_COOKIE)?.value?.trim();
    return v || null;
  } catch {
    return null;
  }
}

export function activeProfileCookieOptions(modelId: string) {
  return {
    name: MODEL_ACTIVE_PROFILE_COOKIE,
    value: modelId.trim(),
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge: MODEL_ACTIVE_PROFILE_MAX_AGE,
    secure: process.env.NODE_ENV === "production",
  };
}
