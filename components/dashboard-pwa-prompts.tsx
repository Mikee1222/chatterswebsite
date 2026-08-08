"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { PushPermissionPrompt } from "@/components/push-permission-prompt";
import { PwaInstallBanner } from "@/components/pwa-install-banner";
import { ROUTES } from "@/lib/routes";
import type { SessionUser } from "@/types";

const PROMPT_HEIGHT_VAR = "--mobile-bottom-prompt-height";

/** Checklist completion is blocked when fixed prompts cover rows — never show on task pages. */
function isVaTasksChecklistPath(pathname: string | null): boolean {
  if (!pathname) return false;
  const p = pathname.replace(/\/$/, "") || "/";
  return (
    p === ROUTES.va.tasks ||
    p.startsWith(`${ROUTES.va.tasks}/`) ||
    p === ROUTES.admin.vaTasks ||
    p.startsWith(`${ROUTES.admin.vaTasks}/`)
  );
}

function measureBottomPromptHeight(): number {
  if (typeof document === "undefined") return 0;
  if (window.matchMedia("(min-width: 768px)").matches) return 0;
  const dialogs = document.querySelectorAll<HTMLElement>('[role="dialog"]');
  let max = 0;
  for (const el of dialogs) {
    let node: HTMLElement | null = el;
    let fixedHost: HTMLElement | null = null;
    while (node) {
      if (getComputedStyle(node).position === "fixed") {
        fixedHost = node;
        break;
      }
      node = node.parentElement;
    }
    if (!fixedHost) continue;
    const bottom = fixedHost.style.bottom || getComputedStyle(fixedHost).bottom;
    // Only mobile bottom-anchored prompt shells (PWA / push), not top-right desktop cards.
    if (!bottom || bottom === "auto") continue;
    const h = Math.ceil(fixedHost.getBoundingClientRect().height);
    if (h > max) max = h;
  }
  return max;
}

/**
 * Staff dashboard PWA + push prompts.
 *
 * Critical: never stack both fixed bottom banners — they sit at z-89/z-90 above
 * checklist rows and swallow taps (elementFromPoint hits the banner, not the
 * ChampagneCheckbox). Sequence like ClientHomePrompts: install first, then push.
 */
export function DashboardPwaPrompts({ user }: { user: SessionUser }) {
  const pathname = usePathname();
  const suppressForChecklist = isVaTasksChecklistPath(pathname);
  const [pwaBannerVisible, setPwaBannerVisible] = React.useState(false);
  const [pwaReady, setPwaReady] = React.useState(false);
  const [pushVisible, setPushVisible] = React.useState(false);

  const anyPromptVisible = !suppressForChecklist && (pwaBannerVisible || pushVisible);

  React.useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    if (!anyPromptVisible) {
      root.style.setProperty(PROMPT_HEIGHT_VAR, "0px");
      return;
    }

    const apply = () => {
      root.style.setProperty(PROMPT_HEIGHT_VAR, `${measureBottomPromptHeight()}px`);
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(document.body);
    const mo = new MutationObserver(apply);
    mo.observe(document.body, { childList: true, subtree: true });
    return () => {
      ro.disconnect();
      mo.disconnect();
      root.style.setProperty(PROMPT_HEIGHT_VAR, "0px");
    };
  }, [anyPromptVisible, pwaBannerVisible, pushVisible]);

  if (suppressForChecklist) return null;

  return (
    <>
      <PwaInstallBanner
        onVisibleChange={(visible) => {
          setPwaBannerVisible(visible);
          setPwaReady(true);
        }}
      />
      {/* Defer push until install banner is gone so they never stack and block taps. */}
      {pwaReady && !pwaBannerVisible ? (
        <PushPermissionPrompt role={user?.role} onVisibilityChange={setPushVisible} />
      ) : null}
    </>
  );
}
