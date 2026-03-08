"use client";

import * as React from "react";
import { usePwa } from "@/components/pwa-provider";
import { X, Share } from "lucide-react";

/**
 * Isolation: set to true to disable banner (return null after hooks).
 * - If error disappears → bug was in banner. If error remains → check provider or stale cache.
 * Stale cache fix: unregister service workers (DevTools → Application → Service Workers),
 * clear site storage for localhost, delete .next, restart dev server, hard reload (Cmd+Shift+R).
 */
const DISABLE_PWA_BANNER = false;

/** Install banner: fully defensive – all values derived from pwa with safe defaults, no bare refs. */
export function PwaInstallBanner() {
  const pwa = usePwa();

  const canInstallSafe = Boolean(pwa?.canInstall === true);
  const isInstallableSafe = Boolean(pwa?.isInstallable === true);
  const isStandaloneSafe = Boolean(pwa?.isStandalone === true);
  const needsAddToHomeScreenSafe = Boolean(pwa?.needsAddToHomeScreen === true);
  const installSheetOpenSafe = Boolean(pwa?.installSheetOpen === true);
  const promptInstallSafe = typeof pwa?.promptInstall === "function" ? pwa.promptInstall : null;
  const dismissInstallSafe = typeof pwa?.dismissInstall === "function" ? pwa.dismissInstall : () => {};
  const setInstallSheetOpenSafe = typeof pwa?.setInstallSheetOpen === "function" ? pwa.setInstallSheetOpen : () => {};

  const [visible, setVisible] = React.useState(false);
  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    setIsMobile(window.matchMedia("(max-width: 767px)").matches);
  }, []);

  const showNativeInstall =
    (isInstallableSafe || installSheetOpenSafe) &&
    (visible || installSheetOpenSafe) &&
    canInstallSafe &&
    promptInstallSafe !== null;
  const showIosGuidance =
    needsAddToHomeScreenSafe && (installSheetOpenSafe || visible) && !isStandaloneSafe;

  React.useEffect(() => {
    if (needsAddToHomeScreenSafe && !visible && !installSheetOpenSafe) {
      const dismissedAt =
        typeof window !== "undefined" ? localStorage.getItem("chatter-pwa-install-dismissed") : null;
      if (!dismissedAt) setVisible(true);
    }
  }, [needsAddToHomeScreenSafe, installSheetOpenSafe, visible]);

  React.useEffect(() => {
    if (canInstallSafe && isInstallableSafe) setVisible(true);
  }, [canInstallSafe, isInstallableSafe]);

  const shouldShow = !isStandaloneSafe && (showNativeInstall || showIosGuidance);

  if (DISABLE_PWA_BANNER) return null;

  const handleInstall = () => {
    if (promptInstallSafe) promptInstallSafe();
    dismissInstallSafe();
    setInstallSheetOpenSafe(false);
  };

  const handleDismiss = () => {
    setVisible(false);
    dismissInstallSafe();
    setInstallSheetOpenSafe(false);
  };

  if (!shouldShow) return null;

  /* iOS Safari: Add to Home Screen guidance (no native install prompt) */
  if (showIosGuidance) {
    const iosContent = (
      <>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold text-white">Add to Home Screen</h3>
            <p className="mt-1 text-sm leading-snug text-white/65">
              Install for app-style access and notifications. Tap the Share button below, then &quot;Add to Home Screen&quot;.
            </p>
          </div>
          {installSheetOpenSafe && (
            <button
              type="button"
              onClick={handleDismiss}
              className="shrink-0 rounded-lg p-1.5 text-white/50 hover:bg-white/10 hover:text-white"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
        <div className="mt-4 flex items-center gap-3 rounded-xl bg-white/5 px-3 py-2.5 text-sm text-white/80">
          <Share className="h-5 w-5 shrink-0 text-[hsl(330,90%,65%)]" />
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
    );
    if (isMobile) {
      return (
        <div
          className="fixed left-0 right-0 z-[89] md:hidden"
          style={{ bottom: "calc(72px + env(safe-area-inset-bottom, 0px))" }}
        >
          <div
            className="mx-3 rounded-2xl border border-white/10 bg-black/95 shadow-2xl backdrop-blur-xl"
            style={{
              boxShadow: "0 0 0 1px rgba(255,255,255,0.06), 0 -4px 24px rgba(0,0,0,0.3), 0 0 40px -8px rgba(236,72,153,0.12)",
            }}
            role="dialog"
            aria-label="Add to Home Screen"
          >
            <div className="p-4">{iosContent}</div>
          </div>
        </div>
      );
    }
    return (
      <div className="fixed bottom-6 right-6 z-[89] hidden w-[360px] md:block" role="dialog" aria-label="Add to Home Screen">
        <div
          className="rounded-2xl border border-white/10 bg-black/95 p-4 shadow-2xl backdrop-blur-xl"
          style={{
            boxShadow: "0 0 0 1px rgba(255,255,255,0.06), 0 24px 48px -12px rgba(0,0,0,0.5), 0 0 60px -16px rgba(236,72,153,0.08)",
          }}
        >
          {iosContent}
        </div>
      </div>
    );
  }

  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold text-white">Install app</h3>
          <p className="mt-1 text-sm leading-snug text-white/65">
            Get faster access, app-style navigation, and real-time alerts.
          </p>
        </div>
        {installSheetOpenSafe && (
          <button
            type="button"
            onClick={handleDismiss}
            className="shrink-0 rounded-lg p-1.5 text-white/50 hover:bg-white/10 hover:text-white"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>
      <div className="mt-4 flex gap-3">
        <button
          type="button"
          onClick={handleInstall}
          className="flex-1 rounded-xl bg-[hsl(330,80%,55%)] px-4 py-3 text-sm font-semibold text-white shadow-[0_0_20px_-4px_rgba(236,72,153,0.4)] transition hover:bg-[hsl(330,82%,58%)]"
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
    </>
  );

  /* Mobile: bottom sheet above bottom nav */
  if (isMobile) {
    return (
      <div
        className="fixed left-0 right-0 z-[89] md:hidden"
        style={{
          bottom: "calc(72px + env(safe-area-inset-bottom, 0px))",
        }}
      >
        <div
          className="mx-3 rounded-2xl border border-white/10 bg-black/95 shadow-2xl backdrop-blur-xl"
          style={{
            boxShadow: "0 0 0 1px rgba(255,255,255,0.06), 0 -4px 24px rgba(0,0,0,0.3), 0 0 40px -8px rgba(236,72,153,0.12)",
          }}
          role="dialog"
          aria-label="Install app"
        >
          <div className="p-4">{content}</div>
        </div>
      </div>
    );
  }

  /* Desktop: subtle top-right card */
  return (
    <div
      className="fixed right-4 top-4 z-[89] hidden w-[360px] md:block"
      role="dialog"
      aria-label="Install app"
    >
      <div
        className="rounded-2xl border border-white/10 bg-black/95 p-4 shadow-2xl backdrop-blur-xl"
        style={{
          boxShadow: "0 0 0 1px rgba(255,255,255,0.06), 0 24px 48px -12px rgba(0,0,0,0.5), 0 0 60px -16px rgba(236,72,153,0.08)",
        }}
      >
        {content}
      </div>
    </div>
  );
}
