"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { updateMyNotificationPreferences } from "@/app/actions/notification-preferences";
import { Input, SubmitButton } from "@/components/ui/form";
import type { NotificationPreference } from "@/types";

export function NotificationSettingsForm({ prefs }: { prefs: NotificationPreference }) {
  const router = useRouter();
  const [submitting, setSubmitting] = React.useState(false);
  const submittedRef = React.useRef(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting || submittedRef.current) return;
    submittedRef.current = true;
    setSubmitting(true);
    try {
      const form = e.currentTarget;
      const formData = new FormData(form);
      await updateMyNotificationPreferences(formData);
      router.refresh();
    } finally {
      setSubmitting(false);
      submittedRef.current = false;
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="glass-card rounded-2xl border border-white/10 p-6">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-white/60">Delivery</h3>
        <div className="space-y-4">
          <ToggleRow name="push_enabled" label="Push notifications" checked={prefs.push_enabled} />
          <ToggleRow name="in_app_enabled" label="In-app notifications" checked={prefs.in_app_enabled} />
          <ToggleRow name="critical_only" label="Critical only (push)" checked={prefs.critical_only} />
        </div>
      </div>

      <div className="glass-card rounded-2xl border border-white/10 p-6">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-white/60">Categories</h3>
        <div className="space-y-4">
          <ToggleRow name="whale_alerts" label="Whale alerts" checked={prefs.whale_alerts} />
          <ToggleRow name="shift_alerts" label="Shift alerts" checked={prefs.shift_alerts} />
          <ToggleRow name="model_alerts" label="Model alerts" checked={prefs.model_alerts} />
          <ToggleRow name="system_alerts" label="System alerts" checked={prefs.system_alerts} />
          <ToggleRow name="task_alerts" label="Task alerts" checked={prefs.task_alerts} />
        </div>
      </div>

      <div className="glass-card rounded-2xl border border-white/10 p-6">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-white/60">Quiet hours</h3>
        <p className="mb-4 text-sm text-white/50">No push during this time range (e.g. 22:00 – 08:00).</p>
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-white/80">
            <span>Start</span>
            <Input
              type="time"
              name="quiet_hours_start"
              defaultValue={prefs.quiet_hours_start || undefined}
              className="min-w-0"
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-white/80">
            <span>End</span>
            <Input
              type="time"
              name="quiet_hours_end"
              defaultValue={prefs.quiet_hours_end || undefined}
              className="min-w-0"
            />
          </label>
        </div>
      </div>

      <div className="glass-card rounded-2xl border border-white/10 p-6">
        <ToggleRow name="mute_all" label="Mute all notifications" checked={prefs.mute_all} />
      </div>

      <SubmitButton disabled={submitting}>{submitting ? "Saving…" : "Save preferences"}</SubmitButton>
    </form>
  );
}

function ToggleRow({
  name,
  label,
  checked,
}: {
  name: string;
  label: string;
  checked: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4">
      <span className="text-white/90">{label}</span>
      <input
        type="checkbox"
        name={name}
        defaultChecked={checked}
        value="on"
        className="h-6 w-11 shrink-0 rounded-full border border-white/20 bg-white/10 accent-[hsl(330,80%,55%)] transition-colors checked:bg-[hsl(330,80%,55%)]"
      />
    </label>
  );
}
