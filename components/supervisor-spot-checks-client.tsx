"use client";

import * as React from "react";
import { ClipboardList } from "lucide-react";
import {
  AttachmentLinks,
  DashPlaceholder,
  FindingCard,
  ReviewEmptyState,
  ReviewFormSection,
  ReviewLoadingState,
  ReviewPageEyebrow,
  ReviewSectionHeader,
  SpotCheckStatusBadge,
  SpotCheckTypeBadge,
  displayOrDash,
} from "@/components/manager-review-ui";
import { SpotCheckForm, type SpotCheckFormValues } from "@/components/spot-check-form";
import { staffDisplayName, type StaffUserOption } from "@/components/staff-assignee-picker";
import { useToast } from "@/contexts/toast-context";
import { useIsSupabaseBackend } from "@/contexts/data-backend-context";
import { uploadFilesToSupabaseStorage } from "@/lib/client-direct-storage-upload";
import { formatDateTimeAthens } from "@/lib/format";
import type { MarketingSpotCheck } from "@/services/marketing-reviews";
import type { ModelRecord } from "@/types";
import { useSupabaseRealtimeRefresh } from "@/lib/hooks/use-supabase-realtime";

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
  staffUsers: StaffUserOption[];
  roleLabels: Record<string, string>;
  models: ModelRecord[];
};

export function SupervisorSpotChecksClient({
  initialSubmissions,
  staffUsers,
  roleLabels,
  models,
}: Props) {
  const { addToast } = useToast();
  const isSupabase = useIsSupabaseBackend();
  const [submissions, setSubmissions] = React.useState(initialSubmissions);
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

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

  const reloadRef = React.useRef(reload);
  reloadRef.current = reload;
  useSupabaseRealtimeRefresh(
    ["marketing_spot_checks"],
    () => void reloadRef.current(),
    { debounceMs: 700 },
  );

  async function handleSubmit(values: SpotCheckFormValues) {
    setSaving(true);
    try {
      const member = staffUsers.find((v) => v.id === values.exec_va_id);
      const model = models.find((m) => m.id === values.creator_id);
      const res = await fetch("/api/spot-checks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: values.type,
          exec_va_id: values.exec_va_id,
          exec_va_name: member ? staffDisplayName(member) : "",
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
        if (isSupabase) {
          const uploaded = await uploadFilesToSupabaseStorage(values.files, "spot-check", {
            itemId: data.spotCheck.id,
          });
          for (const u of uploaded) fd.append("attachment_url", u.sbUrl);
        } else {
          for (const f of values.files) fd.append("attachments", f);
        }
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
        <ReviewPageEyebrow>QA</ReviewPageEyebrow>
        <h1 className="mt-1 text-2xl font-bold text-white">Spot Checks</h1>
        <p className="mt-1 text-sm text-[#B8B4B8]/60">Log marketing QA findings for your team</p>
      </div>

      <ReviewFormSection
        title="Log a finding"
        description="New submissions start as Pending for admin review."
      >
        <SpotCheckForm
          staffUsers={staffUsers}
          roleLabels={roleLabels}
          models={models}
          saving={saving}
          submitLabel="Submit finding"
          lockStatusToPending
          onSubmit={handleSubmit}
        />
      </ReviewFormSection>

      <section className="space-y-3">
        <ReviewSectionHeader>My submissions</ReviewSectionHeader>
        {loading ? (
          <ReviewLoadingState />
        ) : submissions.length === 0 ? (
          <ReviewEmptyState
            icon={ClipboardList}
            title="No submissions yet"
            description="Your logged findings will appear here with their status."
          />
        ) : (
          submissions.map((sc) => (
            <FindingCard key={sc.id}>
              <div className="flex flex-wrap items-center gap-2">
                <SpotCheckStatusBadge status={sc.status} />
                <SpotCheckTypeBadge type={sc.type} />
              </div>
              <p className="mt-2 font-semibold text-white">{sc.subject || sc.what_was_wrong.slice(0, 80)}</p>
              <p className="mt-1 text-sm text-[#B8B4B8]/55">
                {displayOrDash(sc.exec_va_name)} · {displayOrDash(sc.creator_name)}
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
                <div className="mt-3">
                  <AttachmentLinks attachments={sc.attachments} />
                </div>
              ) : null}
              <p className="mt-3 text-xs text-[#B8B4B8]/40">{formatDateTimeAthens(sc.timestamp)}</p>
            </FindingCard>
          ))
        )}
      </section>
    </div>
  );
}
