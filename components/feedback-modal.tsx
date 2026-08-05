"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { CheckCircle2, Upload, X } from "lucide-react";
import { useIsSupabaseBackend } from "@/contexts/data-backend-context";
import { uploadFilesToSupabaseStorage } from "@/lib/client-direct-storage-upload";

type FeedbackType = "bug" | "suggestion" | "other";

export function FeedbackModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const isSupabase = useIsSupabaseBackend();
  const [type, setType] = React.useState<FeedbackType>("bug");
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [files, setFiles] = React.useState<File[]>([]);
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
      setType("bug");
      setTitle("");
      setDescription("");
      setFiles([]);
      onClose();
    }, 2000);
    return () => window.clearTimeout(t);
  }, [success, onClose]);

  if (!open) return null;

  const titlePlaceholder =
    type === "bug"
      ? "What broke? Short summary..."
      : type === "suggestion"
        ? "What should we improve?"
        : "What would you like to report?";
  const descriptionPlaceholder =
    type === "bug"
      ? "Steps to reproduce, expected vs actual behavior..."
      : type === "suggestion"
        ? "Describe your idea and why it helps..."
        : "Describe your feedback...";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    if (!title.trim() || !description.trim()) {
      setError("Please fill in title and description.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("type", type);
      fd.append("title", title.trim());
      fd.append("description", description.trim());
      fd.append("page", pathname || "");
      if (files.length > 0) {
        if (isSupabase) {
          const uploaded = await uploadFilesToSupabaseStorage(files, "feedback");
          for (const u of uploaded) fd.append("screenshot_url", u.sbUrl);
        } else {
          for (const f of files) fd.append("screenshots", f);
        }
      }
      const res = await fetch("/api/feedback", {
        method: "POST",
        body: fd,
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(json.error || "Could not submit feedback.");
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
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
        className="relative z-10 max-h-[min(90vh,100dvh)] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/10 bg-[#0f0f1a] p-6"
        style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
      >
        {success ? (
          <div className="flex min-h-[240px] flex-col items-center justify-center text-center">
            <CheckCircle2 className="h-12 w-12 text-green-400" />
            <h2 className="mt-3 text-lg font-semibold text-white">Thank you for your feedback!</h2>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-white">Report a bug or suggestion</h2>
                <p className="mt-1 text-xs text-white/45">{pathname || "/"}</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-white/10 bg-white/5 p-1.5 text-white/60 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {([
                ["bug", "Bug report", "text-red-400 bg-red-500/20 border-red-500/30"],
                ["suggestion", "Suggestion", "text-amber-400 bg-amber-500/20 border-amber-500/30"],
                ["other", "Other", "text-sky-400 bg-sky-500/20 border-sky-500/30"],
              ] as const).map(([value, label, activeCls]) => {
                const active = type === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setType(value)}
                    className={`rounded-xl border px-3 py-2 text-sm transition ${
                      active ? activeCls : "border-white/10 bg-white/5 text-white/50"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={titlePlaceholder}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-white placeholder:text-white/35"
            />

            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={descriptionPlaceholder}
              className="w-full resize-y rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-white placeholder:text-white/35"
            />

            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/20 bg-white/[0.03] px-4 py-3 text-sm text-white/70 hover:bg-white/5"
            >
              <Upload className="h-4 w-4" />
              Add screenshots
            </button>
            {files.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                <span className="text-xs text-white/55">{files.length} file(s):</span>
                {files.map((f) => (
                  <span key={`${f.name}-${f.size}`} className="rounded-full border border-white/15 bg-white/10 px-2 py-0.5 text-xs text-white/75">
                    {f.name}
                  </span>
                ))}
              </div>
            ) : null}

            {error ? <p className="text-sm text-red-400">{error}</p> : null}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 px-4 py-2.5 font-medium text-white disabled:opacity-50"
            >
              {loading ? "Sending..." : "Submit feedback"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

