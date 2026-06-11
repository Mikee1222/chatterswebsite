"use client";

import * as React from "react";
import {
  ArrowRight,
  ChevronDown,
  Clock,
  Flame,
  Loader2,
  RotateCw,
  Star,
  Trophy,
  Zap,
} from "lucide-react";
import { useToast } from "@/contexts/toast-context";
import { saveRewardsConfigAction } from "@/app/actions/rewards-config";
import type { PointsConfig } from "@/services/points-config";
import type { AppNotification } from "@/types";
import { cn } from "@/lib/utils";
import { RewardsDebugTools } from "@/components/rewards-debug-tools";
import { AdminSpinWheelPrizesSection } from "@/components/admin-spin-wheel-prizes";
import type { SpinPrizeRow } from "@/services/spin-wheel";

const cardClass = cn(
  "rounded-xl border border-white/[0.08] bg-zinc-950/80 p-5",
  "shadow-[0_4px_24px_-8px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.04)]"
);

const pinkButtonClass =
  "inline-flex min-h-[40px] items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[hsl(330,75%,52%)] to-[hsl(280,55%,48%)] px-5 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50";

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

function configsEqual(a: PointsConfig, b: PointsConfig): boolean {
  return (Object.keys(a) as (keyof PointsConfig)[]).every((k) => a[k] === b[k]);
}

function ConfigRow({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description: string;
  value: number;
  onChange: (n: number) => void;
}) {
  const negative = value < 0;
  return (
    <div className="flex items-start justify-between gap-4 border-b border-white/[0.06] py-3.5 last:border-0">
      <div className="min-w-0 flex-1">
        <p className="text-sm text-white/90">{label}</p>
        <p className="mt-0.5 text-xs text-white/45">{description}</p>
      </div>
      <input
        type="number"
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => {
          const v = e.target.value === "" ? 0 : Number(e.target.value);
          onChange(Number.isFinite(v) ? v : 0);
        }}
        className={cn(
          "w-20 shrink-0 rounded-lg border bg-black/40 px-2.5 py-2 text-right text-sm font-medium outline-none ring-0 transition-colors",
          negative
            ? "border-red-500/50 text-red-400 focus:border-red-400/70"
            : "border-white/15 text-white focus:border-[hsl(330,70%,55%)]/50"
        )}
      />
    </div>
  );
}

function SectionCard({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <section className={cardClass}>
      <div className="mb-3 flex items-center gap-2.5 border-b border-white/[0.06] pb-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04]">
          <Icon className="h-4 w-4 text-white/70" aria-hidden />
        </div>
        <h2 className="text-base font-semibold tracking-tight text-white">{title}</h2>
      </div>
      <div>{children}</div>
    </section>
  );
}

const TIER_STYLES = {
  bronze: "border-gray-500/40 bg-gray-500/15 text-gray-300",
  silver: "border-slate-400/40 bg-slate-400/15 text-slate-200",
  gold: "border-amber-500/40 bg-amber-500/15 text-amber-200",
  diamond: "border-cyan-500/40 bg-cyan-500/15 text-cyan-200",
} as const;

function TierBadge({ tier, className }: { tier: keyof typeof TIER_STYLES; className?: string }) {
  const labels = { bronze: "Bronze", silver: "Silver", gold: "Gold", diamond: "Diamond" };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        TIER_STYLES[tier],
        className
      )}
    >
      {labels[tier]}
    </span>
  );
}

