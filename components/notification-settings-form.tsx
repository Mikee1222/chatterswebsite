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
  Coins,
  Cpu,
  Fish,
  Layers,
  ListTodo,
  Megaphone,
  Moon,
  ShieldAlert,
  Sparkles,
  Trophy,
  UserRound,
  VolumeX,
  XCircle,
} from "lucide-react";
import { updateMyNotificationPreferences, resetMyNotificationPreferencesToRoleDefaults } from "@/app/actions/notification-preferences";
import { FormField } from "@/components/ui/form-field";
import { FormInput } from "@/components/ui/form-input";
import { FormSubmitButton } from "@/components/ui/form-submit-button";
import { ButtonSecondary } from "@/components/ui/form";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { NotificationPreference, UserRole } from "@/types";
import {
  notificationCategoryDefaultsEqual,
  preferenceCategoryFieldsFromPrefs,
  type NotificationRoleCategoryKey,
  type NotificationRoleDefaults,
} from "@/lib/notification-role-defaults";
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
  modified,
}: {
  name: string;
  label: string;
  description?: string;
  icon: React.ReactNode;
  checked: boolean;
  onChange: (v: boolean) => void;
  modified?: boolean;
}) {
  const switchId = `notif-switch-${name}`;
  return (
    <FormField label={label} icon={icon} description={description} htmlFor={switchId}>
      <div className="flex items-center justify-end gap-2">
        {modified ? (
          <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-200 ring-1 ring-amber-400/30">
            Modified
          </span>
        ) : null}
        <Switch id={switchId} checked={checked} onChange={onChange} />
      </div>
    </FormField>
  );
}

const CATEGORY_TOGGLES: Array<{
  key: NotificationRoleCategoryKey;
  name: string;
  label: string;
  group: string;
  icon: LucideIcon;
}> = [
  { key: "shift", name: "shift_alerts", label: "Shift alerts", group: "Operations", icon: CalendarClock },
  { key: "whale", name: "whale_alerts", label: "Whale alerts", group: "Operations", icon: Fish },
  { key: "model", name: "model_alerts", label: "Model alerts", group: "Operations", icon: UserRound },
  { key: "period", name: "period_alerts", label: "Period alerts", group: "Operations", icon: CalendarClock },
  { key: "task", name: "task_alerts", label: "Task alerts", group: "Team", icon: ListTodo },
  { key: "phase", name: "phase_alerts", label: "Phase alerts", group: "Team", icon: Layers },
  { key: "mistake", name: "mistake_alerts", label: "Mistake alerts", group: "Team", icon: ShieldAlert },
  { key: "marketing", name: "marketing_alerts", label: "Marketing alerts", group: "Team", icon: Megaphone },
  { key: "reward", name: "reward_alerts", label: "Reward alerts", group: "Performance", icon: Trophy },
  { key: "fine_bonus", name: "fine_bonus_alerts", label: "Fine/bonus alerts", group: "Performance", icon: Coins },
  { key: "system", name: "system_alerts", label: "System alerts", group: "Performance", icon: Cpu },
];

