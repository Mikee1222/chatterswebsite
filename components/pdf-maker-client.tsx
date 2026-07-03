"use client";

import * as React from "react";
import { FileDown, Plus, Trash2 } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";

type Section = {
  id: string;
  title: string;
  content: string;
};

function newSection(): Section {
  return { id: crypto.randomUUID(), title: "", content: "" };
}

function slugifyFilename(title: string): string {
  const base = title.trim() || "document";
  const safe = base.replace(/[^\w\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-");
  return `${safe || "document"}.pdf`;
}

export function PdfMakerClient() {
  const [docTitle, setDocTitle] = React.useState("");
  const [subtitle, setSubtitle] = React.useState("");
  const [sections, setSections] = React.useState<Section[]>([newSection()]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  function updateSection(id: string, patch: Partial<Pick<Section, "title" | "content">>) {
    setSections((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  function addSection() {
    setSections((prev) => [...prev, newSection()]);
  }

  function removeSection(id: string) {
    setSections((prev) => (prev.length <= 1 ? prev : prev.filter((s) => s.id !== id)));
  }

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!docTitle.trim()) {
      setError("Document title is required.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/pdf-maker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title: docTitle.trim(),
          subtitle: subtitle.trim() || undefined,
          sections: sections.map((s) => ({
            title: s.title.trim() || undefined,
            content: s.content,
          })),
        }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(typeof data.error === "string" ? data.error : "Failed to generate PDF.");
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = slugifyFilename(docTitle);
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-full bg-gray-950 px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8 border-b border-pink-500/30 pb-6">
          <h1 className="text-2xl font-bold tracking-tight text-white">PDF Maker</h1>
          <p className="mt-1 text-sm text-gray-400">
            Build a branded GUNZO document and download it as a PDF.
          </p>
        </div>

        <form onSubmit={handleGenerate} className="space-y-6">
          <div>
            <label htmlFor="pdf-title" className="mb-1.5 block text-sm font-medium text-pink-500">
              Document title
            </label>
            <input
              id="pdf-title"
              type="text"
              value={docTitle}
              onChange={(e) => setDocTitle(e.target.value)}
              placeholder="e.g. Onboarding Guide"
              className="w-full rounded-lg border border-gray-800 bg-gray-900 px-3 py-2 text-white placeholder:text-gray-600 focus:border-pink-500 focus:outline-none focus:ring-1 focus:ring-pink-500"
            />
          </div>

          <div>
            <label htmlFor="pdf-subtitle" className="mb-1.5 block text-sm font-medium text-gray-400">
              Subtitle <span className="text-gray-600">(optional)</span>
            </label>
            <input
              id="pdf-subtitle"
              type="text"
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              placeholder="e.g. Internal use only"
              className="w-full rounded-lg border border-gray-800 bg-gray-900 px-3 py-2 text-white placeholder:text-gray-600 focus:border-pink-500 focus:outline-none focus:ring-1 focus:ring-pink-500"
            />
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-pink-500">Sections</h2>
              <button
                type="button"
                onClick={addSection}
                className="inline-flex items-center gap-1.5 rounded-lg border border-pink-500/40 px-3 py-1.5 text-xs font-medium text-pink-500 transition hover:bg-pink-500/10"
              >
                <Plus className="h-3.5 w-3.5" />
                Add section
              </button>
            </div>

            {sections.map((section, index) => (
              <div
                key={section.id}
                className="rounded-xl border border-gray-800 bg-gray-900/60 p-4 space-y-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-gray-500">Section {index + 1}</span>
                  {sections.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeSection(section.id)}
                      className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-gray-500 transition hover:bg-red-500/10 hover:text-red-400"
                      aria-label={`Remove section ${index + 1}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Remove
                    </button>
                  )}
                </div>

                <div>
                  <label className="mb-1.5 block text-xs text-gray-400">
                    Section title <span className="text-gray-600">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={section.title}
                    onChange={(e) => updateSection(section.id, { title: e.target.value })}
                    placeholder="Section heading"
                    className="w-full rounded-lg border border-gray-800 bg-gray-950 px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:border-pink-500 focus:outline-none focus:ring-1 focus:ring-pink-500"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs text-gray-400">Content</label>
                  <textarea
                    value={section.content}
                    onChange={(e) => updateSection(section.id, { content: e.target.value })}
                    rows={5}
                    placeholder="Section body text…"
                    className="w-full resize-y rounded-lg border border-gray-800 bg-gray-950 px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:border-pink-500 focus:outline-none focus:ring-1 focus:ring-pink-500"
                  />
                </div>
              </div>
            ))}
          </div>

          {error && (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-pink-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-pink-600 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            {loading ? (
              <>
                <Spinner className="h-4 w-4 border-pink-200/40 border-t-white" />
                Generating…
              </>
            ) : (
              <>
                <FileDown className="h-4 w-4" />
                Generate PDF
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
