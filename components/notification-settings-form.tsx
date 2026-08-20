"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import {
  Bell,
  BellOff,
  BellRing,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  Clock,
  Coins,
  Cpu,
  FileText,
  Fish,
  Layers,
  ListTodo,
  Megaphone,
  Moon,
  RotateCcw,
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
import type { NotificationEventOverrides, NotificationPreference, UserRole } from "@/types";
import {
  NOTIFICATION_CATEGORY_EVENTS,
  NOTIFICATION_CATEGORY_LABELS,
  categoryEventOverridesDifferFromRole,
  clearCategoryEventOverrides,
  eventOverridesFromRoleDefaults,
  getEventDefaultValue,
  getPersonalEventPreference,
  notificationCategoryDefaultsEqual,
  parseEventDescriptionFromEntry,
  parseEventKeyFromEntry,
  parseEventLabelFromEntry,
  preferenceCategoryFieldsFromPrefs,
  serializeEventOverrides,
  setEventOverrideRelativeToCategory,
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
  indeterminate,
  onChange,
  size = "default",
}: {
  id: string;
  checked: boolean;
  indeterminate?: boolean;
  onChange: (next: boolean) => void;
  size?: "default" | "small";
}) {
  const reduceMotion = useReducedMotion();
  const isSmall = size === "small";
  const trackClass = isSmall ? "h-8 w-[3.25rem]" : "h-11 w-[4.5rem]";
  const thumbClass = isSmall ? "h-[22px] w-[22px]" : "h-8 w-8";
  const thumbOffset = isSmall ? 22 : 30;
  const thumbLeft = isSmall ? "left-[3px] top-[3px]" : "left-[5px] top-[5px]";

  const ariaChecked: boolean | "mixed" = indeterminate ? "mixed" : checked;
  const visualOn = indeterminate ? true : checked;

  return (
    <button
      type="button"
      id={id}
      role="switch"
      aria-checked={ariaChecked}
      onClick={() => onChange(indeterminate ? true : !checked)}
      className={cn(
        "relative shrink-0 cursor-pointer rounded-full border-2 outline-none transition-[background-color,box-shadow,border-color,transform] duration-300 ease-out",
        trackClass,
        "focus-visible:ring-2 focus-visible:ring-pink-500/55 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a]",
        "active:scale-[0.98]",
        visualOn
          ? "border-pink-300/45 bg-gradient-to-r from-pink-500 via-fuchsia-600 to-purple-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_0_32px_-6px_hsl(330_80%_55%/0.55)]"
          : "border-white/18 bg-[#262626] shadow-[inset_0_2px_8px_rgba(0,0,0,0.45)] hover:border-white/25"
      )}
    >
      {indeterminate ? (
        <span
          className={cn(
            "pointer-events-none absolute inset-0 flex items-center justify-center",
            isSmall ? "px-2" : "px-3"
          )}
          aria-hidden
        >
          <span className="h-0.5 w-3.5 rounded-full bg-white/90 shadow-[0_1px_2px_rgba(0,0,0,0.35)]" />
        </span>
      ) : (
        <motion.span
          className={cn(
            "pointer-events-none absolute rounded-full shadow-[0_2px_10px_rgba(0,0,0,0.45)]",
            thumbClass,
            thumbLeft,
            checked
              ? "bg-white ring-2 ring-pink-200/35"
              : "bg-gradient-to-b from-white to-white/88 ring-1 ring-black/30"
          )}
          initial={false}
          animate={{ x: checked ? thumbOffset : 0 }}
          transition={
            reduceMotion
              ? { duration: 0.12, ease: "easeOut" }
              : { type: "spring", stiffness: 480, damping: 32, mass: 0.62 }
          }
        />
      )}
    </button>
  );
}

