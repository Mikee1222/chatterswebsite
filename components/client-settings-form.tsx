"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Bell, BellRing, CalendarClock, CheckCircle2, Download, LogOut, Moon, UserRound } from "lucide-react";
import { logout } from "@/app/actions/auth";
import { updateMyNotificationPreferences } from "@/app/actions/notification-preferences";
import { runPushEnableFlow } from "@/components/push-permission-prompt";
import { usePwa } from "@/components/pwa-provider";
import { useToast } from "@/contexts/toast-context";
import { cn } from "@/lib/utils";
import type { AppNotification, NotificationPreference } from "@/types";

function localToast(id: string, title: string, body: string): AppNotification {
  return {
    id,
    notification_id: id,
    user_id: "local",
    category: "system",
    event_type: "system_alert",
    priority: "normal",
    title,
    body,
    entity_type: "system",
    entity_id: "",
    read_at: null,
    created_at: new Date().toISOString(),
  };
}

function SettingsSection({
  icon: Icon,
  title,
  subtitle,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="glass-card overflow-hidden border-white/[0.1]">
      <div className="border-b border-white/[0.08] bg-black/20 px-5 py-4">
        <div className="flex gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-pink-400/25 bg-pink-500/15 text-pink-200">
            <Icon className="h-5 w-5" aria-hidden />
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-white">{title}</h3>
            {subtitle ? <p className="mt-1 text-sm text-white/50">{subtitle}</p> : null}
          </div>
        </div>
      </div>
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}

function Switch({
  id,
  checked,
  onChange,
  disabled,
}: {
  id: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      id={id}
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-11 w-[4.5rem] shrink-0 rounded-full border-2 transition-colors duration-300",
        disabled && "cursor-not-allowed opacity-60",
        checked
          ? "border-pink-300/45 bg-gradient-to-r from-pink-500 via-fuchsia-600 to-purple-600"
          : "border-white/18 bg-[#262626]"
      )}
    >
      <span
        className={cn(
          "absolute left-[5px] top-[5px] h-8 w-8 rounded-full bg-white transition-transform duration-300",
          checked && "translate-x-[30px]"
        )}
      />
    </button>
  );
}

function PrefRow({
  id,
  label,
  description,
  checked,
  onChange,
  saving,
}: {
  id: string;
  label: string;
  description?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  saving?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0">
        <label htmlFor={id} className="block text-sm font-medium text-white">
          {label}
        </label>
        {description ? <p className="mt-0.5 text-xs text-white/45">{description}</p> : null}
      </div>
      <Switch id={id} checked={checked} onChange={onChange} disabled={saving} />
    </div>
  );
}

type ClientSettingsFormProps = {
  prefs: NotificationPreference;
  profile: {
    fullName: string;
    email: string;
    companyName: string;
  };
};

