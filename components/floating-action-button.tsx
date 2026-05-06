"use client";

import * as React from "react";
import Link from "next/link";
import { Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SessionUser } from "@/types";
import { useMobileFabHidden } from "@/contexts/mobile-fab-visibility-context";
import { CHATTER_QUICK_ACTIONS, QuickActionsModal } from "@/components/quick-actions-modal";

const FAB_BTN_CLASS = cn(
  "flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-lg transition-transform",
  "bg-gradient-to-br from-pink-500 via-pink-500 to-fuchsia-600",
  "border border-pink-400/30",
  "hover:scale-[1.04] active:scale-[0.96]",
  "touch-manipulation focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-black/80"
);

type FloatingActionButtonProps = {
  user: SessionUser;
};

/**
 * Chatter-only FAB: fixed bottom-right above the mobile tab bar.
 * - Mobile: bottom sheet menu (large tap targets, no viewport clipping).
 * - Desktop: compact menu above the button.
 */
export function FloatingActionButton({ user }: FloatingActionButtonProps) {
  const [open, setOpen] = React.useState(false);
  const fabHiddenByOverlay = useMobileFabHidden();

  if (user.role !== "chatter" || fabHiddenByOverlay) return null;

  const fabBottomStyle = {
    bottom: "calc(64px + env(safe-area-inset-bottom, 0px) + 12px)",
    right: "max(1rem, env(safe-area-inset-right, 0px))",
  } as const;

  const fabShadowStyle = {
    boxShadow: "0 10px 28px -6px rgba(236,72,153,0.55), 0 0 0 1px rgba(255,255,255,0.08) inset",
  } as const;

  return (
    <>
      {/* ——— Mobile (md:hidden): sheet + FAB ——— */}
      <div className="md:hidden">
        <QuickActionsModal open={open} onClose={() => setOpen(false)} />

        <div className="fixed z-[107] flex flex-col items-end" style={fabBottomStyle}>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className={FAB_BTN_CLASS}
            style={fabShadowStyle}
            aria-expanded={open}
            aria-haspopup="dialog"
            aria-label={open ? "Close quick actions" : "Open quick actions"}
          >
            <Plus
              className={cn("h-7 w-7 transition-transform duration-200 ease-out", open && "rotate-45")}
              strokeWidth={2.4}
            />
          </button>
        </div>
      </div>

      {/* ——— Desktop (md+): dropdown above FAB ——— */}
      <div className="pointer-events-none fixed z-[50] hidden flex-col items-end gap-2 md:pointer-events-auto md:flex bottom-6 right-6">
        {open ? (
          <button
            type="button"
            className="pointer-events-auto fixed inset-0 z-[45] cursor-default bg-black/40 backdrop-blur-[2px]"
            aria-label="Close quick actions"
            onClick={() => setOpen(false)}
          />
        ) : null}

        {open ? (
          <nav
            className="pointer-events-auto relative z-[50] mb-1 min-w-[220px] overflow-hidden rounded-2xl border border-white/10 bg-black/90 py-1 shadow-[0_-8px_40px_rgba(0,0,0,0.45),0_0_0_1px_rgba(255,255,255,0.06)] backdrop-blur-xl"
            aria-label="Quick actions"
          >
            <ul className="divide-y divide-white/5">
              {CHATTER_QUICK_ACTIONS.map(({ href, label, Icon }) => (
                <li key={href}>
                  <Link
                    href={href}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 px-4 py-3.5 text-left text-[15px] font-medium text-white/95 transition-colors hover:bg-white/[0.08]"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-pink-500/20 text-pink-400">
                      <Icon className="h-4 w-4" />
                    </span>
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={cn(FAB_BTN_CLASS, "pointer-events-auto relative z-[50]")}
          style={fabShadowStyle}
          aria-expanded={open}
          aria-haspopup="menu"
          aria-label={open ? "Close quick actions" : "Open quick actions"}
        >
          <Plus
            className={cn("h-7 w-7 transition-transform duration-200 ease-out", open && "rotate-45")}
            strokeWidth={2.4}
          />
        </button>
      </div>
    </>
  );
}
