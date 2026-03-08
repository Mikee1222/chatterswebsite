"use client";

import * as React from "react";

const INSTALL_DISMISSED_KEY = "chatter-pwa-install-dismissed";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/** Standalone = already running as installed PWA (don't show install). Safari-safe: guard window and matchMedia. */
function getIsStandalone(): boolean {
  if (typeof window === "undefined") return false;
  if (typeof navigator === "undefined") return false;
  try {
    if (typeof window.matchMedia === "function") {
      if (window.matchMedia("(display-mode: standalone)").matches) return true;
    }
    return (navigator as { standalone?: boolean }).standalone === true;
  } catch {
    return false;
  }
}

/** iOS Safari: no beforeinstallprompt; show Add to Home Screen guidance instead. Safari-safe: guard navigator. */
function getNeedsAddToHomeScreen(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  try {
    const ua = navigator.userAgent ?? "";
    const isIos = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const isSafari = /Safari/.test(ua) && !/Chrome|CriOS|FxiOS/.test(ua);
    return isIos && isSafari && !getIsStandalone();
  } catch {
    return false;
  }
}

type PwaContextValue = {
  /** True when install banner should auto-show (installable and not recently dismissed). */
  isInstallable: boolean;
  /** True when browser has offered install (so we can show "Install app" in More/settings). */
  canInstall: boolean;
  /** True when already running as installed PWA – do not show install. */
  isStandalone: boolean;
  /** True on iOS Safari when install not available – show Add to Home Screen guidance. */
  needsAddToHomeScreen: boolean;
  promptInstall: (() => void) | null;
  dismissInstall: () => void;
  /** Open install prompt from More/settings (shows even if user previously dismissed). */
  installSheetOpen: boolean;
  setInstallSheetOpen: (open: boolean) => void;
};

/** Safe defaults so consumers never see undefined. Used when context is missing or not ready. */
const DEFAULT_PWA_VALUE: PwaContextValue = {
  isInstallable: false,
  canInstall: false,
  isStandalone: false,
  needsAddToHomeScreen: false,
  promptInstall: null,
  dismissInstall: () => {},
  installSheetOpen: false,
  setInstallSheetOpen: () => {},
};

const PwaContext = React.createContext<PwaContextValue>(DEFAULT_PWA_VALUE);

export function usePwa(): PwaContextValue {
  const value = React.useContext(PwaContext);
  return value ?? DEFAULT_PWA_VALUE;
}

export function PwaProvider({ children }: { children: React.ReactNode }) {
  const [hasInstallPrompt, setHasInstallPrompt] = React.useState(false);
  const [installPrompt, setInstallPrompt] = React.useState<(() => void) | null>(null);
  const [dismissed, setDismissed] = React.useState(true);
  const [installSheetOpen, setInstallSheetOpen] = React.useState(false);
  const [isStandalone, setIsStandalone] = React.useState(false);
  const [needsAddToHomeScreen, setNeedsAddToHomeScreen] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const dismissedAt = localStorage.getItem(INSTALL_DISMISSED_KEY);
    if (dismissedAt) {
      const t = parseInt(dismissedAt, 10);
      if (Date.now() - t < 7 * 24 * 60 * 60 * 1000) setDismissed(true);
      else setDismissed(false);
    } else {
      setDismissed(false);
    }
  }, []);

  React.useEffect(() => {
    if (typeof window === "undefined" || !("addEventListener" in window)) return;
    const handler = (e: Event) => {
      const ev = e as BeforeInstallPromptEvent;
      ev.preventDefault();
      setInstallPrompt(() => () => {
        ev.prompt();
      });
      setHasInstallPrompt(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const dismissInstall = React.useCallback(() => {
    setDismissed(true);
    setInstallSheetOpen(false);
    if (typeof window !== "undefined") {
      localStorage.setItem(INSTALL_DISMISSED_KEY, String(Date.now()));
    }
  }, []);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    setIsStandalone(getIsStandalone());
    setNeedsAddToHomeScreen(getNeedsAddToHomeScreen());
  }, []);

  React.useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        if (process.env.NODE_ENV !== "production") {
          console.log("[PWA] Service worker registered: yes", reg.scope);
        }
      })
      .catch((err) => {
        if (process.env.NODE_ENV !== "production") {
          console.warn("[PWA] Service worker registered: no", err);
        }
      });
  }, []);

  const canInstallNow = Boolean(hasInstallPrompt && !dismissed && !isStandalone);

  const value: PwaContextValue = React.useMemo(() => {
    const out: PwaContextValue = {
      canInstall: hasInstallPrompt,
      isStandalone,
      needsAddToHomeScreen,
      promptInstall: installPrompt,
      dismissInstall,
      installSheetOpen,
      setInstallSheetOpen,
    } as PwaContextValue;
    out.isInstallable = canInstallNow;
    return out;
  }, [canInstallNow, hasInstallPrompt, dismissed, isStandalone, needsAddToHomeScreen, installPrompt, dismissInstall, installSheetOpen]);

  return <PwaContext.Provider value={value}>{children}</PwaContext.Provider>;
}
