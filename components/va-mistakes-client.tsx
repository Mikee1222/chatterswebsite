"use client";

import * as React from "react";
import { AnimatePresence } from "framer-motion";
import { Pencil } from "lucide-react";
import { useToast } from "@/contexts/toast-context";
import type { AppNotification } from "@/types";
import { getNowDatetimeLocalAthens, athensDatetimeLocalToISO } from "@/lib/airtable-datetime";
import { formatDateTimeAthens } from "@/lib/format";
import { FormInput } from "@/components/ui/form-input";
import { FormTextarea } from "@/components/ui/form-textarea";
import { Label } from "@/components/ui/form";
import { GlassModal } from "@/components/ui/glass-modal";
import type { MistakeReasonCategory, MistakeRecord } from "@/services/chatter-mistakes";

type ChatterOption = { id: string; name: string };
type ModelOption = { id: string; model_name: string };
type ReasonOption = {
  reason_id: string;
  label: string;
  category: MistakeReasonCategory;
  points_deduction: number;
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

function categoryBadgeClass(cat: MistakeReasonCategory): string {
  if (cat === "High") return "bg-red-500/15 border-red-500/25 text-red-400";
  if (cat === "Medium") return "bg-amber-500/15 border-amber-500/25 text-amber-400";
  return "bg-yellow-500/15 border-yellow-500/25 text-yellow-400";
}

function statusBadgeClass(st: string): string {
  if (st === "approved") return "bg-green-500/15 border-green-500/25 text-green-400";
  if (st === "rejected") return "bg-red-500/15 border-red-500/25 text-red-400";
  return "bg-amber-500/15 border-amber-500/25 text-amber-400";
}

function canEditMistake(m: MistakeRecord): boolean {
  if (m.status !== "pending") return false;
  const createdMs = new Date(m.created_at).getTime();
  if (!Number.isFinite(createdMs)) return false;
  return Date.now() - createdMs < 24 * 60 * 60 * 1000;
}

function SearchablePicker({
  value,
  onChange,
  items,
  placeholder,
  emptyLabel,
}: {
  value: string;
  onChange: (id: string, label: string) => void;
  items: { id: string; label: string }[];
  placeholder: string;
  emptyLabel: string;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");

  React.useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const filtered = React.useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return items.slice(0, 50);
    return items.filter((i) => i.label.toLowerCase().includes(qq)).slice(0, 50);
  }, [items, q]);

  const selectedLabel = items.find((i) => i.id === value)?.label ?? "";

  const triggerClass =
    "flex w-full min-h-11 items-center justify-between rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-left text-sm text-white/90 transition-colors hover:border-white/20 hover:bg-white/[0.06]";

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen(!open)} className={triggerClass}>
        <span className={selectedLabel ? "truncate" : "truncate text-white/40"}>
          {selectedLabel || emptyLabel}
        </span>
        <span className="shrink-0 text-white/40">▾</span>
      </button>
      {open ? (
        <div className="absolute z-50 mt-1 max-h-64 w-full overflow-hidden rounded-xl border border-white/10 bg-black/95 py-2 shadow-xl backdrop-blur-xl">
          <FormInput
            type="text"
            placeholder={placeholder}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="!min-h-9 mx-2 mb-1 border-white/10 bg-white/5 text-sm"
          />
          <div className="max-h-52 overflow-y-auto px-1">
            {filtered.length === 0 ? (
              <p className="px-3 py-2 text-xs text-white/40">No matches</p>
            ) : (
              filtered.map((i) => (
                <button
                  key={i.id}
                  type="button"
                  className="block w-full truncate rounded-lg px-3 py-2 text-left text-sm text-white/85 hover:bg-white/10"
                  onClick={() => {
                    onChange(i.id, i.label);
                    setOpen(false);
                    setQ("");
                  }}
                >
                  {i.label}
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

type Props = {
  initialMistakes: MistakeRecord[];
  chatters: ChatterOption[];
  models: ModelOption[];
  reasons: ReasonOption[];
};

export function VaMistakesClient({ initialMistakes, chatters, models, reasons }: Props) {
  const { addToast } = useToast();
  const [mainTab, setMainTab] = React.useState<"submit" | "submitted">("submit");
  const [subTab, setSubTab] = React.useState<"all" | "rejected">("all");
  const [mistakes, setMistakes] = React.useState(initialMistakes);

  React.useEffect(() => {
    setMistakes(initialMistakes);
  }, [initialMistakes]);

  const [subUsername, setSubUsername] = React.useState("");
  const [chatterId, setChatterId] = React.useState("");
  const [chatterName, setChatterName] = React.useState("");
  const [modelId, setModelId] = React.useState("");
  const [modelName, setModelName] = React.useState("");
  const [mistakeLocal, setMistakeLocal] = React.useState(() => getNowDatetimeLocalAthens());
  const [reasonId, setReasonId] = React.useState("");
  const [screenshot, setScreenshot] = React.useState<File | null>(null);
  const [screenshotPreviewUrl, setScreenshotPreviewUrl] = React.useState<string | null>(null);
  const [explanation, setExplanation] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [justPasted, setJustPasted] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!screenshot) {
      setScreenshotPreviewUrl(null);
      return;
    }
    const u = URL.createObjectURL(screenshot);
    setScreenshotPreviewUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [screenshot]);

  React.useEffect(() => {
    if (mainTab !== "submit") return;
    let timeoutId: number | undefined;
    function handleGlobalPaste(e: ClipboardEvent) {
      const items = Array.from(e.clipboardData?.items ?? []);
      const imageItem = items.find((item) => item.type.startsWith("image/"));
      if (!imageItem) return;
      const file = imageItem.getAsFile();
      if (!file) return;
      e.preventDefault();
      setScreenshot(file);
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
      setJustPasted(true);
      timeoutId = window.setTimeout(() => setJustPasted(false), 1500);
    }
    document.addEventListener("paste", handleGlobalPaste);
    return () => {
      document.removeEventListener("paste", handleGlobalPaste);
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
    };
  }, [mainTab]);

  const chatterItems = React.useMemo(
    () => chatters.map((c) => ({ id: c.id, label: c.name })),
    [chatters]
  );
  const modelItems = React.useMemo(
    () => models.map((m) => ({ id: m.id, label: m.model_name })),
    [models]
  );

  const [editOpen, setEditOpen] = React.useState(false);
  const [editRow, setEditRow] = React.useState<MistakeRecord | null>(null);
  const [editSub, setEditSub] = React.useState("");
  const [editChatterId, setEditChatterId] = React.useState("");
  const [editChatterName, setEditChatterName] = React.useState("");
  const [editModelId, setEditModelId] = React.useState("");
  const [editModelName, setEditModelName] = React.useState("");
  const [editLocal, setEditLocal] = React.useState("");
  const [editReasonId, setEditReasonId] = React.useState("");
  const [editExplanation, setEditExplanation] = React.useState("");
  const [editSaving, setEditSaving] = React.useState(false);

  function resetSubmitForm() {
    setSubUsername("");
    setChatterId("");
    setChatterName("");
    setModelId("");
    setModelName("");
    setMistakeLocal(getNowDatetimeLocalAthens());
    setReasonId("");
    setScreenshot(null);
    setExplanation("");
  }

  async function refreshList() {
    try {
      const res = await fetch("/api/va/mistakes");
      if (!res.ok) return;
      const data = (await res.json()) as { mistakes?: MistakeRecord[] };
      if (Array.isArray(data.mistakes)) setMistakes(data.mistakes);
    } catch {
      /* ignore */
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!chatterId || !modelId || !reasonId || !explanation.trim()) {
      addToast(localToast("va-mist-missing", "Missing fields", "Fill chatter, model, reason, and explanation.", "normal"));
      return;
    }
    const sub = subUsername.trim().replace(/^@+/, "");
    if (!sub) {
      addToast(localToast("va-mist-sub", "Sub username", "Enter the subscriber username.", "normal"));
      return;
    }
    setSubmitting(true);
    const fd = new FormData();
    fd.set("chatter_id", chatterId);
    fd.set("chatter_name", chatterName);
    fd.set("model_id", modelId);
    fd.set("model_name", modelName);
    fd.set("sub_username", sub);
    fd.set("mistake_date", athensDatetimeLocalToISO(mistakeLocal));
    fd.set("reason_id", reasonId);
    fd.set("explanation", explanation.trim());
    if (screenshot) fd.set("screenshot", screenshot);

    try {
      const res = await fetch("/api/va/mistakes", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        addToast(
          localToast(
            "va-mist-err",
            "Submit failed",
            typeof data.error === "string" ? data.error : "Could not submit mistake.",
            "high"
          )
        );
        return;
      }
      addToast(localToast("va-mist-ok", "Submitted", "Mistake report saved.", "normal"));
      resetSubmitForm();
      await refreshList();
      setMainTab("submitted");
      setSubTab("all");
    } finally {
      setSubmitting(false);
    }
  }

  function openEdit(m: MistakeRecord) {
    setEditRow(m);
    setEditSub(m.sub_username ?? "");
    setEditChatterId(m.chatter_id);
    setEditChatterName(m.chatter_name);
    setEditModelId(m.model_id);
    setEditModelName(m.model_name);
    const iso = m.mistake_date;
    const d = new Date(iso);
    if (Number.isFinite(d.getTime())) {
      const shifted = new Date(d.getTime() + 3 * 60 * 60 * 1000);
      const y = shifted.getUTCFullYear();
      const mo = String(shifted.getUTCMonth() + 1).padStart(2, "0");
      const day = String(shifted.getUTCDate()).padStart(2, "0");
      const h = String(shifted.getUTCHours()).padStart(2, "0");
      const mi = String(shifted.getUTCMinutes()).padStart(2, "0");
      setEditLocal(`${y}-${mo}-${day}T${h}:${mi}`);
    } else setEditLocal(getNowDatetimeLocalAthens());
    setEditReasonId(m.reason_id);
    setEditExplanation(m.explanation);
    setEditOpen(true);
  }

  async function saveEdit() {
    if (!editRow) return;
    if (!editChatterId || !editModelId || !editReasonId || !editExplanation.trim()) {
      addToast(localToast("va-mist-edit-miss", "Missing fields", "Complete all required fields.", "normal"));
      return;
    }
    const sub = editSub.trim().replace(/^@+/, "");
    if (!sub) {
      addToast(localToast("va-mist-edit-sub", "Sub username", "Enter the subscriber username.", "normal"));
      return;
    }
    setEditSaving(true);
    try {
      const res = await fetch(`/api/va/mistakes/${editRow.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          explanation: editExplanation.trim(),
          mistake_date: athensDatetimeLocalToISO(editLocal),
          reason_id: editReasonId,
          chatter_id: editChatterId,
          chatter_name: editChatterName,
          model_id: editModelId,
          model_name: editModelName,
          sub_username: sub,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        addToast(
          localToast(
            "va-mist-edit-err",
            "Update failed",
            typeof data.error === "string" ? data.error : "Could not update.",
            "high"
          )
        );
        return;
      }
      addToast(localToast("va-mist-edit-ok", "Updated", "Mistake report updated.", "normal"));
      setEditOpen(false);
      setEditRow(null);
      await refreshList();
    } finally {
      setEditSaving(false);
    }
  }

  const submittedList = React.useMemo(
    () => (subTab === "rejected" ? mistakes.filter((m) => m.status === "rejected") : mistakes),
    [mistakes, subTab]
  );

  const selectedReason = React.useMemo(
    () => reasons.find((r) => r.reason_id === reasonId),
    [reasons, reasonId]
  );

  const pendingCount = React.useMemo(() => mistakes.filter((m) => m.status === "pending").length, [mistakes]);

  const isFormValid = Boolean(
    subUsername.trim().replace(/^@+/, "") &&
      chatterId &&
      modelId &&
      reasonId &&
      explanation.trim() &&
      screenshot &&
      mistakeLocal
  );

  const labelClass = "text-xs font-bold uppercase tracking-widest text-white/40 mb-2 block";
  const fieldClass =
    "w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3.5 text-white placeholder:text-white/20 focus:outline-none focus:border-pink-500/60 focus:bg-white/8 transition-all text-sm";
  const selectClass = `${fieldClass} appearance-none cursor-pointer bg-neutral-950/80`;

  return (
    <div className="space-y-6">
      <div className="mb-2">
        <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-pink-400/60">Virtual assistant</p>
        <h1 className="text-3xl font-bold tracking-tight text-white">Mistake reports</h1>
        <p className="mt-1 text-sm text-white/40">Document chatter mistakes for admin review.</p>
      </div>

      <div className="mb-2 flex w-fit rounded-2xl border border-white/10 bg-white/5 p-1">
        <button
          type="button"
          onClick={() => setMainTab("submit")}
          className={`rounded-xl px-6 py-2.5 text-sm font-semibold transition-all ${
            mainTab === "submit"
              ? "bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-lg shadow-pink-500/20"
              : "text-white/50 hover:text-white"
          }`}
        >
          📝 Submit mistake
        </button>
        <button
          type="button"
          onClick={() => setMainTab("submitted")}
          className={`rounded-xl px-6 py-2.5 text-sm font-semibold transition-all ${
            mainTab === "submitted"
              ? "bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-lg shadow-pink-500/20"
              : "text-white/50 hover:text-white"
          }`}
        >
          📋 Submitted
          {pendingCount > 0 ? (
            <span className="ml-2 rounded-full bg-amber-500 px-1.5 py-0.5 text-xs text-white">{pendingCount}</span>
          ) : null}
        </button>
      </div>

      {mainTab === "submit" ? (
        <form
          onSubmit={onSubmit}
          className="max-w-2xl space-y-5 rounded-3xl border border-white/10 bg-white/[0.03] p-8 shadow-xl shadow-black/20 backdrop-blur-sm"
        >
          <div>
            <label className={labelClass}>
              Sub username <span className="text-pink-400">*</span>
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 font-medium text-white/30">@</span>
              <input
                value={subUsername}
                onChange={(e) => setSubUsername(e.target.value)}
                required
                placeholder="username"
                className={`${fieldClass} pl-9 pr-4`}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>
                Chatter <span className="text-pink-400">*</span>
              </label>
              <select
                required
                value={chatterId}
                onChange={(e) => {
                  const id = e.target.value;
                  setChatterId(id);
                  const c = chatters.find((x) => x.id === id);
                  setChatterName(c?.name ?? "");
                }}
                className={selectClass}
              >
                <option value="">Select chatter</option>
                {chatters.map((c) => (
                  <option key={c.id} value={c.id} className="bg-neutral-900">
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>
                Model <span className="text-pink-400">*</span>
              </label>
              <select
                required
                value={modelId}
                onChange={(e) => {
                  const id = e.target.value;
                  setModelId(id);
                  const m = models.find((x) => x.id === id);
                  setModelName(m?.model_name ?? "");
                }}
                className={selectClass}
              >
                <option value="">Select model</option>
                {models.map((m) => (
                  <option key={m.id} value={m.id} className="bg-neutral-900">
                    {m.model_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className={labelClass}>
              Date &amp; time <span className="text-pink-400">*</span>
            </label>
            <input
              type="datetime-local"
              value={mistakeLocal}
              onChange={(e) => setMistakeLocal(e.target.value)}
              required
              className={`${fieldClass} [color-scheme:dark]`}
            />
          </div>

          <div>
            <label className={labelClass}>
              Reason <span className="text-pink-400">*</span>
            </label>
            <select
              required
              value={reasonId}
              onChange={(e) => setReasonId(e.target.value)}
              className={selectClass}
            >
              <option value="">Select reason…</option>
              {(["Low", "Medium", "High"] as const).map((cat) => (
                <optgroup
                  key={cat}
                  label={`${cat === "High" ? "🔴" : cat === "Medium" ? "🟠" : "🟡"} ${cat} mistakes`}
                  className="bg-neutral-900"
                >
                  {reasons
                    .filter((r) => r.category === cat)
                    .map((r) => (
                      <option key={r.reason_id} value={r.reason_id} className="bg-neutral-900">
                        {r.label}
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
            {selectedReason ? (
              <div className="mt-2 flex items-center gap-2">
                <span
                  className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                    selectedReason.category === "High"
                      ? "border-red-500/25 bg-red-500/15 text-red-400"
                      : selectedReason.category === "Medium"
                        ? "border-amber-500/25 bg-amber-500/15 text-amber-400"
                        : "border-yellow-500/25 bg-yellow-500/15 text-yellow-400"
                  }`}
                >
                  {selectedReason.category} · -{selectedReason.points_deduction} pts
                </span>
              </div>
            ) : null}
          </div>

          <div>
            <label className={labelClass}>
              Screenshot <span className="text-pink-400">*</span>
            </label>
            <div
              role="button"
              tabIndex={0}
              onClick={() => fileRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") fileRef.current?.click();
              }}
              className={`relative flex min-h-[140px] cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed transition-all ${
                justPasted
                  ? "border-green-500/60 bg-green-500/10"
                  : screenshotPreviewUrl
                    ? "border-pink-500/40 bg-pink-500/5"
                    : "border-white/15 bg-white/[0.03] hover:border-pink-500/40 hover:bg-white/5"
              }`}
            >
              {screenshotPreviewUrl ? (
                <>
                  <img src={screenshotPreviewUrl} alt="" className="max-h-48 rounded-xl object-contain" />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setScreenshot(null);
                    }}
                    className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-500/80 text-xs text-white hover:bg-red-500"
                    aria-label="Remove screenshot"
                  >
                    ×
                  </button>
                  {justPasted ? (
                    <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-green-500/20">
                      <span className="text-lg font-bold text-green-400">✓ Pasted!</span>
                    </div>
                  ) : null}
                </>
              ) : (
                <>
                  <div className="mb-3 text-4xl">📋</div>
                  <p className="text-sm font-semibold text-white/60">
                    {justPasted ? "✓ Pasted!" : "Paste screenshot (Ctrl+V)"}
                  </p>
                  <p className="mt-1 text-xs text-white/30">or click to upload</p>
                  <p className="mt-3 px-4 text-center text-xs text-white/20">
                    Paste works anywhere on this page while you are on Submit — press Ctrl+V (or ⌘V) with an image in the clipboard.
                  </p>
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

          <div>
            <label className={labelClass}>
              Explanation <span className="text-pink-400">*</span>
            </label>
            <textarea
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              required
              rows={4}
              placeholder="Describe exactly what happened…"
              className={`${fieldClass} resize-none`}
            />
          </div>

          <button
            type="submit"
            disabled={submitting || !isFormValid}
            className="w-full rounded-2xl bg-gradient-to-r from-pink-500 to-rose-500 py-4 text-base font-bold text-white shadow-lg shadow-pink-500/25 transition-all hover:shadow-pink-500/40 enabled:hover:scale-[1.01] active:enabled:scale-[0.99] disabled:scale-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting ? "Submitting…" : "🚀 Submit mistake report"}
          </button>
        </form>
      ) : (
        <div className="space-y-5">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setSubTab("all")}
              className={`rounded-xl px-4 py-2.5 text-xs font-semibold uppercase tracking-wide transition-colors ${
                subTab === "all" ? "bg-white/10 text-white ring-1 ring-pink-500/30" : "text-white/45 hover:text-white/70"
              }`}
            >
              All submitted
            </button>
            <button
              type="button"
              onClick={() => setSubTab("rejected")}
              className={`rounded-xl px-4 py-2.5 text-xs font-semibold uppercase tracking-wide transition-colors ${
                subTab === "rejected" ? "bg-red-500/25 text-red-200 ring-1 ring-red-500/30" : "text-white/45 hover:text-white/70"
              }`}
            >
              ❌ Rejected (needs attention)
            </button>
          </div>

          <div className="space-y-3">
            {submittedList.length === 0 ? (
              <p className="text-sm text-white/40">
                {subTab === "rejected" ? "No rejected mistakes." : "No submitted mistakes yet."}
              </p>
            ) : (
              submittedList.map((m) => {
                const rejected = m.status === "rejected";
                return (
                  <div
                    key={m.id}
                    className={`relative overflow-hidden rounded-2xl border p-5 backdrop-blur-sm transition-transform hover:scale-[1.005] ${
                      rejected
                        ? "border-2 border-red-500/35 bg-red-500/[0.06]"
                        : "border border-white/10 bg-white/[0.04]"
                    }`}
                  >
                    <div
                      className={`absolute bottom-0 left-0 top-0 w-1 rounded-l-2xl ${
                        m.reason_category === "High"
                          ? "bg-red-500"
                          : m.reason_category === "Medium"
                            ? "bg-amber-500"
                            : "bg-yellow-500"
                      }`}
                    />
                    <div className="pl-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${categoryBadgeClass(m.reason_category)}`}>
                          {m.reason_category === "High" ? "🔴 " : m.reason_category === "Medium" ? "🟠 " : "🟡 "}
                          {m.reason_category}
                        </span>
                        <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold capitalize ${statusBadgeClass(m.status)}`}>
                          {m.status}
                        </span>
                      </div>
                      <p className="mt-2 font-semibold text-white">{m.reason_label}</p>
                      <p className="mt-1 text-xs text-white/45">
                        {m.chatter_name} · {m.model_name} · @{m.sub_username}
                      </p>
                      <p className="mt-1 text-xs text-white/35">{formatDateTimeAthens(m.mistake_date)}</p>
                      {rejected && m.admin_notes ? (
                        <p className="mt-2 border-t border-red-500/20 pt-2 text-sm italic text-red-200/80">Admin: {m.admin_notes}</p>
                      ) : null}
                      {canEditMistake(m) ? (
                        <button
                          type="button"
                          onClick={() => openEdit(m)}
                          className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-1.5 text-xs font-medium text-white/70 hover:bg-white/10"
                        >
                          <Pencil className="h-3.5 w-3.5" /> Edit
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      <AnimatePresence>
        {editOpen && editRow ? (
          <GlassModal onClose={() => !editSaving && setEditOpen(false)} title="Edit mistake" className="md:max-w-lg">
            <div className="flex max-h-[70dvh] flex-col gap-3 overflow-y-auto px-4 pb-6 pt-2">
              <div>
                <Label className="text-white/70">Sub username</Label>
                <div className="mt-1 flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3">
                  <span className="text-white/40">@</span>
                  <FormInput
                    value={editSub}
                    onChange={(e) => setEditSub(e.target.value)}
                    className="!border-0 !bg-transparent !px-0"
                  />
                </div>
              </div>
              <div>
                <Label className="text-white/70">Chatter</Label>
                <div className="mt-1">
                  <SearchablePicker
                    value={editChatterId}
                    onChange={(id, label) => {
                      setEditChatterId(id);
                      setEditChatterName(label);
                    }}
                    items={chatterItems}
                    placeholder="Search…"
                    emptyLabel="Select"
                  />
                </div>
              </div>
              <div>
                <Label className="text-white/70">Model</Label>
                <div className="mt-1">
                  <SearchablePicker
                    value={editModelId}
                    onChange={(id, label) => {
                      setEditModelId(id);
                      setEditModelName(label);
                    }}
                    items={modelItems}
                    placeholder="Search…"
                    emptyLabel="Select"
                  />
                </div>
              </div>
              <div>
                <Label className="text-white/70">Date &amp; time (Athens)</Label>
                <FormInput type="datetime-local" value={editLocal} onChange={(e) => setEditLocal(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label className="text-white/70">Reason</Label>
                <select
                  value={editReasonId}
                  onChange={(e) => setEditReasonId(e.target.value)}
                  className="mt-1 flex min-h-11 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white"
                >
                  {reasons.map((r) => (
                    <option key={r.reason_id} value={r.reason_id} className="bg-neutral-900">
                      [{r.category}] {r.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="text-white/70">Explanation</Label>
                <FormTextarea value={editExplanation} onChange={(e) => setEditExplanation(e.target.value)} rows={4} className="mt-1" />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditOpen(false)}
                  disabled={editSaving}
                  className="flex-1 rounded-xl border border-white/15 py-2.5 text-sm text-white/70 hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void saveEdit()}
                  disabled={editSaving}
                  className="flex-1 rounded-xl bg-pink-500/25 py-2.5 text-sm font-semibold text-pink-200 hover:bg-pink-500/35 disabled:opacity-50"
                >
                  {editSaving ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          </GlassModal>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
