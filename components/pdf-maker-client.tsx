"use client";

import * as React from "react";
import {
  ChevronDown,
  ChevronRight,
  ExternalLink,
  FileDown,
  FileText,
  History,
  Plus,
  Trash2,
} from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/contexts/toast-context";
import type { AppNotification } from "@/types";
import {
  DEFAULT_PDF_STYLE,
  type PdfDocument,
  type PdfSection,
  type PdfStyle,
  type PdfTemplate,
} from "@/services/pdf-maker";

type Tab = "create" | "history";

type Section = {
  id: string;
  title: string;
  content: string;
};

function localToast(id: string, title: string, body: string, priority: "normal" | "high"): AppNotification {
  return {
    id,
    notification_id: id,
    user_id: "local",
    category: "system",
    event_type: "system_alert",
    priority,
    title,
    body,
    entity_type: "system",
    entity_id: "",
    read_at: null,
    created_at: new Date().toISOString(),
  };
}

function themePresetColors(theme: PdfStyle["theme"]): Pick<PdfStyle, "backgroundColor" | "textColor"> {
  return theme === "light"
    ? { backgroundColor: "#FFFFFF", textColor: "#1A1A1A" }
    : { backgroundColor: "#0A0A0A", textColor: "#DCDCDC" };
}

function newSection(content = "", title = ""): Section {
  return { id: crypto.randomUUID(), title: title || "", content };
}

function sectionsFromTemplate(template: PdfTemplate): Section[] {
  if (template.defaultSections.length === 0) return [newSection()];
  return template.defaultSections.map((s) =>
    newSection(s.content, s.title ?? ""),
  );
}

function formatDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function previewColors(style: PdfStyle) {
  if (style.theme === "light") {
    return {
      bg: "#FFFFFF",
      banner: "#F5F5F5",
      border: "#E5E5E5",
      title: "#0A0A0A",
      body: "#1A1A1A",
      muted: "#9CA3AF",
      accent: style.accentColor,
    };
  }
  return {
    bg: style.backgroundColor,
    banner: "#0F0F0F",
    border: "#1F2937",
    title: "#FFFFFF",
    body: style.textColor,
    muted: "#6B7280",
    accent: style.accentColor,
  };
}

function PreviewPanel({
  title,
  subtitle,
  sections,
  style,
}: {
  title: string;
  subtitle: string;
  sections: Section[];
  style: PdfStyle;
}) {
  const colors = previewColors(style);

  return (
    <div
      className="overflow-hidden rounded-xl border shadow-lg"
      style={{ borderColor: colors.border, backgroundColor: colors.bg }}
    >
      <div className="h-1.5" style={{ backgroundColor: colors.accent }} />
      <div className="px-5 py-4" style={{ backgroundColor: colors.banner }}>
        <h3 className="text-lg font-bold" style={{ color: colors.title }}>
          {title.trim() || "Document title"}
        </h3>
        {subtitle.trim() ? (
          <p className="mt-1 text-sm" style={{ color: colors.accent }}>
            {subtitle}
          </p>
        ) : (
          <p className="mt-1 text-sm italic" style={{ color: colors.muted }}>
            Subtitle (optional)
          </p>
        )}
      </div>
      <div className="space-y-5 px-5 py-6">
        {sections.map((section, index) => (
          <div key={section.id}>
            {section.title?.trim() ? (
              <div className="mb-2">
                <h4 className="text-sm font-semibold" style={{ color: colors.accent }}>
                  {section.title}
                </h4>
                <div className="mt-1 h-px opacity-60" style={{ backgroundColor: colors.accent }} />
              </div>
            ) : (
              <p className="mb-2 text-xs" style={{ color: colors.muted }}>
                Section {index + 1}
              </p>
            )}
            <p
              className="whitespace-pre-wrap text-xs leading-relaxed"
              style={{ color: colors.body }}
            >
              {section.content.trim() || "Section content…"}
            </p>
          </div>
        ))}
      </div>
      <div
        className="border-t py-3 text-center text-[10px] font-medium tracking-wide"
        style={{ borderColor: colors.border, color: colors.accent }}
      >
        {style.footerText}
      </div>
    </div>
  );
}

