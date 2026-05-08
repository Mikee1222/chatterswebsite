"use client";

import * as React from "react";
import { DollarSign, RefreshCw } from "lucide-react";
import { useChatterRebillTipFabHandlers } from "@/contexts/chatter-rebill-tip-fab-context";

type Variant = "sheet" | "nav";

export function ChatterRebillTipFabMenuItems({ onClose, variant }: { onClose: () => void; variant: Variant }) {
  const handlers = useChatterRebillTipFabHandlers();
  if (!handlers) return null;

  const sheetBtnClass =
    "flex w-full min-h-[52px] items-center gap-3 rounded-xl px-3 py-3.5 text-left text-[15px] font-medium text-white/95 transition-colors active:bg-white/10 touch-manipulation";
  const navBtnClass =
    "flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-white/5 w-full text-left";

  const btnClass = variant === "sheet" ? sheetBtnClass : navBtnClass;

  return (
    <>
      <li>
        <button
          type="button"
          onClick={() => {
            onClose();
            handlers.openRebill();
          }}
          className={btnClass}
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-green-500/20">
            <RefreshCw className="h-4 w-4 text-green-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-white">Add rebill</p>
            <p className="text-xs text-white/40">Log a subscriber rebill</p>
          </div>
        </button>
      </li>
      <li>
        <button
          type="button"
          onClick={() => {
            onClose();
            handlers.openTip();
          }}
          className={btnClass}
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/20">
            <DollarSign className="h-4 w-4 text-amber-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-white">Add missing tip</p>
            <p className="text-xs text-white/40">Report an unlocked tip</p>
          </div>
        </button>
      </li>
    </>
  );
}