function LevelThresholdsLadder({
  config,
  set,
}: {
  config: PointsConfig;
  set: (key: keyof PointsConfig) => (n: number) => void;
}) {
  const tiers: {
    key: keyof PointsConfig | null;
    tier: keyof typeof TIER_STYLES;
    fixed?: number;
  }[] = [
    { key: null, tier: "bronze", fixed: 0 },
    { key: "LEVEL_SILVER_MIN", tier: "silver" },
    { key: "LEVEL_GOLD_MIN", tier: "gold" },
    { key: "LEVEL_DIAMOND_MIN", tier: "diamond" },
  ];

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
      {tiers.map((t, i) => (
        <React.Fragment key={t.tier}>
          <div className="flex min-w-[9rem] flex-1 flex-col gap-2 rounded-lg border border-white/[0.06] bg-black/20 p-3">
            <TierBadge tier={t.tier} />
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-white/45">from</span>
              {t.fixed != null ? (
                <input
                  type="number"
                  value={t.fixed}
                  disabled
                  readOnly
                  className="w-20 cursor-not-allowed rounded-lg border border-white/10 bg-black/30 px-2.5 py-1.5 text-right text-sm font-medium text-white/40 outline-none"
                  aria-label={`${t.tier} minimum points (locked)`}
                />
              ) : (
                <input
                  type="number"
                  value={Number.isFinite(config[t.key!]) ? config[t.key!] : 0}
                  onChange={(e) => {
                    const v = e.target.value === "" ? 0 : Number(e.target.value);
                    set(t.key!)(Number.isFinite(v) ? v : 0);
                  }}
                  className="w-20 rounded-lg border border-white/15 bg-black/40 px-2.5 py-1.5 text-right text-sm font-medium text-white outline-none focus:border-[hsl(330,70%,55%)]/50"
                />
              )}
              <span className="text-xs text-white/45">pts</span>
            </div>
          </div>
          {i < tiers.length - 1 ? (
            <ArrowRight className="hidden h-4 w-4 shrink-0 text-white/25 sm:block" aria-hidden />
          ) : null}
        </React.Fragment>
      ))}
    </div>
  );
}

