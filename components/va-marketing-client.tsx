"use client";

import * as React from "react";
import {
  AlertTriangle,
  Ban,
  ChevronRight,
  ClipboardList,
  ExternalLink,
  Link2,
  CheckCircle2,
  ShieldAlert,
} from "lucide-react";
import type {
  FunnelLink,
  ShadowbanReport,
  ShadowbanReportStatus,
  ShadowbanReportType,
  SocialAccount,
  SocialAccountStatus,
} from "@/services/marketing";
import { stripShadowbanReportNotesPrefix } from "@/lib/shadowban-helpers";
import { formatDateTimeAthens } from "@/lib/format";
import { VAShadowbanReportModal } from "@/components/va-shadowban-report-modal";
import { VARestrictionLiftedModal } from "@/components/va-restriction-lifted-modal";
import { PlatformIconBadge } from "@/components/social-platform-icon";
import { getSocialColor, getPlatformAccentGlow } from "@/lib/social-platform-config";
import {
  VA_CARD,
  VA_CARD_GLOW,
  VA_CHAMPAGNE_DIVIDER,
  VA_MODEL_TAG,
  VA_STATUS_BADGE,
} from "@/lib/va-tasks-tokens";
import { cn } from "@/lib/utils";
import { useSupabaseRealtimeRefresh } from "@/lib/hooks/use-supabase-realtime";

type ModelGroup<T> = { modelName: string; items: T[] };

function groupByModel<T extends { model_id?: string; model_name?: string }>(
  rows: T[],
): Map<string, ModelGroup<T>> {
  const map = new Map<string, ModelGroup<T>>();
  for (const row of rows) {
    const key = row.model_id?.trim() || "unknown";
    const existing = map.get(key);
    if (existing) {
      existing.items.push(row);
    } else {
      map.set(key, {
        modelName: row.model_name?.trim() || "Creator",
        items: [row],
      });
    }
  }
  return map;
}

const STATUS_CONFIG: Record<
  SocialAccountStatus,
  {
    cardClass: string;
    glowClass: string;
    badgeClass: string;
    dotClass: string;
    pulse: boolean;
    label: string;
  }
> = {
  active: {
    cardClass: "border-[rgba(255,255,255,0.06)]",
    glowClass: "",
    badgeClass:
      "border-emerald-500/30 bg-emerald-500/8 text-emerald-300/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]",
    dotClass: "bg-emerald-400/75 shadow-[0_0_6px_rgba(52,211,153,0.35)]",
    pulse: false,
    label: "Active",
  },
  shadowbanned: {
    cardClass: "border-amber-500/30",
    glowClass:
      "before:pointer-events-none before:absolute before:-inset-4 before:-z-10 before:rounded-[20px] before:bg-[radial-gradient(ellipse_at_center,rgba(245,158,11,0.18)_0%,transparent_72%)] before:opacity-70 before:blur-xl max-md:before:opacity-45",
    badgeClass:
      "border-amber-500/40 bg-amber-500/12 text-amber-300 shadow-[0_0_14px_-4px_rgba(245,158,11,0.4)]",
    dotClass: "bg-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.55)]",
    pulse: true,
    label: "Shadowbanned",
  },
  banned: {
    cardClass: "border-red-500/35",
    glowClass:
      "before:pointer-events-none before:absolute before:-inset-5 before:-z-10 before:rounded-[22px] before:bg-[radial-gradient(ellipse_at_center,rgba(239,68,68,0.22)_0%,transparent_68%)] before:opacity-90 before:blur-2xl max-md:before:opacity-50",
    badgeClass:
      "border-red-500/45 bg-red-500/15 text-red-300 shadow-[0_0_16px_-4px_rgba(239,68,68,0.5)]",
    dotClass: "bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.65)]",
    pulse: true,
    label: "Banned",
  },
};

function StatusDot({ status }: { status: SocialAccountStatus }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.active;
  return (
    <span className="relative flex h-2 w-2 shrink-0" aria-hidden>
      {cfg.pulse ? (
        <span
          className={cn(
            "absolute inline-flex h-full w-full animate-pulse rounded-full opacity-60 motion-reduce:animate-none",
            status === "banned" ? "bg-red-500" : "bg-amber-400",
          )}
        />
      ) : null}
      <span className={cn("relative inline-flex h-2 w-2 rounded-full", cfg.dotClass)} />
    </span>
  );
}

