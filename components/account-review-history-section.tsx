import Link from "next/link";
import { ROUTES } from "@/lib/routes";
import { VA_CARD, VA_STATUS_BADGE } from "@/lib/va-tasks-tokens";
import { cn } from "@/lib/utils";
import type { VaReviewHistorySummary } from "@/services/marketing-reviews";
import { SopFormSection } from "@/components/sop/sop-form-section";
import { SpotMistakeAiPatternsCard } from "@/components/spot-mistake-ai-patterns-card";

type Props = {
  history: VaReviewHistorySummary;
  vaId: string;
  vaName: string;
};

const STATUS_COLORS: Record<string, string> = {
  Pending: "border-amber-500/35 bg-amber-500/12 text-amber-300",
  Fixed: "border-emerald-500/35 bg-emerald-500/12 text-emerald-300",
  Escalated: "border-red-500/40 bg-red-500/15 text-red-300",
};

export function AccountReviewHistorySection({ history, vaId, vaName }: Props) {
  const typeEntries = Object.entries(history.spot_check_by_type);
  const statusEntries = Object.entries(history.spot_check_by_status);

  return (
    <SopFormSection
      title="Review history"
      description="Marketing manager reviews — last 30 days (read-only)"
      defaultOpen
    >
      <div className="space-y-4">
        <SpotMistakeAiPatternsCard subjectId={vaId} subjectName={vaName} subjectKind="va" />

        <div className={cn(VA_CARD, "p-4")}>
          <p className="text-sm text-white/80">
            <span className="text-2xl font-bold text-[#FFB3D9]">{history.spot_check_count_30d}</span>
            <span className="ml-2 text-[#B8B4B8]/60">spot checks (30 days)</span>
          </p>
          {typeEntries.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {typeEntries.map(([type, count]) => (
                <span key={type} className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs text-[#B8B4B8]/70">
                  {type}: {count}
                </span>
              ))}
            </div>
          ) : null}
          {statusEntries.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {statusEntries.map(([status, count]) => (
                <span key={status} className={cn(VA_STATUS_BADGE, STATUS_COLORS[status] ?? "border-white/15 text-white/60")}>
                  {status}: {count}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        {history.recent_exec_audits.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#D4AF8C]/70">Recent exec audits</p>
            {history.recent_exec_audits.map((audit) => {
              const passed = [
                audit.phase1_on_time,
                audit.phase2_on_time,
                audit.screenshots_authentic,
                audit.posting_compliance,
                audit.engagement_looks_real,
              ].filter(Boolean).length;
              return (
                <div key={audit.id} className="rounded-xl border border-white/8 bg-white/[0.02] px-3 py-2.5 text-sm">
                  <p className="font-medium text-white/90">{audit.audit_label}</p>
                  <p className="text-xs text-[#B8B4B8]/50">
                    {audit.reviewing_day || "—"} · {passed}/5 checks passed
                  </p>
                  {audit.issues_found ? (
                    <p className="mt-1 text-xs text-[#B8B4B8]/60 line-clamp-2">{audit.issues_found}</p>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-[#B8B4B8]/45">No exec audits on record.</p>
        )}

        <div className="flex flex-wrap gap-3 pt-1">
          <Link href={ROUTES.admin.spotChecks} className="text-sm text-[#FF1493]/80 hover:text-[#FFB3D9]">
            View spot checks →
          </Link>
          <Link href={ROUTES.admin.dailyReview} className="text-sm text-[#D4AF8C]/80 hover:text-[#D4AF8C]">
            View daily reviews →
          </Link>
        </div>
      </div>
    </SopFormSection>
  );
}
