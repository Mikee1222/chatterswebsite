"use client";

import * as React from "react";
import { Check, X } from "lucide-react";
import type { SocialAccount } from "@/services/marketing";

const PLATFORM_ICONS: Record<string, string> = {
  Instagram: "📸",
  Facebook: "👥",
  TikTok: "🎵",
  Twitter: "🐦",
  YouTube: "▶️",
  Snapchat: "👻",
  Telegram: "✈️",
  GetMyLinks: "🔗",
  Other: "📱",
};

export type VAShadowbanReportModalProps = {
  open: boolean;
  onClose: () => void;
  vaAccounts: SocialAccount[];
};

export function VAShadowbanReportModal({ open, onClose, vaAccounts }: VAShadowbanReportModalProps) {
  const [selectedAccount, setSelectedAccount] = React.useState<SocialAccount | null>(null);
  const [reportType, setReportType] = React.useState<"shadowbanned" | "banned">("shadowbanned");
  const [screenshot, setScreenshot] = React.useState<File | null>(null);
  const [notes, setNotes] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [success, setSuccess] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const screenshotPreviewUrl = React.useMemo(
    () => (screenshot ? URL.createObjectURL(screenshot) : null),
    [screenshot],
  );
  React.useEffect(() => {
    return () => {
      if (screenshotPreviewUrl) URL.revokeObjectURL(screenshotPreviewUrl);
    };
  }, [screenshotPreviewUrl]);

  React.useEffect(() => {
    if (!open) return;
    function onPaste(e: ClipboardEvent) {
      const item = Array.from(e.clipboardData?.items ?? []).find((i) => i.type.startsWith("image/"));
      if (item) {
        const f = item.getAsFile();
        if (f) setScreenshot(f);
      }
    }
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [open]);

  function handleClose() {
    setSelectedAccount(null);
    setReportType("shadowbanned");
    setScreenshot(null);
    setNotes("");
    setSuccess(false);
    setSubmitError(null);
    onClose();
  }

  async function handleSubmit() {
    if (!selectedAccount || !screenshot) return;
    setSubmitting(true);
    setSubmitError(null);
    const fd = new FormData();
    fd.append("account_id", selectedAccount.account_id);
    fd.append("model_id", selectedAccount.model_id);
    fd.append("model_name", selectedAccount.model_name);
    fd.append("platform", selectedAccount.platform);
    fd.append("username", selectedAccount.username);
    fd.append("report_type", reportType);
    fd.append("notes", notes);
    fd.append("screenshot", screenshot);
    try {
      const res = await fetch("/api/va/marketing/report-shadowban", {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || "Request failed");
      }
      setSuccess(true);
      setTimeout(handleClose, 2000);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Submit failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[108] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-3xl border border-white/15 bg-[#0f0f1a] p-6 shadow-2xl">
        {success ? (
          <div className="py-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-500/20">
              <Check className="h-8 w-8 text-green-400" />
            </div>
            <p className="text-lg font-bold text-white">Report submitted!</p>
            <p className="mt-1 text-sm text-white/40">Admin will review shortly</p>
          </div>
        ) : (
          <>
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-white">Report Account Issue</h3>
                <p className="mt-0.5 text-xs text-white/40">Admin will review and update status</p>
              </div>
              <button type="button" onClick={handleClose} className="text-white/30 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mb-4">
              <label className="mb-2 block text-xs uppercase tracking-widest text-white/40">Issue Type</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setReportType("shadowbanned")}
                  className={`rounded-xl border py-3 text-sm font-semibold transition-all ${
                    reportType === "shadowbanned"
                      ? "border-amber-500/30 bg-amber-500/20 text-amber-400"
                      : "border-white/10 bg-white/[0.05] text-white/40 hover:bg-white/[0.08]"
                  }`}
                >
                  ⚠️ Shadowbanned
                </button>
                <button
                  type="button"
                  onClick={() => setReportType("banned")}
                  className={`rounded-xl border py-3 text-sm font-semibold transition-all ${
                    reportType === "banned"
                      ? "border-red-500/30 bg-red-500/20 text-red-400"
                      : "border-white/10 bg-white/[0.05] text-white/40 hover:bg-white/[0.08]"
                  }`}
                >
                  🚫 Banned
                </button>
              </div>
            </div>

            <div className="mb-4">
              <label className="mb-2 block text-xs uppercase tracking-widest text-white/40">Account *</label>
              {vaAccounts.length > 0 ? (
                <div className="max-h-40 space-y-2 overflow-y-auto">
                  {vaAccounts.map((acc) => (
                    <button
                      key={acc.id}
                      type="button"
                      onClick={() => setSelectedAccount(acc)}
                      className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-all ${
                        selectedAccount?.id === acc.id
                          ? "border-pink-500/25 bg-pink-500/15"
                          : "border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.05]"
                      }`}
                    >
                      <span className="text-xl">{PLATFORM_ICONS[acc.platform] ?? "📱"}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-white">@{acc.username}</p>
                        <p className="truncate text-xs text-white/40">
                          {acc.platform} · {acc.model_name}
                        </p>
                      </div>
                      {selectedAccount?.id === acc.id ? <Check className="h-4 w-4 shrink-0 text-pink-400" /> : null}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="rounded-xl bg-white/[0.03] py-4 text-center text-sm text-white/30">
                  No accounts assigned to you
                </p>
              )}
            </div>

            <div className="mb-4">
              <label className="mb-2 block text-xs uppercase tracking-widest text-white/40">
                Screenshot * <span className="normal-case text-white/25">(paste Ctrl+V anywhere)</span>
              </label>
              <div
                role="button"
                tabIndex={0}
                onClick={() => fileRef.current?.click()}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") fileRef.current?.click();
                }}
                className={`cursor-pointer rounded-2xl border-2 border-dashed p-4 text-center transition-all ${
                  screenshot
                    ? "border-green-500/30 bg-green-500/5"
                    : "border-white/15 hover:border-amber-500/40 hover:bg-amber-500/5"
                }`}
              >
                {screenshot && screenshotPreviewUrl ? (
                  <div>
                    <img
                      src={screenshotPreviewUrl}
                      alt=""
                      className="mx-auto mb-2 max-h-24 rounded-xl object-contain"
                    />
                    <p className="text-xs text-green-400">✓ {screenshot.name}</p>
                  </div>
                ) : (
                  <>
                    <p className="mb-1 text-2xl">📋</p>
                    <p className="text-sm text-white/30">Paste or click to upload</p>
                  </>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => setScreenshot(e.target.files?.[0] ?? null)}
                />
              </div>
            </div>

            <div className="mb-5">
              <label className="mb-2 block text-xs uppercase tracking-widest text-white/40">Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="What did you notice?"
                className="w-full resize-none rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-white/20 focus:border-amber-500/50 focus:outline-none"
              />
            </div>

            {submitError ? <p className="mb-3 text-center text-xs text-red-400">{submitError}</p> : null}

            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={!selectedAccount || !screenshot || submitting}
              className={`w-full rounded-2xl border py-3.5 text-sm font-bold transition-all disabled:opacity-40 ${
                reportType === "banned"
                  ? "border-red-500/30 bg-red-500/20 text-red-400 hover:bg-red-500/30"
                  : "border-amber-500/30 bg-amber-500/20 text-amber-400 hover:bg-amber-500/30"
              }`}
            >
              {submitting
                ? "Submitting..."
                : reportType === "banned"
                  ? "🚫 Report as Banned"
                  : "⚠️ Report as Shadowbanned"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
