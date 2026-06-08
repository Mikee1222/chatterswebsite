"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { ThumbsDown, ThumbsUp } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { useSopMotion } from "@/components/sop/sop-motion";
import { cn } from "@/lib/utils";
import type { SopFeedbackHelpful } from "@/types";

type Props = {
  roleId: string;
  functionId: string;
};

export function SopFeedbackPanel({ roleId, functionId }: Props) {
  const motionCfg = useSopMotion();
  const [helpful, setHelpful] = React.useState<SopFeedbackHelpful | null>(null);
  const [comment, setComment] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [submitted, setSubmitted] = React.useState(false);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    setHelpful(null);
    setComment("");
    setSubmitted(false);
    setError("");
  }, [roleId, functionId]);

  async function submit(selected: SopFeedbackHelpful) {
    if (submitting || submitted) return;
    setHelpful(selected);
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/sops/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role_id: roleId,
          function_id: functionId,
          helpful: selected,
          comment: comment.trim() || undefined,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "Could not save feedback");
      }
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save feedback");
      setHelpful(null);
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <p className="text-sm text-emerald-200/80">Ευχαριστούμε για το feedback!</p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-white/75">Ήταν ξεκάθαρο;</p>
      <div className="flex flex-wrap items-center gap-2">
        <motion.button
          type="button"
          disabled={submitting}
          whileHover={submitting ? undefined : motionCfg.hoverScale}
          whileTap={submitting ? undefined : { scale: 0.97 }}
          onClick={() => void submit("yes")}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-sm font-semibold transition",
            helpful === "yes"
              ? "border-emerald-500/35 bg-emerald-500/15 text-emerald-100"
              : "border-white/12 bg-white/[0.04] text-white/65 hover:border-white/20 hover:text-white/85"
          )}
        >
          {submitting && helpful === "yes" ? (
            <Spinner className="h-4 w-4 border-white/30 border-t-white" />
          ) : (
            <ThumbsUp className="h-4 w-4" />
          )}
          👍
        </motion.button>
        <motion.button
          type="button"
          disabled={submitting}
          whileHover={submitting ? undefined : motionCfg.hoverScale}
          whileTap={submitting ? undefined : { scale: 0.97 }}
          onClick={() => void submit("no")}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-sm font-semibold transition",
            helpful === "no"
              ? "border-rose-500/35 bg-rose-500/15 text-rose-100"
              : "border-white/12 bg-white/[0.04] text-white/65 hover:border-white/20 hover:text-white/85"
          )}
        >
          {submitting && helpful === "no" ? (
            <Spinner className="h-4 w-4 border-white/30 border-t-white" />
          ) : (
            <ThumbsDown className="h-4 w-4" />
          )}
          👎
        </motion.button>
      </div>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Προαιρετικό σχόλιο…"
        rows={2}
        disabled={submitting}
        className="w-full resize-none rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white/85 placeholder:text-white/35 focus:border-pink-500/35 focus:outline-none disabled:opacity-60"
      />
      {error ? <p className="text-sm text-rose-300/90">{error}</p> : null}
    </div>
  );
}