export function PdfMakerClient() {
  const { addToast } = useToast();
  const [tab, setTab] = React.useState<Tab>("create");
  const [docTitle, setDocTitle] = React.useState("");
  const [subtitle, setSubtitle] = React.useState("");
  const [sections, setSections] = React.useState<Section[]>([newSection()]);
  const [style, setStyle] = React.useState<PdfStyle>({ ...DEFAULT_PDF_STYLE });
  const [styleOpen, setStyleOpen] = React.useState(false);
  const [styleLoading, setStyleLoading] = React.useState(true);
  const [savingDefaultStyle, setSavingDefaultStyle] = React.useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = React.useState<string | null>(null);
  const [templates, setTemplates] = React.useState<PdfTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = React.useState(true);
  const [history, setHistory] = React.useState<PdfDocument[]>([]);
  const [historyLoading, setHistoryLoading] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const loadTemplates = React.useCallback(async () => {
    setTemplatesLoading(true);
    try {
      const res = await fetch("/api/pdf-maker/templates", { credentials: "include" });
      if (!res.ok) return;
      const data = (await res.json()) as { templates?: PdfTemplate[] };
      setTemplates(Array.isArray(data.templates) ? data.templates : []);
    } catch {
      /* ignore */
    } finally {
      setTemplatesLoading(false);
    }
  }, []);

  const loadDefaultStyle = React.useCallback(async () => {
    setStyleLoading(true);
    try {
      const res = await fetch("/api/pdf-maker/style", { credentials: "include" });
      if (!res.ok) return;
      const data = (await res.json()) as { style?: PdfStyle };
      if (data.style) setStyle(data.style);
    } catch {
      /* ignore */
    } finally {
      setStyleLoading(false);
    }
  }, []);

  const loadHistory = React.useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch("/api/pdf-maker/history", { credentials: "include" });
      if (!res.ok) return;
      const data = (await res.json()) as { documents?: PdfDocument[] };
      setHistory(Array.isArray(data.documents) ? data.documents : []);
    } catch {
      /* ignore */
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadTemplates();
    void loadDefaultStyle();
  }, [loadTemplates, loadDefaultStyle]);

  React.useEffect(() => {
    if (tab === "history") void loadHistory();
  }, [tab, loadHistory]);

  function updateSection(id: string, patch: Partial<Pick<Section, "title" | "content">>) {
    setSections((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  function addSection() {
    setSections((prev) => [...prev, newSection()]);
  }

  function removeSection(id: string) {
    setSections((prev) => (prev.length <= 1 ? prev : prev.filter((s) => s.id !== id)));
  }

  function applyTemplate(template: PdfTemplate) {
    setSelectedTemplateId(template.templateId || template.id);
    setSections(sectionsFromTemplate(template));
    if (!docTitle.trim() && template.name) setDocTitle(template.name);
    if (!subtitle.trim() && template.description) setSubtitle(template.description);
  }

  function setTheme(nextTheme: PdfStyle["theme"]) {
    setStyle((prev) => ({
      ...prev,
      theme: nextTheme,
      ...themePresetColors(nextTheme),
    }));
  }

  async function handleSaveDefaultStyle() {
    setSavingDefaultStyle(true);
    try {
      const res = await fetch("/api/pdf-maker/style", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(style),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; style?: PdfStyle };
      if (!res.ok) {
        addToast(
          localToast(
            `pdf-style-err-${Date.now()}`,
            "Could not save default",
            typeof data.error === "string" ? data.error : "Save failed.",
            "high",
          ),
        );
        return;
      }
      if (data.style) setStyle(data.style);
      addToast(
        localToast(
          `pdf-style-ok-${Date.now()}`,
          "Default style saved",
          "New PDFs will use these settings by default.",
          "normal",
        ),
      );
    } catch {
      addToast(
        localToast(`pdf-style-net-${Date.now()}`, "Could not save default", "Network error.", "high"),
      );
    } finally {
      setSavingDefaultStyle(false);
    }
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
          templateId: selectedTemplateId ?? undefined,
          style,
          sections: sections.map((s) => ({
            title: s.title?.trim() || undefined,
            content: s.content,
          })),
        }),
      });

      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        downloadUrl?: string;
      };

      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Failed to generate PDF.");
        return;
      }

      if (data.downloadUrl) {
        window.open(data.downloadUrl, "_blank", "noopener,noreferrer");
      }

      if (tab === "history") void loadHistory();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(recordId: string) {
    setDeletingId(recordId);
    setError(null);
    try {
      const res = await fetch(`/api/pdf-maker/history/${recordId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(typeof data.error === "string" ? data.error : "Failed to delete document.");
        return;
      }
      setHistory((prev) => prev.filter((d) => d.id !== recordId));
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="min-h-full bg-gray-950 px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 border-b border-pink-500/30 pb-6">
          <h1 className="text-2xl font-bold tracking-tight text-white">PDF Maker</h1>
          <p className="mt-1 text-sm text-gray-400">
            Build a branded GUNZO document, preview it live, and save to history.
          </p>
        </div>

        <div className="mb-6 flex gap-2">
          <button
            type="button"
            onClick={() => setTab("create")}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${
              tab === "create"
                ? "bg-pink-500 text-white"
                : "border border-gray-800 text-gray-400 hover:border-pink-500/40 hover:text-pink-500"
            }`}
          >
            <FileText className="h-4 w-4" />
            Create
          </button>
          <button
            type="button"
            onClick={() => setTab("history")}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${
              tab === "history"
                ? "bg-pink-500 text-white"
                : "border border-gray-800 text-gray-400 hover:border-pink-500/40 hover:text-pink-500"
            }`}
          >
            <History className="h-4 w-4" />
            History
          </button>
        </div>

        {error && (
          <p
            className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400"
            role="alert"
          >
            {error}
          </p>
        )}

        {tab === "create" ? (
          <div className="grid gap-8 lg:grid-cols-2">
            <form onSubmit={handleGenerate} className="space-y-6">
              <div>
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-pink-500">
                  Templates
                </h2>
                {templatesLoading ? (
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Spinner className="h-4 w-4 border-gray-600 border-t-pink-500" />
                    Loading templates…
                  </div>
                ) : templates.length === 0 ? (
                  <p className="text-sm text-gray-500">No templates available.</p>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {templates.map((template) => {
                      const active =
                        selectedTemplateId === template.templateId ||
                        selectedTemplateId === template.id;
                      return (
                        <button
                          key={template.id}
                          type="button"
                          onClick={() => applyTemplate(template)}
                          className={`rounded-xl border p-4 text-left transition ${
                            active
                              ? "border-pink-500 bg-pink-500/10"
                              : "border-gray-800 bg-gray-900/60 hover:border-pink-500/40"
                          }`}
                        >
                          <p className="font-medium text-white">{template.name}</p>
                          {template.description ? (
                            <p className="mt-1 text-xs text-gray-400 line-clamp-2">
                              {template.description}
                            </p>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

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

              <div className="rounded-xl border border-gray-800 bg-gray-900/40">
                <button
                  type="button"
                  onClick={() => setStyleOpen((open) => !open)}
                  className="flex w-full items-center justify-between px-4 py-3 text-left"
                  aria-expanded={styleOpen}
                >
                  <span className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-pink-500">
                    {styleOpen ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                    Customize style
                  </span>
                  {styleLoading ? (
                    <Spinner className="h-4 w-4 border-gray-600 border-t-pink-500" />
                  ) : (
                    <span className="text-xs text-gray-500">
                      {style.theme === "light" ? "Light" : "Dark"} · {style.accentColor}
                    </span>
                  )}
                </button>

                {styleOpen ? (
                  <div className="space-y-4 border-t border-gray-800 px-4 py-4">
                    <div className="flex flex-wrap items-end gap-4">
                      <div>
                        <label htmlFor="pdf-accent-color" className="mb-1.5 block text-xs text-gray-400">
                          Accent color
                        </label>
                        <input
                          id="pdf-accent-color"
                          type="color"
                          value={style.accentColor}
                          onChange={(e) =>
                            setStyle((prev) => ({ ...prev, accentColor: e.target.value }))
                          }
                          className="h-10 w-14 cursor-pointer rounded border border-gray-700 bg-gray-950 p-1"
                        />
                      </div>

                      <div>
                        <span className="mb-1.5 block text-xs text-gray-400">Theme</span>
                        <div className="inline-flex rounded-lg border border-gray-700 p-0.5">
                          <button
                            type="button"
                            onClick={() => setTheme("dark")}
                            className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                              style.theme === "dark"
                                ? "bg-pink-500 text-white"
                                : "text-gray-400 hover:text-white"
                            }`}
                          >
                            Dark
                          </button>
                          <button
                            type="button"
                            onClick={() => setTheme("light")}
                            className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                              style.theme === "light"
                                ? "bg-pink-500 text-white"
                                : "text-gray-400 hover:text-white"
                            }`}
                          >
                            Light
                          </button>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label htmlFor="pdf-footer-text" className="mb-1.5 block text-xs text-gray-400">
                        Footer text
                      </label>
                      <input
                        id="pdf-footer-text"
                        type="text"
                        value={style.footerText}
                        onChange={(e) =>
                          setStyle((prev) => ({ ...prev, footerText: e.target.value }))
                        }
                        placeholder="GUNZO AGENCY — CONFIDENTIAL"
                        className="w-full rounded-lg border border-gray-800 bg-gray-950 px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:border-pink-500 focus:outline-none focus:ring-1 focus:ring-pink-500"
                      />
                    </div>

                    <div>
                      <label htmlFor="pdf-font-family" className="mb-1.5 block text-xs text-gray-400">
                        Font family
                      </label>
                      <input
                        id="pdf-font-family"
                        type="text"
                        value={style.fontFamily}
                        disabled
                        className="w-full cursor-not-allowed rounded-lg border border-gray-800 bg-gray-950/60 px-3 py-2 text-sm text-gray-500"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => void handleSaveDefaultStyle()}
                      disabled={savingDefaultStyle || styleLoading}
                      className="inline-flex items-center gap-2 rounded-lg border border-pink-500/40 px-3 py-1.5 text-xs font-medium text-pink-500 transition hover:bg-pink-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {savingDefaultStyle ? (
                        <Spinner className="h-3.5 w-3.5 border-gray-600 border-t-pink-500" />
                      ) : null}
                      Save as default
                    </button>
                  </div>
                ) : null}
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-pink-500">
                    Sections
                  </h2>
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
                    className="space-y-3 rounded-xl border border-gray-800 bg-gray-900/60 p-4"
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

            <div className="lg:sticky lg:top-6 lg:self-start">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-pink-500">
                Live preview
              </h2>
              <PreviewPanel title={docTitle} subtitle={subtitle} sections={sections} style={style} />
            </div>
          </div>
        ) : (
          <div>
            {historyLoading ? (
              <div className="flex items-center justify-center gap-2 py-16 text-gray-500">
                <Spinner className="h-5 w-5 border-gray-600 border-t-pink-500" />
                Loading history…
              </div>
            ) : history.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-800 bg-gray-900/40 px-6 py-16 text-center">
                <FileText className="mx-auto h-10 w-10 text-gray-700" />
                <p className="mt-4 text-sm font-medium text-gray-400">No PDFs yet</p>
                <p className="mt-1 text-xs text-gray-600">
                  Generated documents will appear here with download and delete actions.
                </p>
                <button
                  type="button"
                  onClick={() => setTab("create")}
                  className="mt-6 inline-flex items-center gap-2 rounded-lg bg-pink-500 px-4 py-2 text-sm font-medium text-white hover:bg-pink-600"
                >
                  <Plus className="h-4 w-4" />
                  Create your first PDF
                </button>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {history.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex flex-col rounded-xl border border-gray-800 bg-gray-900/60 p-4"
                  >
                    <div className="flex-1">
                      <h3 className="font-semibold text-white">{doc.title}</h3>
                      {doc.subtitle ? (
                        <p className="mt-0.5 text-sm text-pink-500">{doc.subtitle}</p>
                      ) : null}
                      <p className="mt-2 text-xs text-gray-500">{formatDate(doc.createdAt)}</p>
                      {doc.template ? (
                        <p className="mt-1 text-xs text-gray-600">Template: {doc.template}</p>
                      ) : null}
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {doc.fileUrl ? (
                        <a
                          href={doc.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-lg border border-pink-500/40 px-3 py-1.5 text-xs font-medium text-pink-500 transition hover:bg-pink-500/10"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          Download
                        </a>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => void handleDelete(doc.id)}
                        disabled={deletingId === doc.id}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-700 px-3 py-1.5 text-xs font-medium text-gray-400 transition hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50"
                      >
                        {deletingId === doc.id ? (
                          <Spinner className="h-3.5 w-3.5 border-gray-600 border-t-red-400" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