export function NotificationSettingsForm({
  prefs,
  userRole,
}: {
  prefs: NotificationPreference;
  userRole: UserRole | string;
}) {
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
  const [mistakeAlerts, setMistakeAlerts] = React.useState(prefs.mistake_alerts ?? true);
  const [fineBonusAlerts, setFineBonusAlerts] = React.useState(prefs.fine_bonus_alerts ?? true);
  const [periodAlerts, setPeriodAlerts] = React.useState(prefs.period_alerts ?? true);
  const [marketingAlerts, setMarketingAlerts] = React.useState(prefs.marketing_alerts ?? true);
  const [phaseAlerts, setPhaseAlerts] = React.useState(prefs.phase_alerts ?? true);
  const [rewardAlerts, setRewardAlerts] = React.useState(prefs.reward_alerts ?? true);
  const [muteAll, setMuteAll] = React.useState(prefs.mute_all);
  const [quietStart, setQuietStart] = React.useState(prefs.quiet_hours_start?.trim() ?? "");
  const [quietEnd, setQuietEnd] = React.useState(prefs.quiet_hours_end?.trim() ?? "");

  const [submitting, setSubmitting] = React.useState(false);
  const [resetting, setResetting] = React.useState(false);
  const [resetOpen, setResetOpen] = React.useState(false);
  const [roleDefaults, setRoleDefaults] = React.useState<NotificationRoleDefaults | null>(null);
  const [message, setMessage] = React.useState<{ type: "success" | "error"; text: string } | null>(null);
  const [savePulse, setSavePulse] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(
          `/api/notification-role-defaults?role=${encodeURIComponent(userRole)}`
        );
        if (!res.ok) return;
        const data = (await res.json()) as { defaults?: NotificationRoleDefaults };
        if (!cancelled && data.defaults) setRoleDefaults(data.defaults);
      } catch {
        /* ignore — form still works without role defaults */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userRole]);

  const currentCategories = React.useMemo(
    () =>
      preferenceCategoryFieldsFromPrefs({
        ...prefs,
        shift_alerts: shiftAlerts,
        whale_alerts: whaleAlerts,
        model_alerts: modelAlerts,
        system_alerts: systemAlerts,
        task_alerts: taskAlerts,
        mistake_alerts: mistakeAlerts,
        fine_bonus_alerts: fineBonusAlerts,
        period_alerts: periodAlerts,
        marketing_alerts: marketingAlerts,
        phase_alerts: phaseAlerts,
        reward_alerts: rewardAlerts,
      }),
    [
      prefs,
      shiftAlerts,
      whaleAlerts,
      modelAlerts,
      systemAlerts,
      taskAlerts,
      mistakeAlerts,
      fineBonusAlerts,
      periodAlerts,
      marketingAlerts,
      phaseAlerts,
      rewardAlerts,
    ]
  );

  const categoryModified = React.useCallback(
    (key: NotificationRoleCategoryKey) =>
      roleDefaults != null && currentCategories[key] !== roleDefaults[key],
    [roleDefaults, currentCategories]
  );

  const hasCategoryOverrides =
    roleDefaults != null && !notificationCategoryDefaultsEqual(currentCategories, roleDefaults);

  React.useEffect(() => {
    setPushEnabled(prefs.push_enabled);
    setInAppEnabled(prefs.in_app_enabled);
    setCriticalOnly(prefs.critical_only);
    setWhaleAlerts(prefs.whale_alerts);
    setShiftAlerts(prefs.shift_alerts);
    setModelAlerts(prefs.model_alerts);
    setSystemAlerts(prefs.system_alerts);
    setTaskAlerts(prefs.task_alerts);
    setMistakeAlerts(prefs.mistake_alerts ?? true);
    setFineBonusAlerts(prefs.fine_bonus_alerts ?? true);
    setPeriodAlerts(prefs.period_alerts ?? true);
    setMarketingAlerts(prefs.marketing_alerts ?? true);
    setPhaseAlerts(prefs.phase_alerts ?? true);
    setRewardAlerts(prefs.reward_alerts ?? true);
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
      if (mistakeAlerts) fd.set("mistake_alerts", "on");
      if (fineBonusAlerts) fd.set("fine_bonus_alerts", "on");
      if (periodAlerts) fd.set("period_alerts", "on");
      if (marketingAlerts) fd.set("marketing_alerts", "on");
      if (phaseAlerts) fd.set("phase_alerts", "on");
      if (rewardAlerts) fd.set("reward_alerts", "on");
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

  async function handleResetToRoleDefaults() {
    setMessage(null);
    setResetting(true);
    try {
      const res = await resetMyNotificationPreferencesToRoleDefaults();
      if (!res.ok) {
        setMessage({ type: "error", text: res.error });
        return;
      }
      if (roleDefaults) {
        setShiftAlerts(roleDefaults.shift);
        setWhaleAlerts(roleDefaults.whale);
        setModelAlerts(roleDefaults.model);
        setSystemAlerts(roleDefaults.system);
        setTaskAlerts(roleDefaults.task);
        setMistakeAlerts(roleDefaults.mistake);
        setFineBonusAlerts(roleDefaults.fine_bonus);
        setPeriodAlerts(roleDefaults.period);
        setMarketingAlerts(roleDefaults.marketing);
        setPhaseAlerts(roleDefaults.phase);
        setRewardAlerts(roleDefaults.reward);
      }
      setMessage({ type: "success", text: "Category preferences reset to your role defaults." });
      setResetOpen(false);
      router.refresh();
    } finally {
      setResetting(false);
    }
  }

  const categoryState: Record<
    NotificationRoleCategoryKey,
    { value: boolean; setter: (v: boolean) => void }
  > = {
    shift: { value: shiftAlerts, setter: setShiftAlerts },
    whale: { value: whaleAlerts, setter: setWhaleAlerts },
    model: { value: modelAlerts, setter: setModelAlerts },
    system: { value: systemAlerts, setter: setSystemAlerts },
    task: { value: taskAlerts, setter: setTaskAlerts },
    mistake: { value: mistakeAlerts, setter: setMistakeAlerts },
    fine_bonus: { value: fineBonusAlerts, setter: setFineBonusAlerts },
    period: { value: periodAlerts, setter: setPeriodAlerts },
    marketing: { value: marketingAlerts, setter: setMarketingAlerts },
    phase: { value: phaseAlerts, setter: setPhaseAlerts },
    reward: { value: rewardAlerts, setter: setRewardAlerts },
  };

  const categoryGroups = ["Operations", "Team", "Performance"] as const;

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
          {roleDefaults ? (
            <div className="mb-6 rounded-xl border border-sky-500/25 bg-sky-500/10 px-4 py-3 text-sm leading-relaxed text-sky-100/90">
              Your role (<span className="font-semibold text-white/90">{userRole.replace(/_/g, " ")}</span>)
              has default notification categories. Changes here are personal overrides and stay on your account.
            </div>
          ) : null}
          <div className="space-y-6">
            {categoryGroups.map((group) => (
              <div key={group} className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-pink-100/55">{group}</p>
                <div className="space-y-4">
                  {CATEGORY_TOGGLES.filter((item) => item.group === group).map((item) => {
                    const Icon = item.icon;
                    const state = categoryState[item.key];
                    return (
                      <NotificationToggleField
                        key={item.name}
                        name={item.name}
                        label={item.label}
                        icon={<Icon />}
                        checked={state.value}
                        onChange={state.setter}
                        modified={categoryModified(item.key)}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          {hasCategoryOverrides ? (
            <div className="mt-6 border-t border-white/[0.08] pt-5">
              <ButtonSecondary type="button" onClick={() => setResetOpen(true)} disabled={resetting}>
                Reset to role defaults
              </ButtonSecondary>
            </div>
          ) : null}
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

      <ConfirmDialog
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        title="Reset to role defaults?"
        description="This restores all category toggles to your role's defaults. Delivery settings (push, quiet hours, mute) are unchanged."
        confirmLabel="Reset categories"
        loading={resetting}
        onConfirm={handleResetToRoleDefaults}
      />

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
