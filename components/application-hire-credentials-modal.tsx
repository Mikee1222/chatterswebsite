"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Eye, EyeOff, PartyPopper, X } from "lucide-react";
import { toast } from "sonner";
import { ApplyButton } from "@/components/application-ui-buttons";
import { APPLY_INPUT, APPLY_SECTION, APPLY_EYEBROW } from "@/lib/application-ui-tokens";
import { cn } from "@/lib/utils";

function maskHirePassword(password: string): string {
  if (!password) return "••••••••";
  return "•".repeat(Math.min(Math.max(password.length, 8), 16));
}
export type HireCredentialsPayload = {
  username: string;
  password: string;
  created: boolean;
};

type Props = {
  formId: string;
  responseId: string;
  open: boolean;
  credentials: HireCredentialsPayload | null;
  onClose: () => void;
};

async function copyText(label: string, value: string) {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(`${label} copied`);
  } catch {
    toast.error(`Could not copy ${label.toLowerCase()}`);
  }
}

export function ApplicationHireCredentialsModal({
  formId,
  responseId,
  open,
  credentials,
  onClose,
}: Props) {
  const [revealed, setRevealed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [password, setPassword] = useState(credentials?.password ?? "");

  useEffect(() => {
    setPassword(credentials?.password ?? "");
    setRevealed(false);
  }, [credentials?.password, credentials?.username]);

  if (!open || !credentials) return null;

  const username = credentials.username;
  const displayPassword = revealed ? password : maskHirePassword(password || "••••••••••••");

  async function reveal() {
    if (revealed) {
      setRevealed(false);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(
        `/api/admin/application-forms/${formId}/responses/${responseId}/hire/reveal`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "revealed", field: "password" }),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Reveal failed");
      if (typeof data.password === "string") setPassword(data.password);
      setRevealed(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Reveal failed");
    } finally {
      setBusy(false);
    }
  }

  async function copyField(field: "username" | "password") {
    setBusy(true);
    try {
      if (field === "username") {
        await fetch(
          `/api/admin/application-forms/${formId}/responses/${responseId}/hire/reveal`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "copied", field: "username" }),
          },
        ).catch(() => undefined);
        await copyText("Username", username);
        return;
      }
      const res = await fetch(
        `/api/admin/application-forms/${formId}/responses/${responseId}/hire/reveal`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "copied", field: "password" }),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Copy failed");
      const pwd = typeof data.password === "string" ? data.password : password;
      if (pwd) setPassword(pwd);
      await copyText("Password", pwd);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Copy failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[120] flex items-end justify-center bg-black/70 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="hire-creds-title"
      onClick={onClose}
    >
      <div
        className={cn(
          APPLY_SECTION,
          "relative w-full max-w-md border-[#D4AF8C]/35 bg-[#0D0B0D] p-5 shadow-[0_0_60px_-12px_rgba(212,175,140,0.45)]",
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 rounded-lg p-1.5 text-white/40 hover:bg-white/5 hover:text-white/80"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-2">
          <PartyPopper className="h-5 w-5 text-[#D4AF8C]" aria-hidden />
          <p className={APPLY_EYEBROW}>Hired</p>
        </div>
        <h2 id="hire-creds-title" className="mt-2 text-xl font-semibold text-white">
          {credentials.created ? "Credentials generated" : "Existing hire credentials"}
        </h2>
        <p className="mt-1 text-sm text-white/50">
          Cosmetic Gunzo username — not a real email account. Password is encrypted at rest.
        </p>

        <div className="mt-5 space-y-3">
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/35">
              Username
            </label>
            <div className="mt-1.5 flex gap-2">
              <input
                readOnly
                value={username}
                className={cn(APPLY_INPUT, "min-h-[44px] flex-1 py-2 text-sm")}
              />
              <ApplyButton
                variant="adminSecondary"
                disabled={busy}
                iconLeft={<Copy className="h-3.5 w-3.5" />}
                onClick={() => void copyField("username")}
              >
                Copy
              </ApplyButton>
            </div>
          </div>

          <div>
            <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/35">
              Password
            </label>
            <div className="mt-1.5 flex gap-2">
              <input
                readOnly
                value={displayPassword}
                className={cn(
                  APPLY_INPUT,
                  "min-h-[44px] flex-1 py-2 font-mono text-sm tracking-wide",
                )}
              />
              <ApplyButton
                variant="adminSecondary"
                disabled={busy}
                iconLeft={
                  revealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />
                }
                onClick={() => void reveal()}
              >
                {revealed ? "Hide" : "Reveal"}
              </ApplyButton>
              <ApplyButton
                variant="adminSecondary"
                disabled={busy}
                iconLeft={<Copy className="h-3.5 w-3.5" />}
                onClick={() => void copyField("password")}
              >
                Copy
              </ApplyButton>
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <ApplyButton
            variant="adminPrimary"
            iconLeft={<Check className="h-3.5 w-3.5" />}
            onClick={onClose}
          >
            Done
          </ApplyButton>
        </div>
      </div>
    </div>
  );
}

export async function hireCandidateRequest(
  formId: string,
  responseId: string,
): Promise<HireCredentialsPayload & { response: unknown }> {
  const res = await fetch(
    `/api/admin/application-forms/${formId}/responses/${responseId}/hire`,
    { method: "POST" },
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Hire failed");
  return {
    username: String(data.username ?? ""),
    password: String(data.password ?? ""),
    created: Boolean(data.created),
    response: data.response,
  };
}
