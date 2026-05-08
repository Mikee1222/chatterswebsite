"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { useToast } from "@/contexts/toast-context";
import { saveRewardsConfigAction } from "@/app/actions/rewards-config";
import type { PointsConfig } from "@/services/points-config";
import type { AppNotification } from "@/types";
import { cn } from "@/lib/utils";
import { RewardsDebugTools } from "@/components/rewards-debug-tools";
import { AdminSpinWheelPrizesSection } from "@/components/admin-spin-wheel-prizes";
import type { SpinPrizeRow } from "@/services/spin-wheel";

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

function ConfigRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  const negative = value < 0;
  return (
    <div className="grid grid-cols-1 gap-2 border-b border-white/[0.06] py-3 last:border-0 sm:grid-cols-[1fr_auto] sm:items-center sm:gap-4">
      <span className="text-sm text-white/75">{label}</span>
      <input
        type="number"
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => {
          const v = e.target.value === "" ? 0 : Number(e.target.value);
          onChange(Number.isFinite(v) ? v : 0);
        }}
        className={cn(
          "w-full min-w-[7rem] rounded-xl border bg-black/40 px-3 py-2 text-right text-sm font-medium outline-none ring-0 transition-colors sm:max-w-[9rem]",
          negative
            ? "border-red-500/40 text-red-400 focus:border-red-400/60"
            : "border-white/15 text-white focus:border-[hsl(330,70%,55%)]/50"
        )}
      />
    </div>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section
      className="rounded-2xl border border-white/[0.08] bg-gradient-to-b from-zinc-900/90 to-black/80 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.03),0_24px_48px_rgba(0,0,0,0.45)] backdrop-blur-xl"
      style={{ boxShadow: "0 0 0 1px rgba(255,255,255,0.04), 0 20px 50px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)" }}
    >
      <h2 className="mb-1 border-b border-white/10 pb-3 text-base font-semibold tracking-tight text-white">{title}</h2>
      <div className="pt-1">{children}</div>
    </section>
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
    <div className="space-y-6">
      <SectionCard title="⚡ Shift Points">
        <ConfigRow label="Hours worked (per hour)" value={config.SHIFT_PER_HOUR} onChange={set("SHIFT_PER_HOUR")} />
        <ConfigRow label="Night shift bonus" value={config.SHIFT_NIGHT_BONUS} onChange={set("SHIFT_NIGHT_BONUS")} />
        <ConfigRow label="On time bonus (within 5 min)" value={config.SHIFT_ON_TIME} onChange={set("SHIFT_ON_TIME")} />
        <ConfigRow label="Late penalty (after 10 min)" value={config.SHIFT_LATE_PENALTY} onChange={set("SHIFT_LATE_PENALTY")} />
        <ConfigRow label="No break bonus" value={config.SHIFT_NO_BREAK_BONUS} onChange={set("SHIFT_NO_BREAK_BONUS")} />
      </SectionCard>

      <SectionCard title="🐋 Whale Points">
        <ConfigRow label="New whale added" value={config.WHALE_ADDED} onChange={set("WHALE_ADDED")} />
        <ConfigRow label="Transaction logged" value={config.WHALE_TRANSACTION} onChange={set("WHALE_TRANSACTION")} />
        <ConfigRow label="Status upgrade" value={config.WHALE_STATUS_UPGRADE} onChange={set("WHALE_STATUS_UPGRADE")} />
        <ConfigRow label="Whale returned (inactive → active)" value={config.WHALE_RETURNED} onChange={set("WHALE_RETURNED")} />
        <ConfigRow label="Note added" value={config.WHALE_NOTE_ADDED} onChange={set("WHALE_NOTE_ADDED")} />
        <ConfigRow label="Simp or In Love" value={config.WHALE_SIMP_OR_LOVE} onChange={set("WHALE_SIMP_OR_LOVE")} />
      </SectionCard>

      <SectionCard title="🎯 Custom & Other">
        <ConfigRow label="Custom completed" value={config.CUSTOM_COMPLETED} onChange={set("CUSTOM_COMPLETED")} />
        <ConfigRow label="Availability submitted" value={config.AVAILABILITY_SUBMITTED} onChange={set("AVAILABILITY_SUBMITTED")} />
      </SectionCard>

      <SectionCard title="🔥 Streak Bonuses">
        <ConfigRow label="5 day streak bonus" value={config.STREAK_5_DAYS} onChange={set("STREAK_5_DAYS")} />
        <ConfigRow label="30 day streak bonus" value={config.STREAK_30_DAYS} onChange={set("STREAK_30_DAYS")} />
      </SectionCard>

      <SectionCard title="🎰 Spin Wheel">
        <ConfigRow label="Points needed per spin" value={config.POINTS_PER_SPIN} onChange={set("POINTS_PER_SPIN")} />
      </SectionCard>

      <SectionCard title="🎯 Spin Wheel Prizes">
        <AdminSpinWheelPrizesSection initialPrizes={spinPrizes} />
      </SectionCard>

      <SectionCard title="💎 Level thresholds">
        <div className="grid grid-cols-1 gap-2 border-b border-white/[0.06] py-3 sm:grid-cols-[1fr_auto] sm:items-center sm:gap-4">
          <span className="text-sm text-white/75">Bronze starts at (fixed)</span>
          <input
            type="number"
            value={0}
            disabled
            readOnly
            className="w-full min-w-[7rem] cursor-not-allowed rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-right text-sm font-medium text-white/40 outline-none sm:max-w-[9rem]"
            aria-label="Bronze minimum points (locked at zero)"
          />
        </div>
        <ConfigRow label="Silver minimum points" value={config.LEVEL_SILVER_MIN} onChange={set("LEVEL_SILVER_MIN")} />
        <ConfigRow label="Gold minimum points" value={config.LEVEL_GOLD_MIN} onChange={set("LEVEL_GOLD_MIN")} />
        <ConfigRow label="Diamond minimum points" value={config.LEVEL_DIAMOND_MIN} onChange={set("LEVEL_DIAMOND_MIN")} />
      </SectionCard>

      <div className="flex justify-end pt-2">
        <button
          type="button"
          disabled={saving}
          onClick={onSave}
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[hsl(330,75%,52%)] to-[hsl(280,55%,48%)] px-6 text-sm font-semibold text-white shadow-lg shadow-black/30 transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>

      <RewardsDebugTools chatters={chatters} />
    </div>
  );
}