function StatusBadge({ status }: { status: SocialAccountStatus }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.active;
  return (
    <span className={cn(VA_STATUS_BADGE, "gap-1.5 normal-case tracking-normal", cfg.badgeClass)}>
      <StatusDot status={status} />
      {cfg.label}
    </span>
  );
}

function AccountCard({
  acc,
  pendingLifted,
  onReportLifted,
}: {
  acc: SocialAccount;
  pendingLifted: boolean;
  onReportLifted: (acc: SocialAccount) => void;
}) {
  const plat = acc.platform?.trim() || "Other";
  const color = getSocialColor(plat);
  const href = acc.account_link?.trim() || "#";
  const st: SocialAccountStatus = acc.account_status ?? "active";
  const cfg = STATUS_CONFIG[st] ?? STATUS_CONFIG.active;

  return (
    <article
      className={cn(
        "relative overflow-hidden rounded-xl border bg-[#0D0B0D]/80 p-4 transition duration-200 motion-reduce:transition-none",
        "shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_4px_16px_-8px_rgba(0,0,0,0.5)]",
        "hover:border-[#D4AF8C]/25 max-md:hover:translate-y-0",
        cfg.cardClass,
        cfg.glowClass,
      )}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <PlatformIconBadge platform={plat} />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">@{acc.username}</p>
            <p className="mt-0.5 text-xs text-[#B8B4B8]/50">{plat}</p>
          </div>
        </div>
        <StatusBadge status={st} />
      </div>
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        onClick={(e) => {
          if (!acc.account_link?.trim()) e.preventDefault();
        }}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium text-white transition",
          "hover:scale-[1.02] motion-reduce:transform-none",
          getPlatformAccentGlow(plat),
          "max-md:shadow-none",
        )}
        style={{ backgroundColor: `${color}12`, borderColor: `${color}35` }}
      >
        Open profile
        <ExternalLink className="h-3 w-3 text-white/40" />
      </a>
      {(st === "shadowbanned" || st === "banned") && (
        <div className="mt-3">
          {pendingLifted ? (
            <p className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/25 bg-emerald-500/8 px-3 py-2 text-xs font-medium text-emerald-300/90">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
              Reported — awaiting confirmation
            </p>
          ) : (
            <button
              type="button"
              onClick={() => onReportLifted(acc)}
              className={cn(
                "inline-flex w-full items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition",
                "border-emerald-500/30 bg-emerald-500/8 text-emerald-300/90",
                "hover:border-emerald-500/45 hover:bg-emerald-500/12",
              )}
            >
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
              Report restriction lifted
            </button>
          )}
        </div>
      )}
    </article>
  );
}

