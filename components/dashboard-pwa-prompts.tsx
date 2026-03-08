"use client";

import { PushPermissionPrompt } from "@/components/push-permission-prompt";
import { PwaInstallBanner } from "@/components/pwa-install-banner";
import type { SessionUser } from "@/types";

export function DashboardPwaPrompts({ user }: { user: SessionUser }) {
  return (
    <>
      <PushPermissionPrompt role={user?.role} />
      <PwaInstallBanner />
    </>
  );
}
