"use client";

import * as React from "react";
import { ClipboardList, ExternalLink, Loader2 } from "lucide-react";
import { SpotCheckForm, type SpotCheckFormValues } from "@/components/spot-check-form";
import { useToast } from "@/contexts/toast-context";
import { formatDateTimeAthens } from "@/lib/format";
import {
  SPOT_CHECK_STATUS_STYLES,
  SPOT_CHECK_TYPE_STYLES,
} from "@/lib/marketing-reviews-helpers";
import { VA_CARD, VA_STATUS_BADGE } from "@/lib/va-tasks-tokens";
import { cn } from "@/lib/utils";
import type { MarketingSpotCheck } from "@/services/marketing-reviews";
import type { ModelRecord, UserRecord } from "@/types";

function localToast(id: string, title: string, body: string, priority: "normal" | "high") {
  return {
    id,
    notification_id: id,
    user_id: "local",
    category: "system" as const,
    event_type: "system_alert" as const,
    priority,
    title,
    body,
    entity_type: "system",
    entity_id: "",
    read_at: null,
    created_at: new Date().toISOString(),
  };
}

type Props = {
  initialSubmissions: MarketingSpotCheck[];
  vaUsers: UserRecord[];
  models: ModelRecord[];
};

export function SupervisorSpotChecksClient({ initialSubmissions, vaUsers, models }: Props) {
  const { addToast } = useToast();
  const [submissions, setSubmissions] = React.useState(initialSubmissions);
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  const marketingVas = React.useMemo(
    () =>
      vaUsers.filter(
        (u) => u.va_type === "marketing" || u.va_type === "both" || !u.va_type,
      ),
    [vaUsers],
  );

  async function reload() {
    setLoading(true);
    try {
      const res = await fetch("/api/spot-checks");
      const data = (await res.json()) as { spotChecks?: MarketingSpotCheck[] };
      if (res.ok) setSubmissions(data.spotChecks ?? []);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(values: SpotCheckFormValues) {
    setSaving(true);
    try {
      const va = marketingVas.find((v) => v.id === values.exec_va_id);
      const model = models.find((m) => m.id === values.creator_id);
      const res = await fetch("/api/spot-checks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: values.type,
          exec_va_id: values.exec_va_id,
          exec_va_name: va?.full_name ?? "",
          creator_id: values.creator_id,
          creator_name: model?.model_name ?? "",
          what_was_wrong: values.what_was_wrong,
          action_taken: values.action_taken,
          status: "Pending",
        }),
      });
      const data = (await res.json()) as { spotCheck?: MarketingSpotCheck; error?: string };
      if (!res.ok || !data.spotCheck) {
        addToast(localToast(`sc-err-${Date.now()}`, "Failed", data.error ?? "Could not submit finding", "high"));
        return false;
      }
      if (values.files.length > 0) {
        const fd = new FormData();
        for (const f of values.files) fd.append("attachments", f);
        await fetch(`/api/spot-checks/${data.spotCheck.id}/attachments`, {
          method: "POST",
          body: fd,
        });
      }
      await reload();
      addToast(localToast(`sc-ok-${Date.now()}`, "Submitted", "Your finding was logged successfully.", "normal"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#FF1493]/70">QA</p>
        <h1 className="mt-1 text-2xl font-bold text-white">Spot Checks</h1>
        <p className="mt-1 text-sm text-[#B8B4B8]/60">Log marketing QA findings for your team</p>
      </div>

      <section className={cn(VA_CARD, "p-4 md:p-5")}>
        <h2 className="text-base font-semibold text-white">Log a finding</h2>
        <p className="mt-1 text-sm text-[#B8B4B8]/50">New submissions start as Pending for admin review.</p>
        <div className="mt-4">
          <SpotCheckForm
            vaUsers={vaUsers}
            models={models}
            saving={saving}
            submitLabel="Submit finding"
            lockStatusToPending
            onSubmit={handleSubmit}
          />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-white">My submissions</h2>
        {loading ? (
          <div className={cn(VA_CARD, "flex items-center justify-center gap-2 py-12 text-[#B8B4B8]/50")}>
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
            Loading…
          </div>
        ) : submissions.length === 0 ? (
          <div className={cn(VA_CARD, "py-14 text-center")}>
            <ClipboardList className="mx-auto mb-3 h-10 w-10 text-[#D4AF8C]/35" aria-hidden />
            <p className="font-medium text-[#B8B4B8]/80">No submissions yet</p>
            <p className="mt-1 text-sm text-[#B8B4B8]/45">Your logged findings will appear here with their status.</p>
          </div>
        ) : (
          submissions.map((sc) => {
            const statusStyle = SPOT_CHECK_STATUS_STYLES[sc.status];
            const typeStyle = SPOT_CHECK_TYPE_STYLES[sc.type];
            return (
              <article key={sc.id} className={cn(VA_CARD, "p-4 md:p-5")}>
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      VA_STATUS_BADGE,
                      statusStyle.className,
                      statusStyle.glowClassName,
                    )}
                  >
                    {statusStyle.label}
                  </span>
                  <span className={cn("rounded-md border px-2 py-0.5 text-xs", typeStyle.className)}>
                    {sc.type}
                  </span>
                </div>
                <p className="mt-2 font-semibold text-white">{sc.subject || sc.what_was_wrong.slice(0, 80)}</p>
                <p className="mt-1 text-sm text-[#B8B4B8]/55">
                  {sc.exec_va_name || "—"} · {sc.creator_name || "—"}
                </p>
                {sc.what_was_wrong ? (
                  <p className="mt-3 text-sm text-[#B8B4B8]/70">{sc.what_was_wrong}</p>
                ) : null}
                {sc.action_taken ? (
                  <p className="mt-2 text-sm text-[#D4AF8C]/70">
                    <span className="text-[#B8B4B8]/45">Action: </span>
                    {sc.action_taken}
                  </p>
                ) : null}
                {sc.attachments.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {sc.attachments.map((a, i) => (
                      <a
                        key={i}
                        href={a.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2 py-1 text-xs text-[#D4AF8C] hover:bg-white/5"
                      >
                        <ExternalLink className="h-3 w-3" aria-hidden />
                        {a.filename ?? `Attachment ${i + 1}`}
                      </a>
                    ))}
                  </div>
                ) : null}
                <p className="mt-3 text-xs text-[#B8B4B8]/40">{formatDateTimeAthens(sc.timestamp)}</p>
              </article>
            );
          })
        )}
      </section>
    </div>
  );
}
