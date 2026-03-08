"use client";

import * as React from "react";
import { usePwa } from "@/components/pwa-provider";
import { runPushEnableFlow } from "@/components/push-permission-prompt";
import { Download, BellPlus, Bell, BellOff, Send } from "lucide-react";
import type { UserRole } from "@/types";

export function SettingsPwaActions({ role }: { role?: UserRole | null }) {
  const { canInstall, needsAddToHomeScreen, isStandalone, setInstallSheetOpen } = usePwa();
  const [notificationPermission, setNotificationPermission] = React.useState<NotificationPermission | null>(null);
  const [subscriptionSaved, setSubscriptionSaved] = React.useState<boolean | null>(null);
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

  React.useEffect(() => {
    if (typeof window === "undefined" || notificationPermission !== "granted") {
      setSubscriptionSaved(null);
      return;
    }
    let cancelled = false;
    fetch("/api/push/subscriptions", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : { hasSubscription: false }))
      .then((data: { hasSubscription?: boolean }) => {
        if (!cancelled) setSubscriptionSaved(Boolean(data.hasSubscription));
      })
      .catch(() => {
        if (!cancelled) setSubscriptionSaved(false);
      });
    return () => {
      cancelled = true;
    };
  }, [notificationPermission]);

  const showInstall = (canInstall || needsAddToHomeScreen) && !isStandalone;
  const permissionGranted = notificationPermission === "granted";
  const subscriptionSavedOk = subscriptionSaved === true;
  const pushFullyEnabled = permissionGranted && subscriptionSavedOk;
  const permissionGrantedButSaveFailed = permissionGranted && subscriptionSaved === false;
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
      setSubscriptionSaved(true);
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

  const showSection =
    showInstall ||
    pushFullyEnabled ||
    permissionGrantedButSaveFailed ||
    (permissionGranted && subscriptionSaved === null) ||
    permissionDenied ||
    permissionDefault;

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

        {/* Push state: only show "Push connected" when both permission granted AND subscription saved */}
        {pushFullyEnabled && (
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
        {/* Permission granted, checking or save failed */}
        {permissionGranted && subscriptionSaved === null && (
          <div className="flex items-center gap-4 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white/50">
              <Bell className="h-5 w-5 animate-pulse" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-white/80">Checking push status…</p>
              <p className="mt-0.5 text-sm text-white/50">One moment.</p>
            </div>
          </div>
        )}
        {permissionGrantedButSaveFailed && (
          <div className="flex flex-col gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-4">
            <div className="flex items-center gap-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400">
                <Bell className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-amber-200/95">Permission granted, but subscription setup failed</p>
                <p className="mt-0.5 text-sm text-white/60">We couldn’t save this device. Tap Retry to try again.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleEnableNotifications}
              disabled={enableLoading}
              className="self-start rounded-xl bg-[hsl(330,80%,55%)] px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60"
            >
              {enableLoading ? "Retrying…" : "Retry"}
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
