/**
 * Client-side helper for privacy-respecting apply-flow analytics.
 * Uses a tab-scoped session UUID (not tied to PII).
 */

"use client";

import type {
  ApplicationFunnelStepName,
  ApplicationLinkDeviceType,
  ApplicationLinkEventType,
} from "@/lib/application-link-analytics-types";

const STORAGE_KEY = (slug: string) => `apply_analytics:${slug}`;
const SENT_KEY = (slug: string, event: string, step?: string) =>
  `apply_analytics_sent:${slug}:${event}${step ? `:${step}` : ""}`;

function clientDeviceType(): ApplicationLinkDeviceType {
  if (typeof navigator === "undefined") return "unknown";
  const ua = navigator.userAgent.toLowerCase();
  if (/ipad|tablet|kindle|playbook|silk|(android(?!.*mobile))/.test(ua)) return "tablet";
  if (/mobi|iphone|ipod|android.*mobile|windows phone/.test(ua)) return "mobile";
  if (typeof window !== "undefined" && window.matchMedia("(max-width: 768px)").matches) {
    return "mobile";
  }
  return "desktop";
}

function newSessionId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `a_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function getOrCreateApplyAnalyticsSessionId(slug: string): string {
  try {
    const existing = sessionStorage.getItem(STORAGE_KEY(slug));
    if (existing) return existing;
    const id = newSessionId();
    sessionStorage.setItem(STORAGE_KEY(slug), id);
    return id;
  } catch {
    return newSessionId();
  }
}

function markSent(slug: string, event: string, step?: string) {
  try {
    sessionStorage.setItem(SENT_KEY(slug, event, step), "1");
  } catch {
    /* ignore */
  }
}

function wasSent(slug: string, event: string, step?: string): boolean {
  try {
    return sessionStorage.getItem(SENT_KEY(slug, event, step)) === "1";
  } catch {
    return false;
  }
}

export async function trackApplyAnalyticsEvent(
  slug: string,
  eventType: ApplicationLinkEventType,
  opts?: {
    stepName?: ApplicationFunnelStepName | string | null;
    once?: boolean;
    keepalive?: boolean;
  },
): Promise<void> {
  const once = opts?.once !== false;
  const step = opts?.stepName ?? undefined;
  if (once && wasSent(slug, eventType, step ?? undefined)) return;

  const sessionId = getOrCreateApplyAnalyticsSessionId(slug);
  const payload = {
    action: "track" as const,
    session_id: sessionId,
    event_type: eventType,
    step_name: step ?? null,
    device_type: clientDeviceType(),
    referrer: typeof document !== "undefined" ? document.referrer || null : null,
  };

  try {
    const res = await fetch(`/api/apply/${encodeURIComponent(slug)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: opts?.keepalive === true,
    });
    if (res.ok && once) markSent(slug, eventType, step ?? undefined);
  } catch {
    /* ignore — analytics must never block apply */
  }
}

/** Fire-and-forget abandon via sendBeacon when available. */
export function trackApplyAbandonedBeacon(
  slug: string,
  lastStep: string | null,
): void {
  if (wasSent(slug, "submitted") || wasSent(slug, "abandoned")) return;
  if (!wasSent(slug, "started") && !wasSent(slug, "page_view")) return;

  const sessionId = getOrCreateApplyAnalyticsSessionId(slug);
  const payload = JSON.stringify({
    action: "track",
    session_id: sessionId,
    event_type: "abandoned",
    step_name: lastStep,
    device_type: clientDeviceType(),
    referrer: typeof document !== "undefined" ? document.referrer || null : null,
  });

  try {
    const url = `/api/apply/${encodeURIComponent(slug)}`;
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      const blob = new Blob([payload], { type: "application/json" });
      if (navigator.sendBeacon(url, blob)) {
        markSent(slug, "abandoned", lastStep ?? undefined);
        return;
      }
    }
  } catch {
    /* fall through */
  }

  void trackApplyAnalyticsEvent(slug, "abandoned", {
    stepName: lastStep,
    once: true,
    keepalive: true,
  });
}

export function phaseToAnalyticsStep(
  phase: string,
): ApplicationFunnelStepName | string | null {
  if (
    phase === "cognitive_screening" ||
    phase === "eq_screening" ||
    phase === "typing_speed_test" ||
    phase === "application_form"
  ) {
    return phase;
  }
  if (phase === "language" || phase === "agreement" || phase === "intro") {
    return phase;
  }
  return null;
}
