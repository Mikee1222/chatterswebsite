"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, Upload, X } from "lucide-react";
import { CHATTER_ATTACHMENT_MAX_BYTES } from "@/lib/chatter-attachment-constants";

export type ChatterModalModelOption = { id: string; name: string };

export function RebillModal({
  open,
  onClose,
  models,
}: {
  open: boolean;
  onClose: () => void;
  models: ChatterModalModelOption[];
}) {
  const [modelId, setModelId] = React.useState("");
  const [subUsername, setSubUsername] = React.useState("");
  const [file, setFile] = React.useState<File | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setError(null);
  }, [open]);

  React.useEffect(() => {
    if (!success) return;
    const t = window.setTimeout(() => {
      setSuccess(false);
      setModelId("");
      setSubUsername("");
      setFile(null);
      onClose();
    }, 2000);
    return () => window.clearTimeout(t);
  }, [success, onClose]);

  if (!open || typeof document === "undefined") return null;

  const selectedModel = models.find((m) => m.id === modelId);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    if (!modelId || !subUsername.trim()) {
      setError("Select a model and enter the subscriber username.");
      return;
    }
    if (models.length === 0) {
      setError("No active models available.");
      return;
    }
    if (file && file.size > CHATTER_ATTACHMENT_MAX_BYTES) {
      setError(`Screenshot must be under ${CHATTER_ATTACHMENT_MAX_BYTES / (1024 * 1024)}MB.`);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("model_id", modelId);
      fd.append("model_name", selectedModel?.name ?? "");
      fd.append("sub_username", subUsername.trim());
      fd.append("sub_type", "paid");
      if (file) fd.append("screenshot", file);
      const res = await fetch("/api/chatter/rebills", {
        method: "POST",
        body: fd,
        credentials: "include",
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(json.error || "Could not log rebill.");
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed.");
    } finally {
      setLoading(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[230] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0"
        onClick={() => {
          if (!loading) onClose();
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        className="relative z-10 w-full max-w-lg rounded-2xl border border-white/10 bg-[#0f0f1a] p-6"
      >
        {success ? (
          <div className="flex min-h-[240px] flex-col items-center justify-center text-center">
            <CheckCircle2 className="h-12 w-12 text-green-400" />
            <h2 className="mt-3 text-lg font-semibold text-white">Rebill logged</h2>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-white">Log a rebill</h2>
                <p className="mt-1 text-xs text-white/45">Subscriber rebill screenshot & details</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-white/10 bg-white/5 p-1.5 text-white/60 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <label className="block text-xs font-medium uppercase tracking-wide text-white/45">
              Model
              <select
                value={modelId}
                onChange={(e) => setModelId(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white"
                required
                disabled={models.length === 0}
              >
                <option value="">{models.length === 0 ? "No active models" : "Select model…"}</option>
                {models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-xs font-medium uppercase tracking-wide text-white/45">
              Subscriber username
              <div className="relative mt-1.5">
                <span className="pointer-events-none absolute left-3 top-1/2 z-[1] -translate-y-1/2 text-white/35">
                  @
                </span>
                <input
                  value={subUsername}
                  onChange={(e) => setSubUsername(e.target.value)}
                  placeholder="username"
                  className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pl-7 pr-4 text-white placeholder:text-white/35"
                  autoComplete="off"
                  required
                />
              </div>
            </label>

            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                setFile(f && f.size > 0 ? f : null);
              }}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/20 bg-white/[0.03] px-4 py-3 text-sm text-white/70 hover:bg-white/5"
            >
              <Upload className="h-4 w-4" />
              {file ? file.name : "Screenshot (optional, max 5MB)"}
            </button>

            {error ? <p className="text-sm text-red-400">{error}</p> : null}

            <button
              type="submit"
              disabled={loading || models.length === 0}
              className="w-full rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 px-4 py-2.5 font-medium text-white disabled:opacity-45"
            >
              {loading ? "Sending…" : "Submit rebill"}
            </button>
          </form>
        )}
      </div>
    </div>,
    document.body
  );
}
