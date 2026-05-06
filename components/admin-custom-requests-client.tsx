"use client";

import * as React from "react";
import { useSWRConfig } from "swr";
import { useToast } from "@/contexts/toast-context";
import type { AppNotification, CustomRequest } from "@/types";
import {
  adminApproveCustomRequest,
  adminDeclineCustomRequest,
  adminEditCustomRequest,
} from "@/app/actions/admin-custom-requests";
import { dashboardSwrKeys } from "@/lib/hooks/use-dashboard-data";
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

type Props = { requests: CustomRequest[] };

export function AdminCustomRequestsClient({ requests: initial }: Props) {
  const { mutate } = useSWRConfig();
  const { addToast } = useToast();
  const modelLabelById = React.useMemo(
    () =>
      Object.fromEntries(
        initial
          .filter((r) => r.assigned_model_id)
          .map((r) => [r.assigned_model_id, r.assigned_model_name || r.assigned_model_id])
      ),
    [initial]
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <CustomRequestsBoard
      variant="admin"
      requests={initial}
      modelLabelById={modelLabelById}
      canAssignModel={false}
      assignModelDisabledReason="Bulk model assignment route is not implemented yet."
      onApprove={async (id) => {
        const res = await adminApproveCustomRequest(id);
        if (res.ok) await mutate(dashboardSwrKeys.notificationsUnreadCount);
        return res;
      }}
      onDecline={async (input) => {
        const res = await adminDeclineCustomRequest({ recordId: input.id, decline_reason: input.decline_reason });
        if (res.ok) await mutate(dashboardSwrKeys.notificationsUnreadCount);
        return res;
      }}
      onEdit={async (input) => {
        const res = await adminEditCustomRequest({
          recordId: input.id,
          request_details: input.request_details,
          price: input.price,
          deadline_requested: input.deadline_requested,
        });
        if (res.ok) await mutate(dashboardSwrKeys.notificationsUnreadCount);
        return res;
      }}
      onToast={(kind, title, body) =>
        addToast(localToast(`acr-${kind}-${Date.now()}`, title, body, kind === "error" ? "high" : "normal"))
      }
    />
    </div>
  );
}