function NotificationToggleField({
  name,
  label,
  description,
  icon,
  checked,
  indeterminate,
  onChange,
  modified,
}: {
  name: string;
  label: string;
  description?: string;
  icon: React.ReactNode;
  checked: boolean;
  indeterminate?: boolean;
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
        <Switch id={switchId} checked={checked} indeterminate={indeterminate} onChange={onChange} />
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
  { key: "shift", name: "shift_alerts", label: NOTIFICATION_CATEGORY_LABELS.shift.en, group: "SHIFTS & WORK", icon: CalendarClock },
  { key: "task", name: "task_alerts", label: NOTIFICATION_CATEGORY_LABELS.task.en, group: "SHIFTS & WORK", icon: ListTodo },
  { key: "phase", name: "phase_alerts", label: NOTIFICATION_CATEGORY_LABELS.phase.en, group: "SHIFTS & WORK", icon: Layers },
  { key: "schedule_alerts", name: "schedule_alerts", label: NOTIFICATION_CATEGORY_LABELS.schedule_alerts.en, group: "SHIFTS & WORK", icon: CalendarClock },
  { key: "model", name: "model_alerts", label: NOTIFICATION_CATEGORY_LABELS.model.en, group: "MODELS & CONTENT", icon: UserRound },
  { key: "period", name: "period_alerts", label: NOTIFICATION_CATEGORY_LABELS.period.en, group: "MODELS & CONTENT", icon: CalendarClock },
  { key: "whale", name: "whale_alerts", label: NOTIFICATION_CATEGORY_LABELS.whale.en, group: "MODELS & CONTENT", icon: Fish },
  { key: "custom_request_alerts", name: "custom_request_alerts", label: NOTIFICATION_CATEGORY_LABELS.custom_request_alerts.en, group: "MODELS & CONTENT", icon: FileText },
  { key: "mistake", name: "mistake_alerts", label: NOTIFICATION_CATEGORY_LABELS.mistake.en, group: "PERFORMANCE", icon: ShieldAlert },
  { key: "fine_bonus", name: "fine_bonus_alerts", label: NOTIFICATION_CATEGORY_LABELS.fine_bonus.en, group: "PERFORMANCE", icon: Coins },
  { key: "reward", name: "reward_alerts", label: NOTIFICATION_CATEGORY_LABELS.reward.en, group: "PERFORMANCE", icon: Trophy },
  { key: "marketing", name: "marketing_alerts", label: NOTIFICATION_CATEGORY_LABELS.marketing.en, group: "PERFORMANCE", icon: Megaphone },
  { key: "billing_alerts", name: "billing_alerts", label: NOTIFICATION_CATEGORY_LABELS.billing_alerts.en, group: "FINANCE & ADMIN", icon: Coins },
  { key: "training_alerts", name: "training_alerts", label: NOTIFICATION_CATEGORY_LABELS.training_alerts.en, group: "FINANCE & ADMIN", icon: BookOpen },
  { key: "system", name: "system_alerts", label: NOTIFICATION_CATEGORY_LABELS.system.en, group: "FINANCE & ADMIN", icon: Cpu },
];

function getCategoryEventStates(
  categoryKey: NotificationRoleCategoryKey,
  categoryEnabled: boolean,
  eventOverrides: NotificationEventOverrides
): boolean[] {
  return NOTIFICATION_CATEGORY_EVENTS[categoryKey].map((entry) =>
    getPersonalEventPreference(eventOverrides, parseEventKeyFromEntry(entry), categoryEnabled)
  );
}

function getCategorySwitchState(
  categoryKey: NotificationRoleCategoryKey,
  categoryEnabled: boolean,
  eventOverrides: NotificationEventOverrides
): { checked: boolean; indeterminate: boolean } {
  const states = getCategoryEventStates(categoryKey, categoryEnabled, eventOverrides);
  if (states.length === 0) {
    return { checked: categoryEnabled, indeterminate: false };
  }
  const allOn = states.every((s) => s);
  const allOff = states.every((s) => !s);
  if (allOn) return { checked: true, indeterminate: false };
  if (allOff) return { checked: false, indeterminate: false };
  return { checked: false, indeterminate: true };
}

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
  const [customRequestAlerts, setCustomRequestAlerts] = React.useState(prefs.custom_request_alerts ?? true);
  const [billingAlerts, setBillingAlerts] = React.useState(prefs.billing_alerts ?? true);
  const [trainingAlerts, setTrainingAlerts] = React.useState(prefs.training_alerts ?? true);
  const [scheduleAlerts, setScheduleAlerts] = React.useState(prefs.schedule_alerts ?? true);
  const [eventOverrides, setEventOverrides] = React.useState<NotificationEventOverrides>(
    prefs.event_overrides ?? {}
  );
  const [muteAll, setMuteAll] = React.useState(prefs.mute_all);
  const [quietStart, setQuietStart] = React.useState(prefs.quiet_hours_start?.trim() ?? "");
  const [quietEnd, setQuietEnd] = React.useState(prefs.quiet_hours_end?.trim() ?? "");
  const [expandedCategories, setExpandedCategories] = React.useState<Partial<Record<NotificationRoleCategoryKey, boolean>>>({});

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

  const currentPrefsSnapshot = React.useMemo(
    (): NotificationPreference => ({
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
      custom_request_alerts: customRequestAlerts,
      billing_alerts: billingAlerts,
      training_alerts: trainingAlerts,
      schedule_alerts: scheduleAlerts,
      event_overrides: eventOverrides,
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
      customRequestAlerts,
      billingAlerts,
      trainingAlerts,
      scheduleAlerts,
      eventOverrides,
    ]
  );

  const currentCategories = React.useMemo(
    () => preferenceCategoryFieldsFromPrefs(currentPrefsSnapshot),
    [currentPrefsSnapshot]
  );

  const categoryModified = React.useCallback(
    (key: NotificationRoleCategoryKey) => {
      if (roleDefaults == null) return false;
      if (currentCategories[key] !== roleDefaults[key]) return true;
      return categoryEventOverridesDifferFromRole(currentPrefsSnapshot, roleDefaults, key);
    },
    [roleDefaults, currentCategories, currentPrefsSnapshot]
  );

  const hasCategoryOverrides = React.useMemo(() => {
    if (roleDefaults == null) return false;
    if (!notificationCategoryDefaultsEqual(currentCategories, roleDefaults)) return true;
    return CATEGORY_TOGGLES.some(({ key }) =>
      categoryEventOverridesDifferFromRole(currentPrefsSnapshot, roleDefaults, key)
    );
  }, [roleDefaults, currentCategories, currentPrefsSnapshot]);

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
    setCustomRequestAlerts(prefs.custom_request_alerts ?? true);
    setBillingAlerts(prefs.billing_alerts ?? true);
    setTrainingAlerts(prefs.training_alerts ?? true);
    setScheduleAlerts(prefs.schedule_alerts ?? true);
    setEventOverrides(prefs.event_overrides ?? {});
    setMuteAll(prefs.mute_all);
    setQuietStart(prefs.quiet_hours_start?.trim() ?? "");
    setQuietEnd(prefs.quiet_hours_end?.trim() ?? "");
  }, [prefs]);

  function toggleCategoryExpanded(key: NotificationRoleCategoryKey) {
    setExpandedCategories((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function handleCategoryToggle(key: NotificationRoleCategoryKey, next: boolean) {
    const state = categoryState[key];
    state.setter(next);
    setEventOverrides((prev) => clearCategoryEventOverrides(prev, key));
  }

  function handleEventToggle(
    categoryKey: NotificationRoleCategoryKey,
    eventKey: string,
    enabled: boolean
  ) {
    const categoryEnabled = categoryState[categoryKey].value;

    if (enabled && !categoryEnabled) {
      categoryState[categoryKey].setter(true);
      setEventOverrides((prev) => {
        const next = { ...prev };
        for (const entry of NOTIFICATION_CATEGORY_EVENTS[categoryKey]) {
          const key = parseEventKeyFromEntry(entry);
          if (key === eventKey) {
            delete next[key];
          } else {
            next[key] = false;
          }
        }
        return next;
      });
      return;
    }

    setEventOverrides((prev) =>
      setEventOverrideRelativeToCategory(prev, eventKey, enabled, categoryEnabled)
    );
  }

  function resetCategoryToRoleDefaults(categoryKey: NotificationRoleCategoryKey) {
    if (!roleDefaults) return;
    categoryState[categoryKey].setter(roleDefaults[categoryKey]);
    const roleOverrides = eventOverridesFromRoleDefaults(roleDefaults);
    setEventOverrides((prev) => {
      let next = clearCategoryEventOverrides(prev, categoryKey);
      for (const entry of NOTIFICATION_CATEGORY_EVENTS[categoryKey]) {
        const eventKey = parseEventKeyFromEntry(entry);
        if (typeof roleOverrides[eventKey] === "boolean") {
          next[eventKey] = roleOverrides[eventKey]!;
        }
      }
      return next;
    });
  }

  function resetEventToRoleDefault(categoryKey: NotificationRoleCategoryKey, eventKey: string) {
    if (!roleDefaults) return;
    const roleVal = getEventDefaultValue(roleDefaults, categoryKey, eventKey);
    const categoryEnabled = categoryState[categoryKey].value;
    setEventOverrides((prev) =>
      setEventOverrideRelativeToCategory(prev, eventKey, roleVal, categoryEnabled)
    );
  }

  function eventDiffersFromRoleDefault(categoryKey: NotificationRoleCategoryKey, eventKey: string): boolean {
    if (!roleDefaults) return false;
    const categoryEnabled = categoryState[categoryKey].value;
    const personal = getPersonalEventPreference(eventOverrides, eventKey, categoryEnabled);
    const roleVal = getEventDefaultValue(roleDefaults, categoryKey, eventKey);
    return personal !== roleVal;
  }

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
      if (customRequestAlerts) fd.set("custom_request_alerts", "on");
      if (billingAlerts) fd.set("billing_alerts", "on");
      if (trainingAlerts) fd.set("training_alerts", "on");
      if (scheduleAlerts) fd.set("schedule_alerts", "on");
      if (muteAll) fd.set("mute_all", "on");
      fd.set("quiet_hours_start", quietStart.trim());
      fd.set("quiet_hours_end", quietEnd.trim());
      fd.set("event_overrides", serializeEventOverrides(eventOverrides));

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
        setCustomRequestAlerts(roleDefaults.custom_request_alerts);
        setBillingAlerts(roleDefaults.billing_alerts);
        setTrainingAlerts(roleDefaults.training_alerts);
        setScheduleAlerts(roleDefaults.schedule_alerts);
        setEventOverrides(eventOverridesFromRoleDefaults(roleDefaults));
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
    custom_request_alerts: { value: customRequestAlerts, setter: setCustomRequestAlerts },
    billing_alerts: { value: billingAlerts, setter: setBillingAlerts },
    training_alerts: { value: trainingAlerts, setter: setTrainingAlerts },
    schedule_alerts: { value: scheduleAlerts, setter: setScheduleAlerts },
  };

  const categoryGroups = ["SHIFTS & WORK", "MODELS & CONTENT", "PERFORMANCE", "FINANCE & ADMIN"] as const;

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
          subtitle="Fine-tune what kinds of updates you care about — expand a category for per-event control."
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
                <div className="space-y-3">
                  {CATEGORY_TOGGLES.filter((item) => item.group === group).map((item) => {
                    const Icon = item.icon;
                    const state = categoryState[item.key];
                    const categoryExpanded = expandedCategories[item.key] ?? false;
                    const switchState = getCategorySwitchState(item.key, state.value, eventOverrides);
                    const categoryEvents = NOTIFICATION_CATEGORY_EVENTS[item.key];
                    const switchId = `notif-switch-${item.name}`;

                    return (
                      <div
                        key={item.name}
                        className="overflow-hidden rounded-xl border border-white/[0.08] bg-black/15"
                      >
                        <div className="flex items-start gap-3 px-4 py-3.5 md:px-5">
                          <button
                            type="button"
                            onClick={() => toggleCategoryExpanded(item.key)}
                            className="mt-0.5 flex min-w-0 flex-1 items-start gap-2 rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-pink-500/45 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a]"
                            aria-expanded={categoryExpanded}
                          >
                            <ChevronDown
                              className={cn(
                                "mt-1 h-4 w-4 shrink-0 text-white/40 transition-transform duration-200",
                                categoryExpanded && "rotate-180"
                              )}
                              aria-hidden
                            />
                            <span className="min-w-0 flex-1">
                              <span className="flex flex-wrap items-center gap-2">
                                <Icon className="h-4 w-4 shrink-0 text-pink-200/70" aria-hidden />
                                <span className="text-sm font-semibold text-white md:text-base">{item.label}</span>
                                {categoryModified(item.key) ? (
                                  <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-200 ring-1 ring-amber-400/30">
                                    Modified
                                  </span>
                                ) : null}
                              </span>
                              <span className="mt-0.5 block text-xs leading-relaxed text-white/45">
                                {categoryEvents.length} event{categoryEvents.length === 1 ? "" : "s"} — tap to{" "}
                                {categoryExpanded ? "collapse" : "expand"}
                              </span>
                            </span>
                          </button>
                          <Switch
                            id={switchId}
                            checked={switchState.checked}
                            indeterminate={switchState.indeterminate}
                            onChange={(next) => handleCategoryToggle(item.key, next)}
                          />
                        </div>

                        <AnimatePresence initial={false}>
                          {categoryExpanded ? (
                            <motion.div
                              key={`${item.key}-events`}
                              initial={reduceMotion ? false : { height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={reduceMotion ? undefined : { height: 0, opacity: 0 }}
                              transition={{ duration: reduceMotion ? 0 : 0.22, ease: [0.22, 1, 0.36, 1] }}
                              className="overflow-hidden"
                            >
                              <div className="border-t border-white/[0.06] bg-black/10 px-4 py-3 md:px-5">
                                {categoryModified(item.key) && roleDefaults ? (
                                  <div className="mb-3 flex justify-end">
                                    <button
                                      type="button"
                                      onClick={() => resetCategoryToRoleDefaults(item.key)}
                                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-200/90 transition hover:text-sky-100"
                                    >
                                      <RotateCcw className="h-3 w-3" aria-hidden />
                                      Reset category to role defaults
                                    </button>
                                  </div>
                                ) : null}
                                <ul className="space-y-3 border-l border-white/10 pl-4">
                                  {categoryEvents.map((entry) => {
                                    const eventKey = parseEventKeyFromEntry(entry);
                                    const eventLabel = parseEventLabelFromEntry(entry);
                                    const eventDescription = parseEventDescriptionFromEntry(entry);
                                    const eventChecked = getPersonalEventPreference(
                                      eventOverrides,
                                      eventKey,
                                      state.value
                                    );
                                    const eventSwitchId = `notif-event-${item.name}-${eventKey}`;
                                    const eventModified = eventDiffersFromRoleDefault(item.key, eventKey);

                                    return (
                                      <li
                                        key={eventKey}
                                        className="flex items-start justify-between gap-3 py-1"
                                      >
                                        <label
                                          htmlFor={eventSwitchId}
                                          className="min-w-0 flex-1 cursor-pointer"
                                        >
                                          <p className="text-sm font-medium text-white/85">{eventLabel}</p>
                                          {eventDescription ? (
                                            <p className="mt-0.5 text-xs leading-relaxed text-white/45">
                                              {eventDescription}
                                            </p>
                                          ) : null}
                                          {eventModified && roleDefaults ? (
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.preventDefault();
                                                resetEventToRoleDefault(item.key, eventKey);
                                              }}
                                              className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-sky-200/80 transition hover:text-sky-100"
                                            >
                                              <RotateCcw className="h-3 w-3" aria-hidden />
                                              Reset
                                            </button>
                                          ) : null}
                                        </label>
                                        <Switch
                                          id={eventSwitchId}
                                          checked={eventChecked}
                                          onChange={(next) => handleEventToggle(item.key, eventKey, next)}
                                          size="small"
                                        />
                                      </li>
                                    );
                                  })}
                                </ul>
                              </div>
                            </motion.div>
                          ) : null}
                        </AnimatePresence>
                      </div>
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
        description="This restores all category toggles and per-event overrides to your role's defaults. Delivery settings (push, quiet hours, mute) are unchanged."
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
