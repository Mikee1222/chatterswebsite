"use client";

import { logout } from "@/app/actions/auth";
import { LogOut } from "lucide-react";
import { NotificationBell } from "@/components/notification-bell";
import { GlobalSearch } from "@/components/global-search";
import type { SessionUser } from "@/types";
import { getNavRoleForSession, hasDualStaffRole } from "@/lib/staff-session-role";

export function Topbar({ user }: { user: SessionUser }) {
  const showSearch = user.role === "admin" || user.role === "manager";
  const navRole = getNavRoleForSession(user);
  const dual = hasDualStaffRole(user);
  const activeLabel = navRole === "virtual_assistant" ? "VA" : navRole === "chatter" ? "CHATTER" : "";
  return (
    <header className="sticky top-0 z-30 hidden h-12 items-center justify-end gap-2 border-b border-white/10 bg-black/40 px-4 backdrop-blur-xl md:flex md:h-14 md:px-6">
      {showSearch ? <GlobalSearch /> : null}
      {dual && activeLabel ? (
        <div
          className="hidden items-center gap-1.5 rounded-full border border-pink-500/20 bg-pink-500/15 px-2 py-1 sm:flex"
          title="Active role"
        >
          <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-pink-400" aria-hidden />
          <span className="text-[11px] font-semibold uppercase tracking-wide text-pink-400">{activeLabel}</span>
        </div>
      ) : null}
      <NotificationBell role={navRole} />
      <form action={logout}>
        <button
          type="submit"
          className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-white/70 transition-colors hover:bg-white/5 hover:text-white md:px-3 md:py-2"
        >
          <LogOut className="h-4 w-4" />
          <span className="hidden sm:inline">Log out</span>
        </button>
      </form>
    </header>
  );
}
