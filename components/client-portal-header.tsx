"use client";

import { Menu } from "lucide-react";
import { NotificationBell } from "@/components/notification-bell";
import { useClientMobileMenu } from "@/contexts/client-mobile-menu-context";

export function ClientPortalHeader() {
  const { setOpen } = useClientMobileMenu();

  return (
    <>
      <header
        className="fixed left-0 right-0 top-0 z-30 shrink-0 md:sticky md:left-auto md:right-auto"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="flex h-14 min-h-[56px] w-full min-w-0 items-center justify-between gap-2 border-b border-white/10 bg-zinc-900/80 px-4 backdrop-blur-xl md:hidden">
          <h1 className="min-w-0 flex-1 truncate text-lg font-semibold tracking-tight text-white">
            Gunzo Partner
          </h1>
          <div className="flex shrink-0 items-center gap-1">
            <NotificationBell role="client" />
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white/80 outline-none hover:bg-white/10 hover:text-white"
              aria-label="Open menu"
            >
              <Menu className="h-6 w-6" />
            </button>
          </div>
        </div>
        <div className="hidden h-14 shrink-0 items-center justify-end gap-2 border-b border-white/10 bg-black/40 px-6 backdrop-blur-xl md:flex">
          <NotificationBell role="client" />
        </div>
      </header>
      <div className="h-14 shrink-0 md:hidden" aria-hidden />
    </>
  );
}
