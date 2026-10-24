"use client";

import * as React from "react";
import { Sparkles } from "lucide-react";
import { VA_BTN_SECONDARY } from "@/lib/va-tasks-tokens";
import { cn } from "@/lib/utils";

type Mode = "captions" | "text_on_screen";

type Props = {
  modelId: string;
  mode: Mode;
  onResult: (text: string) => void;
  className?: string;
  label?: string;
};

/**
 * Opt-in AI generate for brief caption / text-on-screen fields.
 * Requires creative_studio:use; fails soft if missing / underage persona.
 */
export function BriefAiGenerateButton({
  modelId,
  mode,
  onResult,
  className,
  label,
}: Props) {
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  async function run() {
    if (!modelId.trim()) {
      setErr("Select a model first");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/creative-studio/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mode,
          modelId,
          platform: "Instagram",
          format: "Reel",
          variations: 1,
          hashtagCount: mode === "captions" ? 4 : 0,
          maxChars: 40,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        variations?: string[];
        generationDisabledReason?: string;
      };
      if (!res.ok) {
        setErr(data.error ?? "Generate failed");
        return;
      }
      if (data.generationDisabledReason) {
        setErr(data.generationDisabledReason);
        return;
      }
      const text = data.variations?.[0]?.trim();
      if (!text) {
        setErr("No output");
        return;
      }
      onResult(text);
    } catch {
      setErr("Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={cn("flex flex-col items-start gap-1", className)}>
      <button
        type="button"
        disabled={busy || !modelId}
        onClick={() => void run()}
        className={cn(
          VA_BTN_SECONDARY,
          "inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px]",
        )}
      >
        <Sparkles className="h-3 w-3" />
        {busy ? "Generating…" : label ?? (mode === "captions" ? "Generate caption" : "Generate text on screen")}
      </button>
      {err && <span className="text-[10px] text-red-300/80">{err}</span>}
    </div>
  );
}
