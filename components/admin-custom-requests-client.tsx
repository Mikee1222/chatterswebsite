"use client";

import * as React from "react";
import { useSWRConfig } from "swr";
import { useToast } from "@/contexts/toast-context";
import type { AppNotification, CustomRequest } from "@/types";
import {
  adminApproveCustomRequest,
  adminDeclineCustomRequest,
  adminEditCustomRequest,
  adminLoadMoreCustomRequests,
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

type Props = {
  initialRequests: CustomRequest[];
  initialNextOffset: string | null;
  initialHasMore: boolean;
};

export function AdminCustomRequestsClient({ initialRequests: initial, initialNextOffset, initialHasMore }: Props) {
  const { mutate } = useSWRConfig();
  const { addToast } = useToast();
  const [requests, setRequests] = React.useState<CustomRequest[]>(initial);
  const [nextOffset, setNextOffset] = React.useState<string | null>(initialNextOffset);
  const [hasMore, setHasMore] = React.useState(initialHasMore);
  const [loadingMore, setLoadingMore] = React.useState(false);

  React.useEffect(() => {
    setRequests(initial);
    setNextOffset(initialNextOffset);
    setHasMore(initialHasMore);
  }, [initial, initialNextOffset, initialHasMore]);

  const modelLabelById = React.useMemo(
    () =>
      Object.fromEntries(
        initial
          .filter((r) => r.assigned_model_id)
          .map((r) => [r.assigned_model_id, r.assigned_model_name || r.assigned_model_id])
      ),
    [requests]
  );

  const loadMore = React.useCallback(async () => {
    if (!nextOffset || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await adminLoadMoreCustomRequests(nextOffset);
      if (!res.ok) {
        addToast(localToast(`acr-more-err-${Date.now()}`, "Could not load more", res.error, "high"));
        return;
      }
      setRequests((prev) => {
        const seen = new Set(prev.map((r) => r.id));
        const appended = res.records.filter((r) => !seen.has(r.id));
        return [...prev, ...appended];
      });
      setNextOffset(res.nextOffset);
      setHasMore(res.hasMore);
    } finally {
      setLoadingMore(false);
    }
  }, [addToast, nextOffset, loadingMore]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <CustomRequestsBoard
      variant="admin"
      requests={requests}
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
      pagination={{
        hasMore,
        loadingMore,
        loadedCount: requests.length,
        onLoadMore: loadMore,
      }}
    />
    </div>
  );
}
