"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Label } from "@/components/ui/form";
import { useToast } from "@/contexts/toast-context";
import { setModelPeriodTrackingEnabledAction } from "@/app/actions/modelss";
import type { AppNotification } from "@/types";

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
  modelId: string;
  /** From `modelss.period_tracking_enabled` (checkbox). */
  enabled: boolean;
};

export function AdminModelPeriodTrackingToggle({ modelId, enabled }: Props) {
  const router = useRouter();
  const { addToast } = useToast();
  const [value, setValue] = React.useState(enabled);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => setValue(enabled), [enabled]);

  const toggle = async () => {
    const next = !value;
    setBusy(true);
    setValue(next);
    const res = await setModelPeriodTrackingEnabledAction(modelId, next);
    if (!res.success) {
      setValue(!next);
      addToast(localToast(`pt-${Date.now()}`, "Could not update", res.error, "high"));
    } else {
      addToast(localToast(`pt-ok-${Date.now()}`, "Saved", "Period tracking setting updated.", "normal"));
      router.refresh();
    }
    setBusy(false);
  };

  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3">
      <div className="min-w-0">
        <Label className="text-sm font-medium text-white/90">Enable period tracking</Label>
        <p className="mt-0.5 text-xs text-white/50">
          Persists to Airtable <code className="text-white/70">modelss.period_tracking_enabled</code> (checkbox).
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        disabled={busy}
        onClick={() => void toggle()}
        className={`relative h-8 w-14 shrink-0 rounded-full transition-colors ${value ? "bg-emerald-500/45" : "bg-white/15"}`}
      >
        <span
          className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all ${value ? "left-7" : "left-1"}`}
        />
      </button>
    </div>
  );
}
