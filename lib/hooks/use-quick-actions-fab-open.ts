"use client";

import * as React from "react";
import { useMobileFabHidden } from "@/contexts/mobile-fab-visibility-context";

/** Absorb ghost/click-through closes after the opening tap (overlay-hide unmount race). */
const CLOSE_GUARD_MS = 1200;

/**
 * Open state for role FABs whose sheet is `role="dialog"` (detected by
 * MobileFabVisibilityProvider's MutationObserver).
 *
 * `dcfd901` kept the sheet mounted while overlay-hide flips, but still unmounted
 * the + button when `fabHiddenByOverlay` became true. That left the opening tap
 * coordinates over sheet links/backdrop → auto-close ~1s later. Keep FAB chrome
 * mounted while open, briefly ignore closes after open, and prefer
 * `data-mobile-chrome-ignore` on the FAB sheet so self-open does not flip overlay-hide.
 */
export function useQuickActionsFabOpen() {
  const [open, setOpen] = React.useState(false);
  const fabHiddenByOverlay = useMobileFabHidden();
  const ignoreCloseUntilRef = React.useRef(0);

  const requestClose = React.useCallback(() => {
    if (Date.now() < ignoreCloseUntilRef.current) return;
    setOpen(false);
  }, []);

  const toggleOpen = React.useCallback(() => {
    setOpen((v) => {
      if (v) {
        if (Date.now() < ignoreCloseUntilRef.current) return v;
        return false;
      }
      ignoreCloseUntilRef.current = Date.now() + CLOSE_GUARD_MS;
      return true;
    });
  }, []);

  // Bottom nav still hides via overlay detection; FAB stays up while our menu is open
  // so overlay-hide does not unmount the hit target under the opening tap.
  const showFabChrome = !fabHiddenByOverlay || open;

  return { open, setOpen, requestClose, toggleOpen, showFabChrome, fabHiddenByOverlay };
}
