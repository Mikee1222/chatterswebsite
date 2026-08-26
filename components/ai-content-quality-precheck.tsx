"use client";

import * as React from "react";
import { Loader2, ScanSearch } from "lucide-react";
import { VA_BTN_SECONDARY, VA_CARD } from "@/lib/va-tasks-tokens";
import { cn } from "@/lib/utils";

type Flag = { code: string; severity: string; message: string };

type Props = {
  fileUrl: string | null | undefined;
  assignmentId?: string | null;
  className?: string;
};

export function AiContentQualityPreCheck({ fileUrl, assignmentId, className }: Props) {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<{
    recommendation: string;
    programmatic: Flag[];
    vision: { summary: string | null; flags: Flag[]; model: string | null };
  } | null>(null);

  async function run() {
    if (!fileUrl?.trim()) {
      setError("No file attached yet");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/ai/content-quality-check", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileUrl,
          assignmentId: assignmentId ?? undefined,
          notifyAdmins: true,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        recommendation?: string;
        programmatic?: Flag[];
        vision?: { summary: string | null; flags: Flag[]; model: string | null };
        error?: string;
      };
      if (!res.ok) throw new Error(data.error || "Pre-check failed");
      setResult({
        recommendation: data.recommendation ?? "ok",
        programmatic: data.programmatic ?? [],
        vision: data.vision ?? { summary: null, flags: [], model: null },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={cn("space-y-2", className)}>
      <button
        type="button"
        onClick={() => void run()}
        disabled={loading || !fileUrl}
        className={cn(VA_BTN_SECONDARY, "inline-flex items-center gap-2 text-xs")}
      >
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ScanSearch className="h-3.5 w-3.5" />}
        AI content quality pre-check
      </button>
      {error ? <p className="text-xs text-rose-300">{error}</p> : null}
      {result ? (
        <div className={cn(VA_CARD, "space-y-2 p-3")}>
          <p className="text-xs font-medium text-white">
            Recommendation:{" "}
            <span className={result.recommendation === "review" ? "text-amber-300" : "text-emerald-300"}>
              {result.recommendation === "review" ? "Flag for admin assist" : "Looks OK"}
            </span>
            <span className="ml-2 font-normal text-white/40">(never auto-rejects)</span>
          </p>
          {result.programmatic
            .filter((f) => f.severity !== "info")
            .map((f) => (
              <p key={f.code + f.message} className="text-xs text-white/60">
                • {f.message}
              </p>
            ))}
          {result.vision.summary ? (
            <p className="text-xs text-white/60">Vision: {result.vision.summary}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
