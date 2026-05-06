"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import {
  Bell,
  BellOff,
  BellRing,
  CalendarClock,
  CheckCircle2,
  Clock,
  Cpu,
  Fish,
  ListTodo,
  Moon,
  ShieldAlert,
  Sparkles,
  UserRound,
  VolumeX,
  XCircle,
} from "lucide-react";
import { updateMyNotificationPreferences } from "@/app/actions/notification-preferences";
import { FormField } from "@/components/ui/form-field";
import { FormInput } from "@/components/ui/form-input";
import { FormSubmitButton } from "@/components/ui/form-submit-button";
import type { NotificationPreference } from "@/types";
import { cn } from "@/lib/utils";

function SettingsSection({
  icon: Icon,
  title,
  subtitle,
  children,
  className,
}: {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.section
      initial={reduceMotion ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduceMotion ? 0 : 0.25, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "overflow-hidden rounded-2xl border border-white/[0.1] bg-gradient-to-br from-white/[0.07] via-black/30 to-pink-950/[0.12]",
        "shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_20px_50px_-28px_hsl(330_80%_55%/0.15)]",
        className
      )}
    >
      <div className="border-b border-white/[0.08] bg-black/20 px-5 py-4 md:px-6 md:py-5">
        <div className="flex gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-pink-400/25 bg-pink-500/15 text-pink-200 shadow-[0_0_20px_-8px_hsl(330_80%_55%/0.35)]">
            <Icon className="h-5 w-5" aria-hidden />
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-semibold tracking-tight text-white md:text-lg">{title}</h3>
            {subtitle ? <p className="mt-1 text-sm leading-relaxed text-white/50">{subtitle}</p> : null}
          </div>
        </div>
      </div>
      <div className="px-5 py-4 md:px-6 md:py-5">{children}</div>
    </motion.section>
  );
}

function Switch({
  id,
  checked,
  onChange,
}: {
  id: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <button
      type="button"
      id={id}
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-11 w-[4.5rem] shrink-0 cursor-pointer rounded-full border-2 outline-none transition-[background-color,box-shadow,border-color,transform] duration-300 ease-out",
        "focus-visible:ring-2 focus-visible:ring-pink-500/55 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a]",
        "active:scale-[0.98]",
        checked
          ? "border-pink-300/45 bg-gradient-to-r from-pink-500 via-fuchsia-600 to-purple-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_0_32px_-6px_hsl(330_80%_55%/0.55)]"
          : "border-white/18 bg-[#262626] shadow-[inset_0_2px_8px_rgba(0,0,0,0.45)] hover:border-white/25"
      )}
    >
      <motion.span
        className={cn(
          "pointer-events-none absolute left-[5px] top-[5px] h-8 w-8 rounded-full shadow-[0_2px_10px_rgba(0,0,0,0.45)]",
          checked
            ? "bg-white ring-2 ring-pink-200/35"
            : "bg-gradient-to-b from-white to-white/88 ring-1 ring-black/30"
        )}
        initial={false}
        animate={{ x: checked ? 30 : 0 }}
        transition={
          reduceMotion
            ? { duration: 0.12, ease: "easeOut" }
            : { type: "spring", stiffness: 480, damping: 32, mass: 0.62 }
        }
      />
    </button>
  );
}

