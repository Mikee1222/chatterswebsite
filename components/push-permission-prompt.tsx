"use client";

import * as React from "react";
import type { UserRole } from "@/types";
import { useNotificationPrompt } from "@/contexts/notification-prompt-context";
import { Check, BellOff } from "lucide-react";

const PERMISSION_DISMISSED_KEY = "chatter-push-permission-dismissed";
const DISMISS_RESHOW_DAYS = 7;

function pushLog(...args: unknown[]) {
  if (process.env.NODE_ENV !== "production") {
    console.log("[Push]", ...args);
  }
}

function getRoleCopy(role?: UserRole | null): string {
  switch (role) {
    case "chatter":
      return "Get alerts for shifts, breaks, whale sessions, and customs.";
    case "virtual_assistant":
      return "Get alerts for mistake shifts, breaks, and assigned work.";
    case "admin":
    case "manager":
      return "Get live operational alerts for shifts, sessions, customs, and activity.";
    default:
      return "Get alerts for shifts, breaks, whale sessions, and custom requests.";
  }
}

export type PushEnableResult =
  | { status: "unsupported"; reason: string }
  | { status: "denied" }
  | { status: "success" }
  | { status: "error"; message: string };

/** Shared push-enable flow: register SW → request permission → subscribe → POST /api/push/subscribe. Logs every step; never fails silently. */
export async function runPushEnableFlow(role?: UserRole | null): Promise<PushEnableResult> {
  pushLog("Button clicked – starting enable flow");

  if (typeof window === "undefined") {
    pushLog("Exit: not in browser (typeof window === 'undefined')");
    return { status: "unsupported", reason: "Not available in this environment." };
  }

  const ua = navigator.userAgent ?? "";
  const isSafari = /Safari/.test(ua) && !/Chrome|CriOS|FxiOS/.test(ua);
  if (isSafari) pushLog("Safari branch detected", { ua: ua.slice(0, 60) });

  if (!window.isSecureContext) {
    pushLog("Exit: insecure context (HTTPS required for push)");
    return { status: "unsupported", reason: "Push requires a secure connection (HTTPS)." };
  }

  if (!("Notification" in window)) {
    pushLog("Exit: notifications not supported (Notification not in window)");
    return { status: "unsupported", reason: "This browser does not support notifications." };
  }

  if (!("serviceWorker" in navigator)) {
    pushLog("Exit: service worker unavailable (serviceWorker not in navigator)");
    return { status: "unsupported", reason: "Service workers are not supported." };
  }

  pushLog("Checking browser support: OK");

  try {
    pushLog("Registering service worker…");
    let reg = navigator.serviceWorker.controller ? await navigator.serviceWorker.ready : null;
    if (!reg) {
      reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      await navigator.serviceWorker.ready;
    }
    pushLog("Service worker ready:", !!reg);

    pushLog("Requesting notification permission…");
    const permission = await Notification.requestPermission();
    pushLog("Permission result:", permission);
    if (permission !== "granted") {
      pushLog("Exit: user denied or dismissed permission");
      return { status: "denied" };
    }

    if (!reg.pushManager) {
      pushLog("Exit: pushManager unavailable on registration");
      return { status: "unsupported", reason: "Push is not supported in this browser." };
    }

    pushLog("Fetching VAPID public key…");
    const vapidRes = await fetch("/api/push/vapid-public", { credentials: "include" });
    if (!vapidRes.ok) {
      pushLog("Exit: VAPID key missing or error", vapidRes.status);
      return { status: "error", message: "Server push config missing. Try again later." };
    }
    const { publicKey } = (await vapidRes.json()) as { publicKey?: string };
    if (!publicKey) {
      pushLog("Exit: VAPID key empty in response");
      return { status: "error", message: "Server push config invalid." };
    }
    pushLog("VAPID key received");

    pushLog("Creating push subscription…");
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
    });
    pushLog("Push subscription created:", !!sub?.endpoint);

    const j = sub.toJSON();
    const body = {
      endpoint: j.endpoint,
      keys: j.keys as { p256dh: string; auth: string },
      role: role ?? undefined,
    };
    pushLog("Posting subscription to backend POST /api/push/subscribe…");
    const subscribeRes = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    });

    if (!subscribeRes.ok) {
      const err = await subscribeRes.json().catch(() => ({}));
      const msg = (err as { error?: string }).error || "Failed to save subscription";
      pushLog("Save failure:", subscribeRes.status, msg);
      return { status: "error", message: msg };
    }
    pushLog("Save success – subscription stored on backend");
    return { status: "success" };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    pushLog("Flow error:", e);
    return { status: "error", message };
  }
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

