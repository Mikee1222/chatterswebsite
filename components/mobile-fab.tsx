"use client";

import * as React from "react";
import Link from "next/link";
import {
  Plus,
  X,
  PlayCircle,
  Receipt,
  FileText,
  Calendar,
  Wrench,
  Radio,
  CalendarCheck,
  Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/lib/routes";
import type { SessionUser } from "@/types";

type QuickAction = { href: string; label: string; icon: React.ComponentType<{ className?: string }> };

function getQuickActions(user: SessionUser): QuickAction[] {
  const role = user.role;
  if (role === "chatter") {
    return [
      { href: ROUTES.chatter.shift, label: "Start shift", icon: PlayCircle },
      { href: ROUTES.chatter.logTransaction, label: "Whale session", icon: Receipt },
      { href: ROUTES.chatter.requestCustom, label: "Request custom", icon: FileText },
      { href: ROUTES.chatter.weeklyAvailability, label: "Add availability", icon: Calendar },
    ];
  }
  if (role === "virtual_assistant") {
    return [
      { href: ROUTES.va.shift, label: "Start mistake shift", icon: Wrench },
      { href: ROUTES.va.weeklyAvailability, label: "Add availability", icon: Calendar },
      { href: ROUTES.va.liveShifts, label: "View live shifts", icon: Radio },
    ];
  }
  if (role === "admin" || role === "manager") {
    return [
      { href: ROUTES.admin.weeklyProgram, label: "Create shift", icon: Plus },
      { href: ROUTES.admin.liveShifts, label: "View live shifts", icon: Radio },
      { href: ROUTES.admin.weeklyProgram, label: "Weekly program", icon: CalendarCheck },
      { href: ROUTES.admin.shiftActivity, label: "Shift activity", icon: Activity },
    ];
  }
  return [];
}

type MobileFabProps = { user: SessionUser; hasLiveMiniBar?: boolean };

export function MobileFab({ user, hasLiveMiniBar = false }: MobileFabProps) {
  const [open, setOpen] = React.useState(false);
  const actions = React.useMemo(() => getQuickActions(user), [user]);

  if (actions.length === 0) return null;

  const bottomOffset = hasLiveMiniBar ? "136px" : "84px";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "fixed right-4 z-35 flex h-14 w-14 items-center justify-center rounded-2xl shadow-lg md:hidden",
          "bg-[hsl(330,80%,55%)] text-white",
          "hover:bg-[hsl(330,80%,50%)] active:scale-95 transition-all",
          "ring-2 ring-white/20 ring-offset-2 ring-offset-black/80"
        )}
        style={{
          bottom: `calc(${bottomOffset} + env(safe-area-inset-bottom, 0px))`,
          boxShadow: "0 4px 24px -4px rgba(236,72,153,0.5), 0 0 0 1px rgba(255,255,255,0.1)",
        }}
        aria-label="Quick actions"
      >
        <Plus className="h-7 w-7" strokeWidth={2.5} />
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-[105] bg-black/60 backdrop-blur-sm md:hidden"
            aria-hidden
            onClick={() => setOpen(false)}
          />
          <div
            className="fixed inset-x-0 bottom-0 z-[106] flex max-h-[70dvh] flex-col rounded-t-2xl border border-white/10 border-b-0 bg-black/95 backdrop-blur-xl md:hidden transition-transform duration-200 ease-out"
            style={{
              paddingBottom: "env(safe-area-inset-bottom)",
              boxShadow: "0 -8px 40px rgba(0,0,0,0.5)",
            }}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-4">
              <span className="text-base font-semibold text-white">Quick actions</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-10 w-10 items-center justify-center rounded-xl text-white/70 hover:bg-white/10 hover:text-white"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <ul className="flex-1 space-y-0.5 overflow-y-auto p-4">
              {actions.map((a) => {
                const Icon = a.icon;
                return (
                  <li key={a.href}>
                    <Link
                      href={a.href}
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-4 rounded-xl px-4 py-4 text-base font-medium text-white/95 transition-colors hover:bg-white/10"
                    >
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[hsl(330,80%,55%)]/20 text-[hsl(330,90%,65%)]">
                        <Icon className="h-5 w-5" />
                      </span>
                      {a.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </>
      )}
    </>
  );
}
