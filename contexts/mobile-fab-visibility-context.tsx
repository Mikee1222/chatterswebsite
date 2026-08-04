"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useState,
  type ReactNode,
} from "react";

interface MobileFabVisibilityContextType {
  isHidden: boolean;
  setIsHidden: (hidden: boolean) => void;
  isVisible: boolean;
  setIsVisible: (visible: boolean) => void;
  registerOverlay: (id: string) => void;
  unregisterOverlay: (id: string) => void;
}

const MobileFabVisibilityContext = createContext<MobileFabVisibilityContextType | undefined>(
  undefined
);

/** True when a fixed/portal dialog/modal is present in the document. */
function documentHasMobileChromeHidingOverlay(): boolean {
  if (typeof document === "undefined") return false;
  const nodes = document.querySelectorAll(
    '[data-mobile-chrome-hide],[aria-modal="true"],[role="dialog"],[role="alertdialog"]'
  );
  for (const node of nodes) {
    if (!(node instanceof HTMLElement)) continue;
    if (node.closest("[data-mobile-chrome-ignore]")) continue;
    if (node.hasAttribute("hidden") || node.getAttribute("aria-hidden") === "true") continue;
    const style = window.getComputedStyle(node);
    if (style.display === "none" || style.visibility === "hidden") continue;

    let el: HTMLElement | null = node;
    while (el) {
      if (window.getComputedStyle(el).position === "fixed") return true;
      el = el.parentElement;
    }
  }
  return false;
}

/**
 * Tracks whether mobile chrome (bottom nav + FAB) should hide.
 * Sources (any one hides chrome):
 * - Manual `setIsHidden` (legacy, e.g. shift overlays)
 * - Explicit overlay registration via `useRegisterMobileOverlay`
 * - DOM presence of dialog / aria-modal / data-mobile-chrome-hide nodes
 */
export function MobileFabVisibilityProvider({ children }: { children: ReactNode }) {
  const [manualHidden, setManualHidden] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [registeredIds, setRegisteredIds] = useState<ReadonlySet<string>>(() => new Set());
  const [bodyOverlayPresent, setBodyOverlayPresent] = useState(false);

  const registerOverlay = useCallback((id: string) => {
    setRegisteredIds((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  const unregisterOverlay = useCallback((id: string) => {
    setRegisteredIds((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  useEffect(() => {
    let raf = 0;
    const sync = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        setBodyOverlayPresent(documentHasMobileChromeHidingOverlay());
      });
    };
    sync();
    const mo = new MutationObserver(sync);
    mo.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: [
        "aria-modal",
        "role",
        "class",
        "style",
        "hidden",
        "aria-hidden",
        "data-mobile-chrome-hide",
      ],
    });
    return () => {
      mo.disconnect();
      cancelAnimationFrame(raf);
    };
  }, []);

  const isHidden = manualHidden || registeredIds.size > 0 || bodyOverlayPresent;

  const value = useMemo(
    () => ({
      isHidden,
      setIsHidden: setManualHidden,
      isVisible,
      setIsVisible,
      registerOverlay,
      unregisterOverlay,
    }),
    [isHidden, isVisible, registerOverlay, unregisterOverlay]
  );

  return (
    <MobileFabVisibilityContext.Provider value={value}>{children}</MobileFabVisibilityContext.Provider>
  );
}

export function useMobileFabHidden(): boolean {
  const context = useContext(MobileFabVisibilityContext);
  if (context === undefined) {
    throw new Error("useMobileFabHidden must be used within MobileFabVisibilityProvider");
  }
  return context.isHidden;
}

export function useMobileFabVisibility() {
  const context = useContext(MobileFabVisibilityContext);
  if (context === undefined) {
    throw new Error("useMobileFabVisibility must be used within MobileFabVisibilityProvider");
  }
  return {
    isVisible: context.isVisible,
    setIsVisible: context.setIsVisible,
    setMobileFabHidden: context.setIsHidden,
  };
}

/**
 * Registers an open modal/overlay so mobile bottom nav + FAB hide for the duration.
 * Safe no-op when used outside MobileFabVisibilityProvider (e.g. isolated stories).
 */
export function useRegisterMobileOverlay(open: boolean) {
  const context = useContext(MobileFabVisibilityContext);
  const id = useId();

  useEffect(() => {
    if (!context || !open) return;
    context.registerOverlay(id);
    return () => context.unregisterOverlay(id);
  }, [context, open, id]);
}