type Props = {
  role?: UserRole | null;
  onSubscribed?: () => void;
};

type Step = "pre-prompt" | "loading" | "success" | "denied" | "unsupported" | "error";

export function PushPermissionPrompt({ role, onSubscribed }: Props) {
  const { isOpenFromSettings, closeNotificationPrompt } = useNotificationPrompt();
  const [show, setShow] = React.useState(false);
  const [step, setStep] = React.useState<Step>("pre-prompt");
  const [stepMessage, setStepMessage] = React.useState<string>("");
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  // When opened from settings, show immediately
  React.useEffect(() => {
    if (isOpenFromSettings && mounted && typeof window !== "undefined" && Notification.permission !== "granted") {
      setShow(true);
      setStep("pre-prompt");
    }
  }, [isOpenFromSettings, mounted]);

  React.useEffect(() => {
    if (!mounted || typeof window === "undefined") return;
    if (!("Notification" in window) || !("serviceWorker" in navigator)) return;
    if (Notification.permission === "granted") return;
    const dismissedAt = localStorage.getItem(PERMISSION_DISMISSED_KEY);
    if (dismissedAt && !isOpenFromSettings) {
      const t = parseInt(dismissedAt, 10);
      if (Date.now() - t < DISMISS_RESHOW_DAYS * 24 * 60 * 60 * 1000) return;
    }
    setShow(true);
    setStep("pre-prompt");
  }, [mounted, isOpenFromSettings]);

  const handleEnable = async () => {
    setStep("loading");
    setStepMessage("");
    const result = await runPushEnableFlow(role);
    if (result.status === "success") {
      setStep("success");
      onSubscribed?.();
    } else if (result.status === "denied") {
      setStep("denied");
    } else if (result.status === "unsupported") {
      setStep("unsupported");
      setStepMessage(result.reason);
    } else {
      setStep("error");
      setStepMessage(result.message);
    }
  };

  const handleDismiss = () => {
    setShow(false);
    closeNotificationPrompt();
    if (typeof window !== "undefined" && step === "pre-prompt") {
      localStorage.setItem(PERMISSION_DISMISSED_KEY, String(Date.now()));
    }
  };

  const handleCloseSuccessOrDenied = () => {
    setShow(false);
    setStep("pre-prompt");
    closeNotificationPrompt();
  };

  if (!show) return null;

  const bodyCopy = getRoleCopy(role);

  /* Success state */
  if (step === "success") {
    return (
      <PromptCard onClose={handleCloseSuccessOrDenied} title="Notifications enabled" showClose>
        <div className="mt-2 flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
            <Check className="h-5 w-5" />
          </span>
          <p className="text-sm text-white/65">You&apos;ll now get real-time alerts.</p>
        </div>
        <button
          type="button"
          onClick={handleCloseSuccessOrDenied}
          className="mt-4 w-full rounded-xl bg-[hsl(330,80%,55%)]/20 py-3 text-sm font-medium text-[hsl(330,90%,70%)]"
        >
          Done
        </button>
      </PromptCard>
    );
  }

  /* Denied state */
  if (step === "denied") {
    return (
      <PromptCard onClose={handleCloseSuccessOrDenied} title="Notifications are off" showClose>
        <div className="mt-2 flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-white/60">
            <BellOff className="h-5 w-5" />
          </span>
          <p className="text-sm text-white/65">
            You can enable them later in your browser or app settings.
          </p>
        </div>
        <button
          type="button"
          onClick={handleCloseSuccessOrDenied}
          className="mt-4 w-full rounded-xl border border-white/20 bg-white/5 py-3 text-sm font-medium text-white/80"
        >
          OK
        </button>
      </PromptCard>
    );
  }

  /* Unsupported state */
  if (step === "unsupported") {
    return (
      <PromptCard onClose={handleCloseSuccessOrDenied} title="Notifications not supported" showClose>
        <p className="mt-2 text-sm text-amber-200/90">{stepMessage || "This browser or context does not support push."}</p>
        <button
          type="button"
          onClick={handleCloseSuccessOrDenied}
          className="mt-4 w-full rounded-xl border border-white/20 bg-white/5 py-3 text-sm font-medium text-white/80"
        >
          OK
        </button>
      </PromptCard>
    );
  }

  /* Error state */
  if (step === "error") {
    return (
      <PromptCard onClose={handleCloseSuccessOrDenied} title="Something went wrong" showClose>
        <p className="mt-2 text-sm text-amber-200/90">{stepMessage || "Could not enable notifications."}</p>
        <button
          type="button"
          onClick={handleCloseSuccessOrDenied}
          className="mt-4 w-full rounded-xl border border-white/20 bg-white/5 py-3 text-sm font-medium text-white/80"
        >
          OK
        </button>
      </PromptCard>
    );
  }

  /* Pre-prompt */
  return (
    <PromptCard
      onClose={handleDismiss}
      title="Enable notifications"
      showClose={isOpenFromSettings}
    >
      <p className="mt-1 text-sm text-white/65">{bodyCopy}</p>
      <div className="mt-4 flex gap-3">
        <button
          type="button"
          onClick={handleEnable}
          disabled={step === "loading"}
          className="flex-1 rounded-xl bg-[hsl(330,80%,55%)] py-3 text-sm font-semibold text-white shadow-[0_0_20px_-4px_rgba(236,72,153,0.4)] transition hover:bg-[hsl(330,82%,58%)] disabled:opacity-70"
        >
          {step === "loading" ? "Enabling…" : "Enable notifications"}
        </button>
        <button
          type="button"
          onClick={handleDismiss}
          className="rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-sm font-medium text-white/80 hover:bg-white/10"
        >
          Not now
        </button>
      </div>
    </PromptCard>
  );
}