function CreatorPortfolio({
  modelId,
  modelName,
  accounts,
  pendingLiftedAccountIds,
  onReportLifted,
}: {
  modelId: string;
  modelName: string;
  accounts: SocialAccount[];
  pendingLiftedAccountIds: Set<string>;
  onReportLifted: (acc: SocialAccount) => void;
}) {
  const issueCount = accounts.filter((a) => (a.account_status ?? "active") !== "active").length;

  return (
    <section key={modelId} className={cn(VA_CARD, "overflow-hidden")}>
      <header className="px-5 pb-4 pt-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#D4AF8C]/60">Creator</p>
        <h2 className="mt-1.5 text-lg font-semibold text-white">{modelName}</h2>
        <div className={cn(VA_CHAMPAGNE_DIVIDER, "mt-3")} />
        <div className="mt-3 flex flex-wrap gap-2">
          <span className={VA_MODEL_TAG}>
            {accounts.length} account{accounts.length === 1 ? "" : "s"}
          </span>
          {issueCount > 0 ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/8 px-2.5 py-0.5 text-xs font-medium text-amber-300 shadow-[0_0_12px_-4px_rgba(245,158,11,0.3)] max-md:shadow-none">
              <AlertTriangle className="h-3 w-3" aria-hidden />
              {issueCount} need{issueCount === 1 ? "s" : ""} attention
            </span>
          ) : null}
        </div>
      </header>

      <div className="relative px-5 pb-5">
        <div
          className="absolute bottom-5 left-[1.125rem] top-0 w-px bg-gradient-to-b from-[#D4AF8C]/50 via-[#FF1493]/30 to-transparent"
          aria-hidden
        />
        <div className="space-y-3 pl-7">
          {accounts.map((acc) => (
            <AccountCard
              key={acc.id}
              acc={acc}
              pendingLifted={pendingLiftedAccountIds.has(acc.account_id)}
              onReportLifted={onReportLifted}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function TrackingLinksSection({ funnels }: { funnels: FunnelLink[] }) {
  const grouped = React.useMemo(() => groupByModel(funnels), [funnels]);
  const [expanded, setExpanded] = React.useState<Set<string>>(() => new Set());

  if (funnels.length === 0) return null;

  function toggle(modelId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(modelId)) next.delete(modelId);
      else next.add(modelId);
      return next;
    });
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-3">
        <div className={cn(VA_CHAMPAGNE_DIVIDER, "flex-1")} />
        <div className="flex shrink-0 items-center gap-2 text-[#D4AF8C]/70">
          <Link2 className="h-4 w-4" aria-hidden />
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em]">Tracking links</span>
        </div>
        <div className={cn(VA_CHAMPAGNE_DIVIDER, "flex-1")} />
      </div>
      <p className="text-center text-xs text-[#B8B4B8]/45">Read-only promo links shared for your creators</p>

      <div className="space-y-3">
        {[...grouped.entries()].map(([modelId, group]) => {
          const isOpen = expanded.has(modelId);
          return (
            <div
              key={modelId}
              className={cn(
                VA_CARD,
                "overflow-hidden border-[rgba(255,255,255,0.05)] bg-[#121012]/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
              )}
            >
              <button
                type="button"
                onClick={() => toggle(modelId)}
                className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition hover:bg-white/[0.02]"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[#B8B4B8]/90">{group.modelName}</p>
                  <p className="mt-0.5 text-xs text-[#B8B4B8]/40">
                    {group.items.length} link{group.items.length === 1 ? "" : "s"}
                  </p>
                </div>
                <ChevronRight
                  className={cn(
                    "h-4 w-4 shrink-0 text-[#D4AF8C]/45 transition-transform duration-300 motion-reduce:transition-none",
                    isOpen && "rotate-90",
                  )}
                  aria-hidden
                />
              </button>
              <div
                className={cn(
                  "overflow-hidden transition-[max-height] duration-300 ease-in-out motion-reduce:transition-none",
                  isOpen ? "max-h-[2000px]" : "max-h-0",
                )}
              >
                <div className="border-t border-[rgba(255,255,255,0.05)] px-5 py-4">
                  <div className={cn(VA_CHAMPAGNE_DIVIDER, "mb-4")} />
                  <div className="grid gap-3 sm:grid-cols-2">
                    {group.items.map((f) => {
                      const color = getSocialColor(f.platform);
                      return (
                        <a
                          key={f.id}
                          href={f.url || "#"}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => {
                            if (!f.url?.trim()) e.preventDefault();
                          }}
                          className={cn(
                            VA_CARD,
                            "flex items-center justify-between gap-3 p-4 transition hover:border-[#D4AF8C]/20",
                          )}
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <PlatformIconBadge platform={f.platform} />
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-white">{f.label}</p>
                              <p className="truncate text-xs text-[#B8B4B8]/45">
                                {[f.platform, f.region].filter(Boolean).join(" · ")}
                              </p>
                            </div>
                          </div>
                          <span
                            className={cn(
                              "inline-flex shrink-0 items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[10px] font-medium text-white",
                              getPlatformAccentGlow(f.platform),
                              "max-md:shadow-none",
                            )}
                            style={{ backgroundColor: `${color}12`, borderColor: `${color}35` }}
                          >
                            Open
                            <ExternalLink className="h-3 w-3 text-white/40" />
                          </span>
                        </a>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

const REPORT_STATUS_CONFIG: Record<
  ShadowbanReportStatus,
  { label: string; badgeClass: string; cardBorder: string }
> = {
  pending: {
    label: "Pending",
    badgeClass:
      "border-amber-500/35 bg-amber-500/10 text-amber-300 shadow-[0_0_12px_-4px_rgba(245,158,11,0.35)]",
    cardBorder: "border-amber-500/25",
  },
  approved: {
    label: "Approved",
    badgeClass:
      "border-emerald-500/35 bg-emerald-500/10 text-emerald-300 shadow-[0_0_12px_-4px_rgba(52,211,153,0.35)]",
    cardBorder: "border-emerald-500/20",
  },
  dismissed: {
    label: "Dismissed",
    badgeClass: "border-white/15 bg-white/5 text-[#B8B4B8]/55",
    cardBorder: "border-white/8 opacity-80",
  },
};

function ReportTypeBadge({ type }: { type: ShadowbanReportType }) {
  if (type === "lifted") {
    return (
      <span
        className={cn(
          VA_STATUS_BADGE,
          "gap-1 normal-case tracking-normal",
          "border-emerald-500/40 bg-emerald-500/12 text-emerald-300 shadow-[0_0_12px_-4px_rgba(52,211,153,0.35)]",
        )}
      >
        <CheckCircle2 className="h-3 w-3" aria-hidden />
        Restriction lifted
      </span>
    );
  }
  const banned = type === "banned";
  return (
    <span
      className={cn(
        VA_STATUS_BADGE,
        "gap-1 normal-case tracking-normal",
        banned
          ? "border-red-500/40 bg-red-500/12 text-red-300 shadow-[0_0_12px_-4px_rgba(239,68,68,0.4)]"
          : "border-amber-500/40 bg-amber-500/12 text-amber-300 shadow-[0_0_12px_-4px_rgba(245,158,11,0.35)]",
      )}
    >
      {banned ? <Ban className="h-3 w-3" aria-hidden /> : <ShieldAlert className="h-3 w-3" aria-hidden />}
      {banned ? "Banned" : "Shadowbanned"}
    </span>
  );
}

function ReportStatusBadge({
  status,
  reportType,
}: {
  status: ShadowbanReportStatus;
  reportType?: ShadowbanReportType;
}) {
  const cfg = REPORT_STATUS_CONFIG[status] ?? REPORT_STATUS_CONFIG.pending;
  // Lift reports read more clearly as "Confirmed — account active" than "Approved".
  const label =
    reportType === "lifted" && status === "approved"
      ? "Confirmed — account active"
      : cfg.label;
  return (
    <span className={cn(VA_STATUS_BADGE, "normal-case tracking-normal", cfg.badgeClass)}>{label}</span>
  );
}

function MyReportCard({ report }: { report: ShadowbanReport }) {
  const plat = report.platform?.trim() || "Other";
  const statusCfg = REPORT_STATUS_CONFIG[report.status] ?? REPORT_STATUS_CONFIG.pending;
  const displayNotes = stripShadowbanReportNotesPrefix(report.notes);

  return (
    <article
      className={cn(
        VA_CARD,
        "overflow-hidden p-0",
        statusCfg.cardBorder,
        report.status === "pending" && report.report_type !== "lifted" && VA_CARD_GLOW,
        report.status === "pending" &&
          report.report_type !== "lifted" &&
          "before:bg-[radial-gradient(ellipse_at_center,rgba(245,158,11,0.1)_0%,transparent_70%)] max-md:before:opacity-40",
      )}
    >
      <div className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <PlatformIconBadge platform={plat} size="sm" />
              <div className="min-w-0">
                <p className="truncate font-semibold text-white">@{report.username}</p>
                <p className="text-xs text-[#B8B4B8]/45">{plat}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className={VA_MODEL_TAG}>{report.model_name || "Creator"}</span>
              <ReportTypeBadge type={report.report_type} />
              <ReportStatusBadge status={report.status} reportType={report.report_type} />
            </div>
            {displayNotes ? (
              <p className="rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2 text-sm text-[#B8B4B8]/65">
                {displayNotes}
              </p>
            ) : null}
            {report.status !== "pending" ? (
              <p className="text-xs text-[#B8B4B8]/45">
                <span className="font-medium text-[#B8B4B8]/70">
                  {report.status === "approved" ? "Confirmed" : "Dismissed"}
                </span>
                {report.reviewed_by ? (
                  <>
                    {" "}
                    by <span className="text-white/70">{report.reviewed_by}</span>
                  </>
                ) : null}
                {report.reviewed_at ? (
                  <span className="ml-1 text-[#B8B4B8]/35">· {formatDateTimeAthens(report.reviewed_at)}</span>
                ) : null}
              </p>
            ) : null}
            <p className="text-xs text-[#B8B4B8]/40">
              Submitted {report.created_at ? formatDateTimeAthens(report.created_at) : "—"}
            </p>
          </div>
        </div>
      </div>
    </article>
  );
}

function MyReportsSection({
  reports,
  loading,
}: {
  reports: ShadowbanReport[];
  loading: boolean;
}) {
  return (
    <section className="space-y-4">
      <div className="flex items-center gap-3">
        <div className={cn(VA_CHAMPAGNE_DIVIDER, "flex-1")} />
        <div className="flex shrink-0 items-center gap-2 text-[#D4AF8C]/70">
          <ClipboardList className="h-4 w-4" aria-hidden />
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em]">My reports</span>
        </div>
        <div className={cn(VA_CHAMPAGNE_DIVIDER, "flex-1")} />
      </div>
      <p className="text-center text-xs text-[#B8B4B8]/45">
        Shadowban, ban, and restriction-lift reports you&apos;ve submitted
      </p>

      {loading ? (
        <div className={cn(VA_CARD, "px-6 py-10 text-center text-sm text-[#B8B4B8]/40")}>Loading reports…</div>
      ) : reports.length === 0 ? (
        <div className={cn(VA_CARD, "flex flex-col items-center px-6 py-12 text-center")}>
          <ClipboardList className="mb-4 h-10 w-10 text-[#D4AF8C]/35" aria-hidden />
          <p className="font-semibold text-white">No reports yet</p>
          <p className="mt-2 max-w-sm text-sm text-[#B8B4B8]/55">
            When you report an issue or a restriction lift, it will appear here with its review status.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((report) => (
            <MyReportCard key={report.id} report={report} />
          ))}
        </div>
      )}
    </section>
  );
}

function MarketingEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <svg className="mb-6 h-20 w-20 text-[#D4AF8C]/35" viewBox="0 0 64 64" fill="none" aria-hidden>
        <rect x="18" y="10" width="28" height="44" rx="6" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
        <circle cx="32" cy="48" r="2" fill="currentColor" opacity="0.4" />
        <path
          d="M26 20h12M26 28h8"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          opacity="0.45"
        />
      </svg>
      <p className="text-xl font-semibold text-white">No accounts yet</p>
      <p className="mt-2 max-w-sm text-sm text-[#B8B4B8]/55">
        When an admin assigns social handles to you, they&apos;ll show up here — grouped by creator, ready to open.
      </p>
    </div>
  );
}

export function VaMarketingClient() {
  const [accounts, setAccounts] = React.useState<SocialAccount[]>([]);
  const [funnels, setFunnels] = React.useState<FunnelLink[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState<string | null>(null);
  const [shadowbanOpen, setShadowbanOpen] = React.useState(false);
  const [liftedTarget, setLiftedTarget] = React.useState<SocialAccount | null>(null);
  const [pendingLiftedAccountIds, setPendingLiftedAccountIds] = React.useState<Set<string>>(() => new Set());
  const [myReports, setMyReports] = React.useState<ShadowbanReport[]>([]);
  const [reportsLoading, setReportsLoading] = React.useState(true);

  const reload = React.useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/va/marketing/accounts", { credentials: "include" });
      const data = (await res.json().catch(() => ({}))) as {
        accounts?: SocialAccount[];
        pending_lifted_account_ids?: string[];
        error?: string;
      };
      if (!res.ok) {
        setErr(data.error?.trim() || "Could not load accounts");
        setAccounts([]);
        setPendingLiftedAccountIds(new Set());
        return;
      }
      setAccounts(data.accounts ?? []);
      setPendingLiftedAccountIds(new Set(data.pending_lifted_account_ids ?? []));
    } catch {
      setErr("Network error");
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const reloadFunnels = React.useCallback(async () => {
    try {
      const res = await fetch("/api/va/marketing/funnels", { credentials: "include" });
      const data = (await res.json().catch(() => ({}))) as { funnels?: FunnelLink[] };
      if (res.ok) setFunnels(data.funnels ?? []);
    } catch {
      // read-only extra; ignore load failure
    }
  }, []);

  const reloadReports = React.useCallback(async () => {
    setReportsLoading(true);
    try {
      const res = await fetch("/api/va/marketing/reports", { credentials: "include" });
      const data = (await res.json().catch(() => ({}))) as { reports?: ShadowbanReport[] };
      if (res.ok) setMyReports(data.reports ?? []);
    } catch {
      // read-only history; ignore load failure
    } finally {
      setReportsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void reload();
    void reloadFunnels();
    void reloadReports();
  }, [reload, reloadFunnels, reloadReports]);

  useSupabaseRealtimeRefresh(
    ["model_social_accounts"],
    () => {
      void reload();
      void reloadFunnels();
      void reloadReports();
    },
    { debounceMs: 800 },
  );

  const grouped = React.useMemo(() => groupByModel(accounts), [accounts]);
  const activeCount = accounts.filter((a) => (a.account_status ?? "active") === "active").length;
  const issueCount = accounts.length - activeCount;
  const bannedCount = accounts.filter((a) => a.account_status === "banned").length;
  const shadowbanCount = accounts.filter((a) => a.account_status === "shadowbanned").length;

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-5xl space-y-6 px-4 pb-10 pt-6 md:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-[32px] font-semibold tracking-tight text-white">Marketing accounts</h1>
            <p className="mt-2 text-sm text-[#B8B4B8]/65">
              Social handles assigned to you across your creators
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShadowbanOpen(true)}
            className={cn(
              "inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition",
              "border-amber-500/35 bg-transparent text-amber-300/90",
              "shadow-[inset_0_1px_0_rgba(245,158,11,0.1)]",
              "hover:border-amber-500/50 hover:bg-amber-500/8",
              issueCount > 0 && bannedCount > 0
                ? "border-red-500/40 text-red-300/90 hover:border-red-500/55 hover:bg-red-500/8"
                : null,
            )}
          >
            <AlertTriangle className="h-4 w-4" aria-hidden />
            Report issue
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-2 rounded-full border border-[rgba(255,255,255,0.08)] bg-[#151315] px-3.5 py-1.5 text-sm text-[#B8B4B8]/75">
            Total
            <span className="rounded-full border border-[#D4AF8C]/30 bg-[#D4AF8C]/12 px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-[#D4AF8C]">
              {accounts.length}
            </span>
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/8 px-3.5 py-1.5 text-sm text-emerald-300/90">
            Active
            <span className="rounded-full border border-emerald-500/30 bg-emerald-500/12 px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-emerald-200">
              {activeCount}
            </span>
          </span>
          {shadowbanCount > 0 ? (
            <span
              className={cn(
                "relative inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/8 px-3.5 py-1.5 text-sm text-amber-300",
                VA_CARD_GLOW,
                "before:bg-[radial-gradient(ellipse_at_center,rgba(245,158,11,0.12)_0%,transparent_70%)] max-md:before:opacity-40",
              )}
            >
              Shadowbanned
              <span className="rounded-full border border-amber-500/30 bg-amber-500/12 px-1.5 py-0.5 text-[11px] font-bold tabular-nums">
                {shadowbanCount}
              </span>
            </span>
          ) : null}
          {bannedCount > 0 ? (
            <span
              className={cn(
                "relative inline-flex items-center gap-2 rounded-full border border-red-500/35 bg-red-500/10 px-3.5 py-1.5 text-sm text-red-300",
                VA_CARD_GLOW,
                "before:bg-[radial-gradient(ellipse_at_center,rgba(239,68,68,0.16)_0%,transparent_70%)] max-md:before:opacity-40",
              )}
            >
              Banned
              <span className="rounded-full border border-red-500/30 bg-red-500/12 px-1.5 py-0.5 text-[11px] font-bold tabular-nums">
                {bannedCount}
              </span>
            </span>
          ) : null}
        </div>

        {err ? (
          <div className="rounded-xl border border-rose-500/35 bg-rose-500/10 px-4 py-3 text-sm text-rose-200" role="alert">
            {err}
          </div>
        ) : null}

        {loading ? (
          <div className={cn(VA_CARD, "px-6 py-16 text-center text-sm text-[#B8B4B8]/40")}>
            Loading accounts…
          </div>
        ) : accounts.length === 0 ? (
          <MarketingEmptyState />
        ) : (
          <div className="space-y-5">
            {[...grouped.entries()].map(([modelId, group]) => (
              <CreatorPortfolio
                key={modelId}
                modelId={modelId}
                modelName={group.modelName}
                accounts={group.items}
                pendingLiftedAccountIds={pendingLiftedAccountIds}
                onReportLifted={setLiftedTarget}
              />
            ))}
          </div>
        )}

        <MyReportsSection reports={myReports} loading={reportsLoading} />

        <TrackingLinksSection funnels={funnels} />
      </div>

      <VAShadowbanReportModal
        open={shadowbanOpen}
        onClose={() => {
          setShadowbanOpen(false);
          void reload();
          void reloadReports();
        }}
        vaAccounts={accounts}
      />

      <VARestrictionLiftedModal
        open={!!liftedTarget}
        account={liftedTarget}
        onClose={() => {
          setLiftedTarget(null);
          void reload();
          void reloadReports();
        }}
        onSubmitted={() => {
          if (liftedTarget) {
            setPendingLiftedAccountIds((prev) => new Set([...prev, liftedTarget.account_id]));
          }
        }}
      />
    </div>
  );
}