function NotificationToggleField({
  name,
  label,
  description,
  icon,
  checked,
  onChange,
}: {
  name: string;
  label: string;
  description?: string;
  icon: React.ReactNode;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  const switchId = `notif-switch-${name}`;
  return (
    <FormField label={label} icon={icon} description={description} htmlFor={switchId}>
      <div className="flex justify-end">
        <Switch id={switchId} checked={checked} onChange={onChange} />
      </div>
    </FormField>
  );
}

export function NotificationSettingsForm({ prefs }: { prefs: NotificationPreference }) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();

  const [pushEnabled, setPushEnabled] = React.useState(prefs.push_enabled);
  const [inAppEnabled, setInAppEnabled] = React.useState(prefs.in_app_enabled);
  const [criticalOnly, setCriticalOnly] = React.useState(prefs.critical_only);
  const [whaleAlerts, setWhaleAlerts] = React.useState(prefs.whale_alerts);
  const [shiftAlerts, setShiftAlerts] = React.useState(prefs.shift_alerts);
  const [modelAlerts, setModelAlerts] = React.useState(prefs.model_alerts);
  const [systemAlerts, setSystemAlerts] = React.useState(prefs.system_alerts);
  const [taskAlerts, setTaskAlerts] = React.useState(prefs.task_alerts);
  const [muteAll, setMuteAll] = React.useState(prefs.mute_all);
  const [quietStart, setQuietStart] = React.useState(prefs.quiet_hours_start?.trim() ?? "");
  const [quietEnd, setQuietEnd] = React.useState(prefs.quiet_hours_end?.trim() ?? "");

  const [submitting, setSubmitting] = React.useState(false);
  const [message, setMessage] = React.useState<{ type: "success" | "error"; text: string } | null>(null);
  const [savePulse, setSavePulse] = React.useState(false);

  React.useEffect(() => {
    setPushEnabled(prefs.push_enabled);
    setInAppEnabled(prefs.in_app_enabled);
    setCriticalOnly(prefs.critical_only);
    setWhaleAlerts(prefs.whale_alerts);
    setShiftAlerts(prefs.shift_alerts);
    setModelAlerts(prefs.model_alerts);
    setSystemAlerts(prefs.system_alerts);
    setTaskAlerts(prefs.task_alerts);
    setMuteAll(prefs.mute_all);
    setQuietStart(prefs.quiet_hours_start?.trim() ?? "");
    setQuietEnd(prefs.quiet_hours_end?.trim() ?? "");
  }, [prefs]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage(null);
    setSubmitting(true);
    try {
      const fd = new FormData();
      if (pushEnabled) fd.set("push_enabled", "on");
      if (inAppEnabled) fd.set("in_app_enabled", "on");
      if (criticalOnly) fd.set("critical_only", "on");
      if (whaleAlerts) fd.set("whale_alerts", "on");
      if (shiftAlerts) fd.set("shift_alerts", "on");
      if (modelAlerts) fd.set("model_alerts", "on");
      if (systemAlerts) fd.set("system_alerts", "on");
      if (taskAlerts) fd.set("task_alerts", "on");
      if (muteAll) fd.set("mute_all", "on");
      fd.set("quiet_hours_start", quietStart.trim());
      fd.set("quiet_hours_end", quietEnd.trim());

      const res = await updateMyNotificationPreferences(fd);
      if (!res.ok) {
        setMessage({ type: "error", text: res.error });
        return;
      }
      setMessage({ type: "success", text: "Preferences saved. You’re all set." });
      setSavePulse(true);
      router.refresh();
      window.setTimeout(() => setSavePulse(false), 900);
      window.setTimeout(() => setMessage((m) => (m?.type === "success" ? null : m)), 4200);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="notification-settings-page space-y-8 md:space-y-10">
        <SettingsSection
          icon={Bell}
          title="Delivery"
          subtitle="Control how alerts reach you — push, in-app, and priority."
        >
          <div className="space-y-4">
            <NotificationToggleField
              name="push_enabled"
              label="Push notifications"
              description="Browser or device push when something needs you."
              icon={pushEnabled ? <Bell /> : <BellOff />}
              checked={pushEnabled}
              onChange={setPushEnabled}
            />
            <NotificationToggleField
              name="in_app_enabled"
              label="In-app notifications"
              description="Bell feed and toasts inside the dashboard."
              icon={<BellRing />}
              checked={inAppEnabled}
              onChange={setInAppEnabled}
            />
            <NotificationToggleField
              name="critical_only"
              label="Critical only (push)"
              description="Push only for high-priority items; quieter day-to-day."
              icon={<ShieldAlert />}
              checked={criticalOnly}
              onChange={setCriticalOnly}
            />
          </div>
        </SettingsSection>

        <SettingsSection
          icon={Sparkles}
          title="Categories"
          subtitle="Fine-tune what kinds of updates you care about."
        >
          <div className="space-y-4">
            <NotificationToggleField
              name="whale_alerts"
              label="Whale alerts"
              icon={<Fish />}
              checked={whaleAlerts}
              onChange={setWhaleAlerts}
            />
            <NotificationToggleField
              name="shift_alerts"
              label="Shift alerts"
              icon={<CalendarClock />}
              checked={shiftAlerts}
              onChange={setShiftAlerts}
            />
            <NotificationToggleField
              name="model_alerts"
              label="Model alerts"
              icon={<UserRound />}
              checked={modelAlerts}
              onChange={setModelAlerts}
            />
            <NotificationToggleField
              name="system_alerts"
              label="System alerts"
              icon={<Cpu />}
              checked={systemAlerts}
              onChange={setSystemAlerts}
            />
            <NotificationToggleField
              name="task_alerts"
              label="Task alerts"
              icon={<ListTodo />}
              checked={taskAlerts}
              onChange={setTaskAlerts}
            />
          </div>
        </SettingsSection>

        <SettingsSection
          icon={Moon}
          title="Quiet hours"
          subtitle="No push during this window (e.g. 22:00 – 08:00). In-app may still show unless you mute categories."
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField
              label="Start"
              icon={<Clock />}
              htmlFor="quiet-hours-start"
              description="Beginning of your quiet period."
            >
              <FormInput
                id="quiet-hours-start"
                type="time"
                value={quietStart}
                onChange={(e) => setQuietStart(e.target.value)}
                className="settings-time-input tabular-nums text-base font-semibold md:text-lg"
              />
            </FormField>
            <FormField
              label="End"
              icon={<Clock />}
              htmlFor="quiet-hours-end"
              description="End time (can cross midnight depending on server rules)."
            >
              <FormInput
                id="quiet-hours-end"
                type="time"
                value={quietEnd}
                onChange={(e) => setQuietEnd(e.target.value)}
                className="settings-time-input tabular-nums text-base font-semibold md:text-lg"
              />
            </FormField>
          </div>
        </SettingsSection>

        <SettingsSection
          icon={VolumeX}
          title="Mute all"
          subtitle="Stops push and in-app notifications in one switch. Use when you’re fully offline."
        >
          <NotificationToggleField
            name="mute_all"
            label="Mute all notifications"
            icon={<VolumeX />}
            checked={muteAll}
            onChange={setMuteAll}
          />
        </SettingsSection>

        <div className="space-y-4">
          <AnimatePresence mode="wait">
            {message ? (
              <motion.div
                key={message.type + message.text}
                role="status"
                initial={{ opacity: 0, y: reduceMotion ? 0 : -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: reduceMotion ? 0 : -6 }}
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                className={cn(
                  "flex items-start gap-3 rounded-xl border px-4 py-3.5 text-sm leading-relaxed",
                  message.type === "success"
                    ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-100/95"
                    : "border-rose-500/40 bg-rose-500/10 text-rose-100/95"
                )}
              >
                {message.type === "success" ? (
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" aria-hidden />
                ) : (
                  <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-300" aria-hidden />
                )}
                <span>{message.text}</span>
              </motion.div>
            ) : null}
          </AnimatePresence>

          <motion.div
            animate={
              savePulse && !reduceMotion
                ? {
                    scale: [1, 1.02, 1],
                    boxShadow: [
                      "0 0 0 0 transparent",
                      "0 0 36px -8px hsl(330 80% 55% / 0.45)",
                      "0 0 0 0 transparent",
                    ],
                  }
                : false
            }
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          >
            <FormSubmitButton
              disabled={submitting}
              loading={submitting}
              aria-busy={submitting}
              className="w-full"
            >
              {submitting ? "Saving…" : "Save preferences"}
            </FormSubmitButton>
          </motion.div>
        </div>
      </form>

      <style jsx global>{`
        .notification-settings-page .settings-time-input {
          accent-color: rgb(236 72 153);
          color-scheme: dark;
        }
        .notification-settings-page .settings-time-input::-webkit-calendar-picker-indicator {
          filter: invert(0.85) sepia(1) saturate(5) hue-rotate(280deg) opacity(0.85);
          cursor: pointer;
        }
      `}</style>
    </>
  );
}
