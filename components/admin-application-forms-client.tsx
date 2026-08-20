"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExternalLink, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { CountUp, LuxuryStatCard, SectionLabel } from "@/components/infloww-performance-ui";
import { ROUTES } from "@/lib/routes";
import {
  FORM_STATUS_LABELS,
  type ApplicationFormListItem,
  type ApplicationFormStatus,
} from "@/lib/application-forms-types";

const BORDER = "rgba(255,255,255,0.08)";
const GOLD = "#D4AF8C";

const STATUS_STYLE: Record<ApplicationFormStatus, string> = {
  draft: "border-white/15 bg-white/5 text-white/60",
  published: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  closed: "border-amber-500/30 bg-amber-500/10 text-amber-200",
};

type Props = {
  initialForms: ApplicationFormListItem[];
  canManage: boolean;
};

export function AdminApplicationFormsClient({ initialForms, canManage }: Props) {
  const router = useRouter();
  const [forms, setForms] = useState(initialForms);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);

  const stats = useMemo(() => {
    const published = forms.filter((f) => f.status === "published").length;
    const responses = forms.reduce((n, f) => n + f.response_count, 0);
    const drafts = forms.filter((f) => f.status === "draft").length;
    return { total: forms.length, published, responses, drafts };
  }, [forms]);

  async function createForm() {
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/admin/application-forms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Create failed");
      toast.success("Form created");
      router.push(ROUTES.admin.applicationFormDetail(data.form.id));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Create failed");
    } finally {
      setBusy(false);
    }
  }

  async function deleteForm(id: string, formTitle: string) {
    if (!confirm(`Delete “${formTitle}”? All responses will be removed.`)) return;
    try {
      const res = await fetch(`/api/admin/application-forms/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Delete failed");
      setForms((prev) => prev.filter((f) => f.id !== id));
      toast.success("Form deleted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <SectionLabel>Recruitment</SectionLabel>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            Applications
          </h1>
          <p className="mt-2 max-w-xl text-sm text-white/55">
            Build custom application forms, share a public link, and manage candidates in one pipeline.
          </p>
        </div>
        {canManage && (
          <button
            type="button"
            onClick={() => setCreating((v) => !v)}
            className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-[#0D0B0D] transition hover:opacity-90"
            style={{ background: GOLD }}
          >
            <Plus className="h-4 w-4" aria-hidden />
            New form
          </button>
        )}
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <LuxuryStatCard label="Forms" value={<CountUp value={stats.total} />} accent="champagne" />
        <LuxuryStatCard label="Published" value={<CountUp value={stats.published} />} accent="emerald" />
        <LuxuryStatCard label="Drafts" value={<CountUp value={stats.drafts} />} accent="white" />
        <LuxuryStatCard label="Responses" value={<CountUp value={stats.responses} />} accent="pink" />
      </div>

      {creating && canManage && (
        <div
          className="mt-6 rounded-2xl border p-4"
          style={{ borderColor: BORDER, background: "rgba(255,255,255,0.02)" }}
        >
          <label className="block text-xs font-medium uppercase tracking-wider text-white/45">
            Form title
          </label>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Chatter application 2026"
              className="h-11 flex-1 rounded-xl border border-[#1f1f1f] bg-[#0d0d0d] px-4 text-sm text-white placeholder:text-white/30"
              onKeyDown={(e) => {
                if (e.key === "Enter") void createForm();
              }}
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => void createForm()}
              className="h-11 rounded-xl px-4 text-sm font-medium text-[#0D0B0D] disabled:opacity-50"
              style={{ background: GOLD }}
            >
              {busy ? "Creating…" : "Create & edit"}
            </button>
          </div>
        </div>
      )}

      <div className="mt-8 space-y-3">
        {forms.length === 0 ? (
          <div
            className="rounded-2xl border border-dashed px-6 py-16 text-center text-sm text-white/45"
            style={{ borderColor: BORDER }}
          >
            No forms yet. Create your first recruitment form to get started.
          </div>
        ) : (
          forms.map((form) => (
            <div
              key={form.id}
              className="flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between"
              style={{ borderColor: BORDER, background: "rgba(13,11,13,0.65)" }}
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={ROUTES.admin.applicationFormDetail(form.id)}
                    className="truncate text-base font-medium text-white hover:text-[#D4AF8C]"
                  >
                    {form.title}
                  </Link>
                  <span
                    className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLE[form.status]}`}
                  >
                    {FORM_STATUS_LABELS[form.status]}
                  </span>
                </div>
                <p className="mt-1 text-xs text-white/40">
                  /apply/{form.slug} · {form.response_count} response
                  {form.response_count === 1 ? "" : "s"} ·{" "}
                  {new Date(form.created_at).toLocaleDateString()}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {form.status === "published" && (
                  <a
                    href={ROUTES.applyForm(form.slug)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs text-white/70 hover:text-white"
                    style={{ borderColor: BORDER }}
                  >
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                    Public link
                  </a>
                )}
                <Link
                  href={ROUTES.admin.applicationFormResponses(form.id)}
                  className="rounded-lg border px-3 py-2 text-xs text-white/70 hover:text-white"
                  style={{ borderColor: BORDER }}
                >
                  Responses
                </Link>
                <Link
                  href={ROUTES.admin.applicationFormDetail(form.id)}
                  className="rounded-lg px-3 py-2 text-xs font-medium text-[#0D0B0D]"
                  style={{ background: GOLD }}
                >
                  Edit
                </Link>
                {canManage && (
                  <button
                    type="button"
                    onClick={() => void deleteForm(form.id, form.title)}
                    className="rounded-lg border border-red-500/20 p-2 text-red-300/70 hover:bg-red-500/10 hover:text-red-200"
                    aria-label="Delete form"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
