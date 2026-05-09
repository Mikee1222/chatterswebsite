"use client";

import * as React from "react";
import { DollarSign, RefreshCw } from "lucide-react";
import { useChatterRebillTipFabHandlers } from "@/contexts/chatter-rebill-tip-fab-context";

type Variant = "sheet" | "nav";

const iconWrapClass = "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#2a1a2e]";

export function ChatterRebillTipFabMenuItems({ onClose, variant }: { onClose: () => void; variant: Variant }) {
  const handlers = useChatterRebillTipFabHandlers();
  const rowClass =
    variant === "sheet"
      ? "flex w-full items-center gap-4 px-4 py-4 transition-all hover:bg-white/5 border-t border-white/[0.08]"
      : "flex w-full items-center gap-4 px-4 py-3.5 text-left transition-colors hover:bg-white/[0.08]";

  const onRebill = () => {
    onClose();
    handlers?.openRebill();
  };

  const onTip = () => {
    onClose();
    handlers?.openTip();
  };

  if (variant === "sheet") {
    return (
      <>
        <li>
          <button type="button" onClick={onRebill} disabled={!handlers} className={rowClass}>
            <div className={iconWrapClass}>
              <RefreshCw className="h-5 w-5 text-pink-400" />
            </div>
            <span className="text-base text-white">Add rebill</span>
          </button>
        </li>
        <li>
          <button type="button" onClick={onTip} disabled={!handlers} className={rowClass}>
            <div className={iconWrapClass}>
              <DollarSign className="h-5 w-5 text-pink-400" />
            </div>
            <span className="text-base text-white">Add missing tip</span>
          </button>
        </li>
      </>
    );
  }

  return (
    <>
      <li>
        <button type="button" onClick={onRebill} disabled={!handlers} className={rowClass}>
          <div className={iconWrapClass}>
            <RefreshCw className="h-5 w-5 text-pink-400" />
          </div>
          <span className="text-base text-white">Add rebill</span>
        </button>
      </li>
      <li>
        <button type="button" onClick={onTip} disabled={!handlers} className={rowClass}>
          <div className={iconWrapClass}>
            <DollarSign className="h-5 w-5 text-pink-400" />
          </div>
          <span className="text-base text-white">Add missing tip</span>
        </button>
      </li>
    </>
  );
}
