"use client";

import * as React from "react";
import { Share, X } from "lucide-react";
import { usePwa } from "@/components/pwa-provider";

const DISMISS_KEY = "chatter-client-pwa-install-dismissed";

/** Client home: mobile-only PWA install banner with glass-card pink accent. */
export function ClientPwaInstallBanner({
  onDismiss,
  onVisibleChange,
}: {
  onDismiss?: () => void;
  onVisibleChange?: (visible: boolean) => void;
}) {
  const pwa = usePwa();
  const [visible, setVisible] = React.useState(false);
  const [isMobile, setIsMobile] = React.useState(false);
  const [checked, setChecked] = React.useState(false);

  const canInstallSafe = Boolean(pwa?.canInstall === true);
  const isInstallableSafe = Boolean(pwa?.isInstallable === true);
  const isStandaloneSafe = Boolean(pwa?.isStandalone === true);
  const needsAddToHomeScreenSafe = Boolean(pwa?.needsAddToHomeScreen === true);
  const installSheetOpenSafe = Boolean(pwa?.installSheetOpen === true);
  const promptInstallSafe = typeof pwa?.promptInstall === "function" ? pwa.promptInstall : null;
  const dismissInstallSafe = typeof pwa?.dismissInstall === "function" ? pwa.dismissInstall : () => {};
  const setInstallSheetOpenSafe = typeof pwa?.setInstallSheetOpen === "function" ? pwa.setInstallSheetOpen : () => {};

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    setIsMobile(window.matchMedia("(max-width: 767px)").matches);
    setChecked(true);
  }, []);

  React.useEffect(() => {
    if (isStandaloneSafe || !isMobile) return;
    const dismissedAt = localStorage.getItem(DISMISS_KEY);
    if (dismissedAt) return;
    if (needsAddToHomeScreenSafe || (canInstallSafe && isInstallableSafe)) {
      setVisible(true);
    }
  }, [canInstallSafe, isInstallableSafe, isStandaloneSafe, isMobile, needsAddToHomeScreenSafe]);

  const showNativeInstall = visible && canInstallSafe && promptInstallSafe !== null && !needsAddToHomeScreenSafe;
  const showIosGuidance = visible && needsAddToHomeScreenSafe && !isStandaloneSafe;
  const shouldShow = isMobile && !isStandaloneSafe && (showNativeInstall || showIosGuidance);

  React.useEffect(() => {
    if (!checked) return;
    onVisibleChange?.(shouldShow);
  }, [shouldShow, checked, onVisibleChange]);

  if (!shouldShow) return null;

  const handleDismiss = () => {
    setVisible(false);
    dismissInstallSafe();
    setInstallSheetOpenSafe(false);
    if (typeof window !== "undefined") {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    }
    onDismiss?.();
  };

  const handleInstall = () => {
    if (promptInstallSafe) promptInstallSafe();
    dismissInstallSafe();
    setInstallSheetOpenSafe(false);
    handleDismiss();
  };

  return (
    <div
      className="fixed left-0 right-0 z-[88] md:hidden"
      style={{ bottom: "calc(var(--mobile-bottom-nav-height, 76px) + env(safe-area-inset-bottom, 0px))" }}
    >
      <div
        className="glass-card mx-3 border-pink-400/25 p-4 shadow-[0_0_40px_-8px_rgba(236,72,153,0.25)]"
        role="dialog"
        aria-label="Install Gunzo Partner app"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold text-white">
              {showIosGuidance ? "Add to Home Screen" : "Install app"}
            </h3>
            <p className="mt-1 text-sm leading-snug text-white/65">
              {showIosGuidance
                ? "Install for app-style access and payment alerts. Tap Share, then Add to Home Screen."
                : "Get faster access, mobile navigation, and real-time payment alerts."}
            </p>
          </div>
          <button
            type="button"
            onClick={handleDismiss}
            className="shrink-0 rounded-lg p-1.5 text-white/50 hover:bg-white/10 hover:text-white"
            aria-label="Dismiss"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {showIosGuidance ? (
          <>
            <div className="mt-4 flex items-center gap-3 rounded-xl border border-pink-400/20 bg-pink-500/10 px-3 py-2.5 text-sm text-white/80">
              <Share className="h-5 w-5 shrink-0 text-pink-400" />
              <span>Share → Add to Home Screen</span>
            </div>
            <button
              type="button"
              onClick={handleDismiss}
              className="mt-4 w-full rounded-xl border border-white/20 bg-white/5 py-3 text-sm font-medium text-white/80 hover:bg-white/10"
            >
              Maybe later
            </button>
          </>
        ) : (
          <div className="mt-4 flex gap-3">
            <button
              type="button"
              onClick={handleInstall}
              className="flex-1 rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 px-4 py-3 text-sm font-semibold text-white shadow-[0_0_20px_-4px_rgba(236,72,153,0.4)] transition hover:from-pink-400 hover:to-rose-400"
            >
              Install
            </button>
            <button
              type="button"
              onClick={handleDismiss}
              className="rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-sm font-medium text-white/80 hover:bg-white/10"
            >
              Maybe later
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
