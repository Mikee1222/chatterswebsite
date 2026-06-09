"use client";

import { NotificationBell } from "@/components/notification-bell";

export function ClientPortalHeader() {
  return (
    <header className="sticky top-0 z-30 flex h-12 shrink-0 items-center justify-end gap-2 border-b border-white/10 bg-black/40 px-4 backdrop-blur-xl md:h-14 md:px-6">
      <NotificationBell role="client" />
    </header>
  );
}