export function RewardsConfigClient({
  initialConfig,
  chatters,
  spinPrizes,
}: {
  initialConfig: PointsConfig;
  chatters: { id: string; name: string }[];
  spinPrizes: SpinPrizeRow[];
}) {
  const { addToast } = useToast();
  const [config, setConfig] = React.useState<PointsConfig>(() => ({ ...initialConfig }));
  const [saving, setSaving] = React.useState(false);
  const [debugOpen, setDebugOpen] = React.useState(false);

  const pointsDirty = !configsEqual(config, initialConfig);

  const set = (key: keyof PointsConfig) => (n: number) => {
    setConfig((prev) => ({ ...prev, [key]: n }));
  };

  async function onSave() {
    setSaving(true);
    try {
      const res = await saveRewardsConfigAction(config);
      if (!res.success) {
        addToast(localToast(`rc-err-${Date.now()}`, "Could not save", res.error, "high"));
        return;
      }
      addToast(localToast(`rc-ok-${Date.now()}`, "Saved", "Rewards point values were updated.", "normal"));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong.";
      addToast(localToast(`rc-err-${Date.now()}`, "Could not save", msg, "high"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[11fr_9fr] lg:items-start">
      {/* Left column — points configuration */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold tracking-tight text-white">Points configuration</h2>
            <p className="mt-1 text-sm text-white/50">
              Values used when awarding chatters. Changes apply to new awards only.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {pointsDirty ? (
              <span className="inline-flex items-center gap-2 text-xs text-amber-300/90">
                <span className="h-2 w-2 rounded-full bg-amber-400" aria-hidden />
                Unsaved changes
              </span>
            ) : null}
            <button type="button" disabled={saving || !pointsDirty} onClick={onSave} className={pinkButtonClass}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>

        <SectionCard title="Shift points" icon={Clock}>
          <ConfigRow
            label="Hours worked (per hour)"
            description="Points per hour of shift time"
            value={config.SHIFT_PER_HOUR}
            onChange={set("SHIFT_PER_HOUR")}
          />
          <ConfigRow
            label="Night shift bonus"
            description="Extra points for shifts after midnight"
            value={config.SHIFT_NIGHT_BONUS}
            onChange={set("SHIFT_NIGHT_BONUS")}
          />
          <ConfigRow
            label="On time bonus (within 5 min)"
            description="Bonus for clocking in within 5 minutes"
            value={config.SHIFT_ON_TIME}
            onChange={set("SHIFT_ON_TIME")}
          />
          <ConfigRow
            label="Late penalty (after 10 min)"
            description="Deducted when chatter joins 10+ min late"
            value={config.SHIFT_LATE_PENALTY}
            onChange={set("SHIFT_LATE_PENALTY")}
          />
          <ConfigRow
            label="No break bonus"
            description="Extra points for completing a shift without a break"
            value={config.SHIFT_NO_BREAK_BONUS}
            onChange={set("SHIFT_NO_BREAK_BONUS")}
          />
        </SectionCard>

        <SectionCard title="Whale points" icon={Star}>
          <ConfigRow
            label="New whale added"
            description="Awarded when a new whale is added to the CRM"
            value={config.WHALE_ADDED}
            onChange={set("WHALE_ADDED")}
          />
          <ConfigRow
            label="Transaction logged"
            description="Points per whale transaction logged"
            value={config.WHALE_TRANSACTION}
            onChange={set("WHALE_TRANSACTION")}
          />
          <ConfigRow
            label="Status upgrade"
            description="When a whale's status tier increases"
            value={config.WHALE_STATUS_UPGRADE}
            onChange={set("WHALE_STATUS_UPGRADE")}
          />
          <ConfigRow
            label="Whale returned (inactive → active)"
            description="When an inactive whale becomes active again"
            value={config.WHALE_RETURNED}
            onChange={set("WHALE_RETURNED")}
          />
          <ConfigRow
            label="Note added"
            description="For adding a note to a whale profile"
            value={config.WHALE_NOTE_ADDED}
            onChange={set("WHALE_NOTE_ADDED")}
          />
          <ConfigRow
            label="Simp or In Love"
            description="When whale reaches Simp or In Love status"
            value={config.WHALE_SIMP_OR_LOVE}
            onChange={set("WHALE_SIMP_OR_LOVE")}
          />
        </SectionCard>

        <SectionCard title="Custom & other" icon={Zap}>
          <ConfigRow
            label="Custom completed"
            description="When a custom request is marked complete"
            value={config.CUSTOM_COMPLETED}
            onChange={set("CUSTOM_COMPLETED")}
          />
          <ConfigRow
            label="Availability submitted"
            description="For submitting weekly availability"
            value={config.AVAILABILITY_SUBMITTED}
            onChange={set("AVAILABILITY_SUBMITTED")}
          />
          <ConfigRow
            label="Rebill verified"
            description="When an admin verifies a rebill"
            value={config.REBILL_VERIFIED}
            onChange={set("REBILL_VERIFIED")}
          />
        </SectionCard>

        <SectionCard title="Streak bonuses" icon={Flame}>
          <ConfigRow
            label="5 day streak bonus"
            description="Bonus after 5 consecutive days on shift"
            value={config.STREAK_5_DAYS}
            onChange={set("STREAK_5_DAYS")}
          />
          <ConfigRow
            label="30 day streak bonus"
            description="Bonus after 30 consecutive days on shift"
            value={config.STREAK_30_DAYS}
            onChange={set("STREAK_30_DAYS")}
          />
        </SectionCard>

        <SectionCard title="Spin wheel" icon={RotateCw}>
          <ConfigRow
            label="Points needed per spin"
            description="Lifetime points required to earn one spin"
            value={config.POINTS_PER_SPIN}
            onChange={set("POINTS_PER_SPIN")}
          />
        </SectionCard>

        <SectionCard title="Level thresholds" icon={Trophy}>
          <p className="mb-3 text-xs text-white/45">Minimum lifetime points required for each chatter level.</p>
          <LevelThresholdsLadder config={config} set={set} />
        </SectionCard>
      </div>

      {/* Right column — spin wheel prizes + debug */}
      <div className="space-y-4">
        <AdminSpinWheelPrizesSection initialPrizes={spinPrizes} />

        <section className={cardClass}>
          <button
            type="button"
            onClick={() => setDebugOpen((o) => !o)}
            className="flex w-full items-center justify-between gap-3 text-left"
            aria-expanded={debugOpen}
          >
            <div>
              <h2 className="text-base font-semibold tracking-tight text-white">Debug tools</h2>
              <p className="mt-0.5 text-xs text-white/45">Test awards, run audits, and clear caches</p>
            </div>
            <ChevronDown
              className={cn("h-5 w-5 shrink-0 text-white/50 transition-transform", debugOpen && "rotate-180")}
              aria-hidden
            />
          </button>
          {debugOpen ? (
            <div className="mt-4 border-t border-white/[0.06] pt-4">
              <RewardsDebugTools chatters={chatters} />
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
