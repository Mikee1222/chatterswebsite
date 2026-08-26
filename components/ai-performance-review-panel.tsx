"use client";

import * as React from "react";
import { Download, FileText, Loader2 } from "lucide-react";
import { VA_BTN_SECONDARY, VA_CARD } from "@/lib/va-tasks-tokens";
import { cn } from "@/lib/utils";

type Props = {
  personId: string;
  personName: string;
  role: "chatter" | "virtual_assistant";
  className?: string;
};

export function AiPerformanceReviewPanel({ personId, personName, role, className }: Props) {
  const [sections, setSections] = React.useState<Array<{ title: string; body: string }> | null>(
    null,
  );
  const [loading, setLoading] = React.useState(false);
  const [pdfLoading, setPdfLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [period, setPeriod] = React.useState<string | null>(null);

  async function generate(force: boolean) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/ai/performance-review", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personId, personName, role, force }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        sections?: Array<{ title: string; body: string }>;
        period?: { startYmd: string; endYmd: string };
        error?: string;
      };
      if (!res.ok) throw new Error(data.error || "Failed to generate review");
      setSections(data.sections ?? []);
      setPeriod(data.period ? `${data.period.startYmd} → ${data.period.endYmd}` : null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  async function downloadPdf() {
    setPdfLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/ai/performance-review", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personId, personName, role, format: "pdf", force: false }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || "PDF failed");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `performance-review-${personName}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "PDF failed");
    } finally {
      setPdfLoading(false);
    }
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void generate(false)}
          disabled={loading}
          className={cn(VA_BTN_SECONDARY, "inline-flex items-center gap-2")}
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
          AI performance review
        </button>
        {sections ? (
          <button
            type="button"
            onClick={() => void downloadPdf()}
            disabled={pdfLoading}
            className={cn(VA_BTN_SECONDARY, "inline-flex items-center gap-2")}
          >
            {pdfLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Export PDF
          </button>
        ) : null}
      </div>
      {error ? <p className="text-sm text-rose-300">{error}</p> : null}
      {sections ? (
        <div className={cn(VA_CARD, "space-y-4 p-4")}>
          {period ? <p className="text-xs text-white/45">Period {period}</p> : null}
          {sections.map((s) => (
            <div key={s.title}>
              <h4 className="text-sm font-semibold text-white">{s.title}</h4>
              <p className="mt-1 whitespace-pre-wrap text-sm text-white/70">{s.body}</p>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
