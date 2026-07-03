"use client";

import * as React from "react";
import { Check, X } from "lucide-react";
import type { SocialAccount } from "@/services/marketing";
import { PLATFORM_ICONS } from "@/lib/social-platform-config";

export type VARestrictionLiftedModalProps = {
  open: boolean;
  onClose: () => void;
  account: SocialAccount | null;
  onSubmitted?: () => void;
};

export function VARestrictionLiftedModal({
  open,
  onClose,
  account,
  onSubmitted,
}: VARestrictionLiftedModalProps) {
  const [notes, setNotes] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [success, setSuccess] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  function handleClose() {
    setNotes("");
    setSuccess(false);
    setSubmitError(null);
    onClose();
  }

  async function handleSubmit() {
    if (!account) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/va/marketing/report-restriction-lifted", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account_id: account.account_id, notes }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error?.trim() || "Request failed");
      }
      setSuccess(true);
      onSubmitted?.();
      setTimeout(handleClose, 2000);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Submit failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (!open || !account) return null;

  return (
    <div className="fixed inset-0 z-[108] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-3xl border border-white/15 bg-[#0f0f1a] p-6 shadow-2xl">
        {success ? (
          <div className="py-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20">
              <Check className="h-8 w-8 text-emerald-400" />
            </div>
            <p className="text-lg font-bold text-white">Report submitted!</p>
            <p className="mt-1 text-sm text-white/40">Admin will confirm when the account is active again</p>
          </div>
        ) : (
          <>
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-white">Report restriction lifted</h3>
                <p className="mt-0.5 text-xs text-white/40">Admin will verify and restore active status</p>
              </div>
              <button type="button" onClick={handleClose} className="text-white/30 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mb-4 flex items-center gap-3 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2.5">
              <span className="text-xl">{PLATFORM_ICONS[account.platform] ?? ""}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white">@{account.username}</p>
                <p className="truncate text-xs text-white/40">
                  {account.platform} · {account.model_name}
                </p>
              </div>
              <Check className="h-4 w-4 shrink-0 text-emerald-400" />
            </div>

            <div className="mb-5">
              <label className="mb-2 block text-xs uppercase tracking-widest text-white/40">
                Notes <span className="normal-case text-white/25">(optional)</span>
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Anything admin should know?"
                className="w-full resize-none rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-white/20 focus:border-emerald-500/50 focus:outline-none"
              />
            </div>

            {submitError ? <p className="mb-3 text-center text-xs text-red-400">{submitError}</p> : null}

            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={submitting}
              className="w-full rounded-2xl border border-emerald-500/30 bg-emerald-500/15 py-3.5 text-sm font-bold text-emerald-300 transition-all hover:bg-emerald-500/25 disabled:opacity-40"
            >
              {submitting ? "Submitting..." : "Report restriction lifted"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
