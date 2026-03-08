"use client";

import * as React from "react";
import { usePwa } from "@/components/pwa-provider";
import { runPushEnableFlow } from "@/components/push-permission-prompt";
import { Download, BellPlus, Bell, BellOff, Send } from "lucide-react";
import type { UserRole } from "@/types";

export function SettingsPwaActions({ role }: { role?: UserRole | null }) {
  const { canInstall, needsAddToHomeScreen, isStandalone, setInstallSheetOpen } = usePwa();
  const [notificationPermission, setNotificationPermission] = React.useState<NotificationPermission | null>(null);
  const [testPushLoading, setTestPushLoading] = React.useState(false);
  const [testPushResult, setTestPushResult] = React.useState<"ok" | "error" | null>(null);
  const [enableLoading, setEnableLoading] = React.useState(false);
  const [enableResult, setEnableResult] = React.useState<"success" | "error" | "denied" | "unsupported" | null>(null);
  const [enableMessage, setEnableMessage] = React.useState<string>("");

  React.useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setNotificationPermission(Notification.permission);
    }
  }, []);

  const showInstall = (canInstall || needsAddToHomeScreen) && !isStandalone;
  const permissionGranted = notificationPermission === "granted";
  const permissionDenied = notificationPermission === "denied";
  const permissionDefault = notificationPermission === "default" || notificationPermission === null;

  const handleEnableNotifications = async () => {
    setEnableResult(null);
    setEnableMessage("");
    setEnableLoading(true);
    const result = await runPushEnableFlow(role);
    setEnableLoading(false);
    if (result.status === "success") {
      setEnableResult("success");
      setNotificationPermission("granted");
    } else if (result.status === "denied") {
      setEnableResult("denied");
    } else if (result.status === "unsupported") {
      setEnableResult("unsupported");
      setEnableMessage(result.reason);
    } else {
      setEnableResult("error");
      setEnableMessage(result.message);
    }
  };

  const handleTestPush = async () => {
    setTestPushResult(null);
    setTestPushLoading(true);
    try {
      const res = await fetch("/api/push/test", { method: "POST", credentials: "include" });
      const data = await res.json().catch(() => ({}));
      setTestPushResult(res.ok && (data as { sent?: number }).sent ? "ok" : "error");
    } catch {
      setTestPushResult("error");
    } finally {
      setTestPushLoading(false);
    }
  };

  const showSection = showInstall || permissionGranted || permissionDenied || permissionDefault;

  if (!showSection) return null;

  return (
    <section className="border-t border-white/10 pt-8">
      <h2 className="mb-4 text-lg font-semibold text-white">App & push notifications</h2>
      <p className="mb-4 text-sm text-white/60">
        Install the app for a better experience. Push notifications deliver alerts when the app is closed (separate from in-app notifications).
      </p>
      <div className="flex flex-col gap-3">
        {showInstall && (
          <button
            type="button"
            onClick={() => setInstallSheetOpen(true)}
            className="flex items-center gap-4 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-4 text-left transition hover:bg-white/[0.08]"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[hsl(330,80%,55%)]/20 text-[hsl(330,90%,65%)]">
              <Download className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-white/95">Install app</p>
              <p className="mt-0.5 text-sm text-white/60">
                {needsAddToHomeScreen ? "Add to Home Screen for app-style access." : "Get faster access and app-style navigation."}
              </p>
            </div>
          </button>
        )}

        {/* Push state */}
        {permissionGranted && (
          <div className="flex items-center gap-4 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400">
              <Bell className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-white/95">Push connected</p>
              <p className="mt-0.5 text-sm text-white/60">You’ll receive real-time alerts when the app is closed.</p>
            </div>
            <button
              type="button"
              onClick={handleTestPush}
              disabled={testPushLoading}
              className="shrink-0 rounded-xl bg-white/10 px-4 py-2.5 text-sm font-medium text-white/90 hover:bg-white/15 disabled:opacity-60"
            >
              {testPushLoading ? "Sending…" : "Send test push"}
            </button>
          </div>
        )}
        {testPushResult === "ok" && (
          <p className="text-sm text-emerald-400">Test notification sent. Check your device.</p>
        )}
        {testPushResult === "error" && (
          <p className="text-sm text-amber-400">Could not send test. Enable notifications and try again.</p>
        )}

        {permissionDenied && (
          <div className="flex items-center gap-4 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white/50">
              <BellOff className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-white/80">Notifications are off</p>
              <p className="mt-0.5 text-sm text-white/50">You can enable them in your browser or device settings.</p>
            </div>
          </div>
        )}

        {(permissionDefault || permissionDenied) && (
          <>
            <button
              type="button"
              onClick={handleEnableNotifications}
              disabled={enableLoading}
              className="flex items-center gap-4 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-4 text-left transition hover:bg-white/[0.08] disabled:opacity-70"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[hsl(330,80%,55%)]/20 text-[hsl(330,90%,65%)]">
                <BellPlus className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-white/95">Enable notifications</p>
                <p className="mt-0.5 text-sm text-white/60">Get real-time alerts for shifts, sessions, and more.</p>
              </div>
              {enableLoading && <span className="text-sm text-white/60">Enabling…</span>}
            </button>
            {enableResult === "success" && (
              <p className="text-sm text-emerald-400">Notifications enabled. You’ll receive push alerts.</p>
            )}
            {enableResult === "denied" && (
              <p className="text-sm text-amber-400">Permission denied. You can try again or enable in browser settings.</p>
            )}
            {enableResult === "unsupported" && (
              <p className="text-sm text-amber-400">Not supported: {enableMessage || "This browser cannot show push notifications."}</p>
            )}
            {enableResult === "error" && (
              <p className="text-sm text-amber-400">Failed: {enableMessage || "Could not enable. Try again."}</p>
            )}
          </>
        )}
      </div>
    </section>
  );
}