export function ClientSettingsForm({ prefs, profile }: ClientSettingsFormProps) {
  const router = useRouter();
  const { addToast } = useToast();
  const { canInstall, needsAddToHomeScreen, isStandalone, setInstallSheetOpen } = usePwa();
  const [saving, setSaving] = React.useState(false);
  const [pushEnabling, setPushEnabling] = React.useState(false);
  const [pushEnabled, setPushEnabled] = React.useState(prefs.push_enabled);
  const [paymentReminders, setPaymentReminders] = React.useState(prefs.billing_alerts);
  const [paymentStatus, setPaymentStatus] = React.useState(prefs.billing_alerts);
  const [newCycles, setNewCycles] = React.useState(prefs.billing_alerts);

  const savePrefs = async (updates: {
    push_enabled?: boolean;
    billing_alerts?: boolean;
  }) => {
    setSaving(true);
    const billingOn =
      updates.billing_alerts ??
      (paymentReminders && paymentStatus && newCycles);
    const fd = new FormData();
    fd.set("push_enabled", (updates.push_enabled ?? pushEnabled) ? "on" : "off");
    fd.set("in_app_enabled", prefs.in_app_enabled ? "on" : "off");
    fd.set("system_alerts", prefs.system_alerts ? "on" : "off");
    fd.set("task_alerts", prefs.task_alerts ? "on" : "off");
    fd.set("period_alerts", prefs.period_alerts ? "on" : "off");
    fd.set("billing_alerts", billingOn ? "on" : "off");
    fd.set("shift_alerts", prefs.shift_alerts ? "on" : "off");
    fd.set("model_alerts", prefs.model_alerts ? "on" : "off");
    fd.set("whale_alerts", prefs.whale_alerts ? "on" : "off");
    fd.set("mistake_alerts", prefs.mistake_alerts ? "on" : "off");
    fd.set("fine_bonus_alerts", prefs.fine_bonus_alerts ? "on" : "off");
    fd.set("marketing_alerts", prefs.marketing_alerts ? "on" : "off");
    fd.set("phase_alerts", prefs.phase_alerts ? "on" : "off");
    fd.set("reward_alerts", prefs.reward_alerts ? "on" : "off");
    fd.set("custom_request_alerts", prefs.custom_request_alerts ? "on" : "off");
    fd.set("training_alerts", prefs.training_alerts ? "on" : "off");
    fd.set("schedule_alerts", prefs.schedule_alerts ? "on" : "off");
    fd.set("critical_only", prefs.critical_only ? "on" : "off");
    fd.set("mute_all", prefs.mute_all ? "on" : "off");
    fd.set("quiet_hours_start", prefs.quiet_hours_start);
    fd.set("quiet_hours_end", prefs.quiet_hours_end);

    const res = await updateMyNotificationPreferences(fd);
    setSaving(false);
    if (res.ok) {
      router.refresh();
    } else {
      addToast(localToast("client-prefs-err", "Could not save", res.error));
    }
  };

  const handleEnablePush = async () => {
    setPushEnabling(true);
    const result = await runPushEnableFlow("client");
    setPushEnabling(false);
    if (result.status === "success") {
      setPushEnabled(true);
      await savePrefs({ push_enabled: true });
      addToast(localToast("client-push-settings", "Notifications enabled", "Push alerts are active for this device."));
    } else if (result.status === "error") {
      addToast(localToast("client-push-err", "Enable failed", result.message));
    }
  };

  return (
    <div className="space-y-6 pb-8">
      <SettingsSection icon={UserRound} title="Profile" subtitle="Your account details">
        <dl className="space-y-3 text-sm">
          <div>
            <dt className="text-xs uppercase tracking-wide text-white/45">Name</dt>
            <dd className="mt-1 font-medium text-white">{profile.fullName || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-white/45">Email</dt>
            <dd className="mt-1 font-medium text-white">{profile.email || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-white/45">Company</dt>
            <dd className="mt-1 font-medium text-white">{profile.companyName || "—"}</dd>
          </div>
        </dl>
      </SettingsSection>

      <SettingsSection icon={Bell} title="Notifications" subtitle="Control billing and payment alerts">
        <div className="divide-y divide-white/[0.06]">
          <PrefRow
            id="payment-reminders"
            label="Payment reminders"
            description="Due date and overdue billing alerts"
            checked={paymentReminders}
            saving={saving}
            onChange={(next) => {
              setPaymentReminders(next);
              void savePrefs({ billing_alerts: next && paymentStatus && newCycles });
            }}
          />
          <PrefRow
            id="payment-status"
            label="Approved / rejected"
            description="When your payment submission is reviewed"
            checked={paymentStatus}
            saving={saving}
            onChange={(next) => {
              setPaymentStatus(next);
              void savePrefs({ billing_alerts: paymentReminders && next && newCycles });
            }}
          />
          <PrefRow
            id="new-cycles"
            label="New billing cycles"
            description="When a new chatting or CRM cycle is announced"
            checked={newCycles}
            saving={saving}
            onChange={(next) => {
              setNewCycles(next);
              void savePrefs({ billing_alerts: paymentReminders && paymentStatus && next });
            }}
          />
        </div>
        <div className="mt-4 border-t border-white/[0.06] pt-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-white">Enable push on this device</p>
              <p className="text-xs text-white/45">Required for mobile push alerts</p>
            </div>
            <button
              type="button"
              onClick={() => void handleEnablePush()}
              disabled={pushEnabling || pushEnabled}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-pink-500/80 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-pink-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <BellRing className="h-4 w-4" />
              {pushEnabled ? "Push enabled" : pushEnabling ? "Enabling…" : "Enable push"}
            </button>
          </div>
          {pushEnabled ? (
            <p className="mt-2 flex items-center gap-2 text-xs text-emerald-400">
              <CheckCircle2 className="h-4 w-4" />
              Push notifications are enabled in your preferences
            </p>
          ) : null}
        </div>
      </SettingsSection>

      <SettingsSection icon={Download} title="App" subtitle="Install and appearance">
        <div className="space-y-4">
          {(canInstall || needsAddToHomeScreen) && !isStandalone ? (
            <button
              type="button"
              onClick={() => setInstallSheetOpen(true)}
              className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-left text-sm font-medium text-white transition hover:bg-white/10"
            >
              <Download className="h-5 w-5 text-pink-400" />
              Install app
            </button>
          ) : isStandalone ? (
            <p className="flex items-center gap-2 text-sm text-emerald-400">
              <CheckCircle2 className="h-4 w-4" />
              App installed
            </p>
          ) : null}
          <div className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
            <div className="flex items-center gap-3">
              <Moon className="h-5 w-5 text-pink-400" />
              <div>
                <p className="text-sm font-medium text-white">Theme</p>
                <p className="text-xs text-white/45">Dark mode only</p>
              </div>
            </div>
            <span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-white/60">
              Dark
            </span>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection icon={CalendarClock} title="Account">
        <form action={logout}>
          <button
            type="submit"
            className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-semibold text-red-400 transition hover:bg-red-500/10"
          >
            <LogOut className="h-5 w-5" />
            Log out
          </button>
        </form>
      </SettingsSection>
    </div>
  );
}
