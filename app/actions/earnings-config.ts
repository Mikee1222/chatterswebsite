"use server";

import { getSessionFromCookies } from "@/lib/auth";
import { upsertManyEarningsConfigRows } from "@/services/earnings-config";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";

export async function saveEarningsAgencyCutPercentsAction(
  rows: { model_id: string; agency_cut_percent: number }[]
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getSessionFromCookies();
  if (!user || !(await hasPermission(user, PERMISSIONS.EARNINGS_CONFIG))) {
    return { ok: false, error: "Unauthorized." };
  }
  try {
    await upsertManyEarningsConfigRows(
      rows.map((r) => ({
        model_id: String(r.model_id ?? "").trim(),
        agency_cut_percent: Number(r.agency_cut_percent),
      }))
    );
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Save failed.";
    return { ok: false, error: msg };
  }
}
