"use client";

import * as React from "react";
import { BellPlus, X } from "lucide-react";
import { ClientPwaInstallBanner } from "@/components/client-pwa-install-banner";
import { runPushEnableFlow } from "@/components/push-permission-prompt";
import { useToast } from "@/contexts/toast-context";
import type { AppNotification } from "@/types";

const DISMISS_KEY = "chatter-client-push-prompt-dismissed";
const DISMISS_RESHOW_DAYS = 7;

function localToast(id: string, title: string, body: string): AppNotification {
  return {
    id,
    notification_id: id,
    user_id: "local",
    category: "system",
    event_type: "system_alert",
    priority: "normal",
    title,
    body,
    entity_type: "system",
    entity_id: "",
    read_at: null,
    created_at: new Date().toISOString(),
  };
}

/** Client home: PWA install banner, then push prompt when push is not enabled. */
export function ClientHomePrompts() {
  const { addToast } = useToast();
  const [pwaBannerVisible, setPwaBannerVisible] = React.useState(false);
  const [pwaReady, setPwaReady] = React.useState(false);
  const [showPush, setShowPush] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    if (!mounted || !pwaReady || pwaBannerVisible || typeof window === "undefined") return;
    if (!("Notification" in window) || !("serviceWorker" in navigator)) return;
    if (Notification.permission === "granted") return;
    const dismissedAt = localStorage.getItem(DISMISS_KEY);
    if (dismissedAt) {
      const t = parseInt(dismissedAt, 10);
      if (Date.now() - t < DISMISS_RESHOW_DAYS * 24 * 60 * 60 * 1000) return;
    }
    setShowPush(true);
  }, [mounted, pwaBannerVisible, pwaReady]);

  const handleEnablePush = async () => {
    setLoading(true);
    const result = await runPushEnableFlow("client");
    setLoading(false);
    if (result.status === "success") {
      setShowPush(false);
      addToast(localToast("client-push-ok", "Notifications enabled", "You'll receive payment and billing alerts."));
    } else if (result.status === "denied") {
      setShowPush(false);
    }
  };

  const handleDismissPush = () => {
    setShowPush(false);
    if (typeof window !== "undefined") {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    }
  };

  return (
    <>
      <ClientPwaInstallBanner
        onVisibleChange={(visible) => {
          setPwaBannerVisible(visible);
          setPwaReady(true);
        }}
      />
      {showPush && !pwaBannerVisible && pwaReady ? (
        <div
          className="fixed left-0 right-0 z-[87] md:hidden"
          style={{ bottom: "calc(var(--mobile-bottom-nav-height, 76px) + env(safe-area-inset-bottom, 0px))" }}
        >
          <div className="glass-card mx-3 border-pink-400/25 p-4 shadow-[0_0_40px_-8px_rgba(236,72,153,0.2)]" role="dialog" aria-label="Enable notifications">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-pink-500/20 text-pink-400">
                    <BellPlus className="h-5 w-5" />
                  </span>
                  <h3 className="text-base font-semibold text-white">Enable notifications</h3>
                </div>
                <p className="mt-2 text-sm leading-snug text-white/65">
                  Get alerts for payment reminders, approvals, and new billing cycles.
                </p>
              </div>
              <button
                type="button"
                onClick={handleDismissPush}
                className="shrink-0 rounded-lg p-1.5 text-white/50 hover:bg-white/10 hover:text-white"
                aria-label="Dismiss"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-4 flex gap-3">
              <button
                type="button"
                onClick={() => void handleEnablePush()}
                disabled={loading}
                className="flex-1 rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 px-4 py-3 text-sm font-semibold text-white shadow-[0_0_20px_-4px_rgba(236,72,153,0.4)] transition hover:from-pink-400 hover:to-rose-400 disabled:opacity-70"
              >
                {loading ? "Enabling…" : "Enable notifications"}
              </button>
              <button
                type="button"
                onClick={handleDismissPush}
                className="rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-sm font-medium text-white/80 hover:bg-white/10"
              >
                Not now
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
