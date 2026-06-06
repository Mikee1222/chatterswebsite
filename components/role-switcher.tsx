"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeftRight } from "lucide-react";
import { ROUTES } from "@/lib/routes";
import type { StaffPairRole } from "@/lib/staff-session-role";

type Props = {
  currentRole: StaffPairRole;
  secondaryRole: StaffPairRole;
  hasActiveShift: boolean;
};

export function RoleSwitcher({ currentRole, secondaryRole, hasActiveShift }: Props) {
  const [showWarning, setShowWarning] = React.useState(false);
  const [switching, setSwitching] = React.useState(false);
  const router = useRouter();

  const targetRole = secondaryRole;
  const targetLabel = targetRole === "virtual_assistant" ? "Virtual Assistant" : "Chatter";
  const currentLabel = currentRole === "virtual_assistant" ? "Virtual Assistant" : "Chatter";

  async function handleSwitch() {
    if (hasActiveShift) {
      setShowWarning(true);
      return;
    }
    await doSwitch();
  }

  async function doSwitch() {
    setSwitching(true);
    setShowWarning(false);
    try {
      const res = await fetch("/api/auth/switch-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ target_role: targetRole }),
      });
      if (res.ok) {
        const home =
          targetRole === "virtual_assistant" ? ROUTES.va.home : ROUTES.chatter.home;
        router.push(home);
        router.refresh();
      }
    } catch (e) {
      console.error(e);
    }
    setSwitching(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={handleSwitch}
        disabled={switching}
        className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 transition-all hover:bg-white/[0.08] disabled:opacity-50"
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-pink-500/20">
          <ArrowLeftRight className="h-4 w-4 shrink-0 text-pink-400" />
        </div>
        <div className="min-w-0 text-left">
          <p className="text-sm font-semibold text-white">
            {switching ? "Switching…" : `Switch to ${targetLabel}`}
          </p>
          <p className="text-xs text-white/40">Currently: {currentLabel}</p>
        </div>
      </button>

      {showWarning ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-white/15 bg-[#0f0f1a] p-6 shadow-2xl">
            <div className="mb-4 flex justify-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/20 text-2xl" aria-hidden>
              <AlertTriangle className="h-6 w-6 text-amber-400" aria-hidden />
              </div>
            </div>
            <h3 className="mb-2 text-center text-lg font-bold text-white">Active shift detected</h3>
            <p className="mb-6 text-center text-sm leading-relaxed text-white/60">
              You have an active shift as <strong className="text-white">{currentLabel}</strong>. If you switch now,
              your shift will remain active but you won’t manage it from this mode until you switch back.
            </p>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={doSwitch}
                className="w-full rounded-xl border border-amber-500/30 bg-amber-500/20 py-3 font-semibold text-amber-400 transition-all hover:bg-amber-500/30"
              >
                Switch anyway → {targetLabel}
              </button>
              <button
                type="button"
                onClick={() => setShowWarning(false)}
                className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 text-sm text-white/60 transition-all hover:bg-white/10"
              >
                Stay as {currentLabel}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
