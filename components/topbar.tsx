"use client";

import { logout } from "@/app/actions/auth";
import { LogOut } from "lucide-react";
import { NotificationBell } from "@/components/notification-bell";
import type { SessionUser } from "@/types";

export function Topbar({ user }: { user: SessionUser }) {
  return (
    <header className="sticky top-0 z-30 hidden h-12 items-center justify-end border-b border-white/10 bg-black/40 px-4 backdrop-blur-xl md:flex md:h-14 md:px-6">
      <div className="flex items-center gap-2">
        <NotificationBell role={user?.role} />
        <form action={logout}>
          <button
            type="submit"
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-white/70 transition-colors hover:bg-white/5 hover:text-white md:px-3 md:py-2"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Log out</span>
          </button>
        </form>
      </div>
    </header>
  );
}
