"use client";

import { useToast } from "@/contexts/toast-context";
import { useSWRConfig } from "swr";
import { dashboardSwrKeys } from "@/lib/hooks/use-dashboard-data";
import type { AppNotification, CustomRequest } from "@/types";
import { CustomRequestsBoard } from "@/components/custom-requests-board";

function localToast(id: string, title: string, body: string, priority: "normal" | "high"): AppNotification {
  return {
    id,
    notification_id: id,
    user_id: "local",
    category: "system",
    event_type: "system_alert",
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
  initialRows: CustomRequest[];
  pendingCount: number;
  assignedModelIds: string[];
  modelLabelById: Record<string, string>;
};

export function VaCustomRequestsClient({ initialRows, modelLabelById, pendingCount }: Props) {
  const { addToast } = useToast();
  const { mutate } = useSWRConfig();

  const approve = async (id: string) => {
    const res = await fetch("/api/va/custom/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ request_id: id }),
      credentials: "include",
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) return { ok: false as const, error: data.error ?? res.statusText };
    await mutate(dashboardSwrKeys.notificationsUnreadCount);
    return { ok: true as const };
  };

  const decline = async (input: { id: string; decline_reason: string }) => {
    const res = await fetch("/api/va/custom/decline", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ request_id: input.id, decline_reason: input.decline_reason }),
      credentials: "include",
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) return { ok: false as const, error: data.error ?? res.statusText };
    await mutate(dashboardSwrKeys.notificationsUnreadCount);
    return { ok: true as const };
  };

  const edit = async (input: { id: string; request_details: string; price: string; deadline_requested: string | null }) => {
    const res = await fetch("/api/va/custom/edit", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        request_id: input.id,
        request_details: input.request_details,
        price: input.price,
        deadline_requested: input.deadline_requested,
      }),
      credentials: "include",
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) return { ok: false as const, error: data.error ?? res.statusText };
    await mutate(dashboardSwrKeys.notificationsUnreadCount);
    return { ok: true as const };
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <CustomRequestsBoard
      variant="va"
      hubTitle="Custom requests"
      hubSubtitle="Agency-wide list: review pending items, edit details, and keep models unblocked — same board as admin, with your VA actions."
      agencyWidePendingCount={pendingCount}
      requests={initialRows}
      modelLabelById={modelLabelById}
      canAssignModel={false}
      assignModelDisabledReason="Bulk model assignment route is not implemented yet."
      onApprove={approve}
      onDecline={decline}
      onEdit={edit}
      onToast={(kind, title, body) =>
        addToast(localToast(`vcr-${kind}-${Date.now()}`, title, body, kind === "error" ? "high" : "normal"))
      }
    />
    </div>
  );
}