function PromptCard({
  title,
  children,
  onClose,
  showClose = false,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  showClose?: boolean;
}) {
  const [isMobile, setIsMobile] = React.useState(false);
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    setIsMobile(window.matchMedia("(max-width: 767px)").matches);
  }, []);

  const card = (
    <div
      className="rounded-2xl border border-white/10 bg-black/95 p-4 shadow-2xl backdrop-blur-xl"
      style={{
        boxShadow: "0 0 0 1px rgba(255,255,255,0.06), 0 24px 48px -12px rgba(0,0,0,0.5), 0 0 60px -16px rgba(236,72,153,0.08)",
      }}
      role="dialog"
      aria-label={title}
    >
      {(showClose || !isMobile) && (
        <div className="mb-2 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-white/50 hover:bg-white/10 hover:text-white"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
      <h3 className="text-base font-semibold text-white">{title}</h3>
      {children}
    </div>
  );

  /* Mobile: bottom sheet above nav */
  if (isMobile) {
    return (
      <div
        className="fixed left-0 right-0 z-[90] px-3 md:hidden"
        style={{ bottom: "calc(72px + env(safe-area-inset-bottom, 0px))" }}
      >
        {card}
      </div>
    );
  }

  /* Desktop: floating card */
  return (
    <div className="fixed bottom-6 right-6 z-[90] hidden w-[380px] md:block">
      {card}
    </div>
  );
}
