import { eurToUsd } from "@/lib/exchange";
import type { CustomRequest, WhaleTransaction } from "@/types";

function txToUsd(t: WhaleTransaction): number {
  const amt = t.amount ?? 0;
  return t.currency === "eur" ? eurToUsd(amt) : amt;
}

function formatYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Last N calendar days ending today (local). */
function lastNYmd(n: number): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    out.push(formatYmd(d));
  }
  return out;
}

function transactionTimestampMs(t: WhaleTransaction): number {
  const iso = t.created_at?.trim();
  if (iso) {
    const ms = Date.parse(iso);
    if (!Number.isNaN(ms)) return ms;
  }
  const day = (t.date ?? "").slice(0, 10);
  const time = (t.time ?? "").trim();
  if (day && time) {
    const combined = `${day}T${time.includes("T") ? time.split("T").pop() : time}`;
    const ms = Date.parse(combined);
    if (!Number.isNaN(ms)) return ms;
  }
  if (day) {
    const ms = Date.parse(`${day}T12:00:00`);
    if (!Number.isNaN(ms)) return ms;
  }
  return 0;
}

export type AdminRecentActivityItem = {
  id: string;
  kind: "whale_session" | "custom_request";
  title: string;
  subtitle: string;
  atIso: string;
  pending?: boolean;
};

/**
 * Merge latest whale sessions and custom requests for the admin home “recent activity” list.
 */
export function buildAdminRecentActivity(
  transactions: WhaleTransaction[],
  customs: CustomRequest[],
  limit = 12
): AdminRecentActivityItem[] {
  const txRecent = [...transactions]
    .sort((a, b) => transactionTimestampMs(b) - transactionTimestampMs(a))
    .slice(0, 80);
  const customsRecent = [...customs]
    .sort((a, b) => {
      const tb = Date.parse(a.created_at ?? "") || 0;
      const ta = Date.parse(b.created_at ?? "") || 0;
      return ta - tb;
    })
    .slice(0, 80);

  const fromTx: AdminRecentActivityItem[] = txRecent.map((t) => {
    const ms = transactionTimestampMs(t);
    const atIso = ms > 0 ? new Date(ms).toISOString() : `${(t.date ?? "1970-01-01").slice(0, 10)}T12:00:00.000Z`;
    const usd = txToUsd(t);
    return {
      id: `tx-${t.id}`,
      kind: "whale_session" as const,
      title: "Whale session logged",
      subtitle: `$${usd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} · ${t.model_name?.trim() || "—"} · ${t.chatter_name?.trim() || "—"}`,
      atIso,
    };
  });

  const fromCustoms: AdminRecentActivityItem[] = customsRecent.map((c) => {
    const raw = c.created_at?.trim();
    const parsed = raw ? Date.parse(raw) : NaN;
    const atIso = !Number.isNaN(parsed) ? new Date(parsed).toISOString() : new Date(0).toISOString();
    const pending = c.admin_status === "pending";
    return {
      id: `cr-${c.id}`,
      kind: "custom_request" as const,
      title: c.request_title?.trim() || "Custom request",
      subtitle: `${c.assigned_model_name?.trim() || "—"} · ${c.fan_username?.trim() || "—"}`,
      atIso,
      pending,
    };
  });

  return [...fromTx, ...fromCustoms]
    .sort((a, b) => Date.parse(b.atIso) - Date.parse(a.atIso))
    .slice(0, limit);
}

export type AdminSparklineDay = { ymd: string; label: string; usd: number };

export type AdminSparklineWow = {
  sparkline7: AdminSparklineDay[];
  thisWeekUsd: number;
  prevWeekUsd: number;
  /** Percent change vs previous week; null if previous week was 0. */
  wowPercent: number | null;
};

/** Last 7 days for sparkline + WoW vs prior 7 days (whale_transactions `date`, USD). */
export function buildAdminSparklineWow(transactions: WhaleTransaction[]): AdminSparklineWow {
  const ymds = lastNYmd(14);
  const byDay = new Map<string, number>();
  for (const y of ymds) byDay.set(y, 0);
  for (const t of transactions) {
    const day = (t.date ?? "").slice(0, 10);
    if (byDay.has(day)) byDay.set(day, (byDay.get(day) ?? 0) + txToUsd(t));
  }

  const last7 = ymds.slice(-7);
  const prev7 = ymds.slice(0, 7);

  const sparkline7: AdminSparklineDay[] = last7.map((ymd) => {
    const [, mo, da] = ymd.split("-");
    return {
      ymd,
      label: `${Number(mo)}/${Number(da)}`,
      usd: byDay.get(ymd) ?? 0,
    };
  });

  const thisWeekUsd = last7.reduce((s, y) => s + (byDay.get(y) ?? 0), 0);
  const prevWeekUsd = prev7.reduce((s, y) => s + (byDay.get(y) ?? 0), 0);

  let wowPercent: number | null = null;
  if (prevWeekUsd > 0) wowPercent = ((thisWeekUsd - prevWeekUsd) / prevWeekUsd) * 100;
  else if (thisWeekUsd > 0) wowPercent = null;

  return { sparkline7, thisWeekUsd, prevWeekUsd, wowPercent };
}
