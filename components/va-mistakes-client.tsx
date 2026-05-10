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

  function handlePaste(e: React.ClipboardEvent) {
    const item = Array.from(e.clipboardData.items).find((i) => i.type.startsWith("image/"));
    if (item) {
      const file = item.getAsFile();
      if (file) setScreenshot(file);
    }
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">Mistakes</h1>
        <p className="mt-1 text-sm text-white/50">Submit chatter mistake reports for admin review.</p>
      </div>

      <div className="flex gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-1">
        <button
          type="button"
          onClick={() => setMainTab("submit")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium transition-colors ${
            mainTab === "submit" ? "bg-pink-500/20 text-white" : "text-white/50 hover:text-white/80"
          }`}
        >
          📝 Submit mistake
        </button>
        <button
          type="button"
          onClick={() => setMainTab("submitted")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium transition-colors ${
            mainTab === "submitted" ? "bg-pink-500/20 text-white" : "text-white/50 hover:text-white/80"
          }`}
        >
          📋 Submitted
        </button>
      </div>

      {mainTab === "submit" ? (
        <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <div>
            <Label className="text-white/70">Sub username</Label>
            <div className="mt-1 flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3">
              <span className="text-white/40">@</span>
              <FormInput
                value={subUsername}
                onChange={(e) => setSubUsername(e.target.value)}
                required
                placeholder="username"
                className="!border-0 !bg-transparent !px-0"
              />
            </div>
          </div>

          <div>
            <Label className="text-white/70">Chatter</Label>
            <div className="mt-1">
              <SearchablePicker
                value={chatterId}
                onChange={(id, label) => {
                  setChatterId(id);
                  setChatterName(label);
                }}
                items={chatterItems}
                placeholder="Search chatters…"
                emptyLabel="Select chatter"
              />
            </div>
          </div>

          <div>
            <Label className="text-white/70">Model</Label>
            <div className="mt-1">
              <SearchablePicker
                value={modelId}
                onChange={(id, label) => {
                  setModelId(id);
                  setModelName(label);
                }}
                items={modelItems}
                placeholder="Search models…"
                emptyLabel="Select model"
              />
            </div>
          </div>

          <div>
            <Label className="text-white/70">Date &amp; time (Athens)</Label>
            <FormInput
              type="datetime-local"
              value={mistakeLocal}
              onChange={(e) => setMistakeLocal(e.target.value)}
              required
              className="mt-1"
            />
          </div>

          <div>
            <Label className="text-white/70">Reason</Label>
            <select
              required
              value={reasonId}
              onChange={(e) => setReasonId(e.target.value)}
              className="mt-1 flex min-h-11 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white focus:border-pink-500/50 focus:outline-none"
            >
              <option value="" disabled className="bg-neutral-900">
                Select reason
              </option>
              <optgroup label="🟡 Low" className="bg-neutral-900">
                {reasons
                  .filter((r) => r.category === "Low")
                  .map((r) => (
                    <option key={r.reason_id} value={r.reason_id} className="bg-neutral-900">
                      {r.label} ({r.points_deduction} pts)
                    </option>
                  ))}
              </optgroup>
              <optgroup label="🟠 Medium" className="bg-neutral-900">
                {reasons
                  .filter((r) => r.category === "Medium")
                  .map((r) => (
                    <option key={r.reason_id} value={r.reason_id} className="bg-neutral-900">
                      {r.label} ({r.points_deduction} pts)
                    </option>
                  ))}
              </optgroup>
              <optgroup label="🔴 High" className="bg-neutral-900">
                {reasons
                  .filter((r) => r.category === "High")
                  .map((r) => (
                    <option key={r.reason_id} value={r.reason_id} className="bg-neutral-900">
                      {r.label} ({r.points_deduction} pts)
                    </option>
                  ))}
              </optgroup>
            </select>
          </div>

          <div>
            <Label className="text-white/70">Screenshot</Label>
            <div
              role="button"
              tabIndex={0}
              onPaste={handlePaste}
              onClick={() => fileRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") fileRef.current?.click();
              }}
              className="mt-1 cursor-pointer rounded-2xl border-2 border-dashed border-white/20 p-8 text-center transition-all hover:border-pink-500/50"
            >
              {screenshot && screenshotPreviewUrl ? (
                <img src={screenshotPreviewUrl} alt="" className="mx-auto max-h-40 rounded-xl" />
              ) : (
                <>
                  <p className="text-white/60">📋 Paste screenshot here (Ctrl+V)</p>
                  <p className="mt-1 text-sm text-white/30">or click to upload</p>
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
            <Label className="text-white/70">Explanation</Label>
            <FormTextarea
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              required
              rows={4}
              className="mt-1"
              placeholder="What happened?"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-gradient-to-r from-pink-500/80 to-fuchsia-600/80 py-3 text-sm font-semibold text-white shadow-lg transition-opacity disabled:opacity-50"
          >
            {submitting ? "Submitting…" : "Submit mistake"}
          </button>
        </form>
      ) : (
        <div className="space-y-4">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setSubTab("all")}
              className={`rounded-xl px-4 py-2 text-xs font-semibold uppercase tracking-wide ${
                subTab === "all" ? "bg-white/10 text-white" : "text-white/45 hover:text-white/70"
              }`}
            >
              All submitted
            </button>
            <button
              type="button"
              onClick={() => setSubTab("rejected")}
              className={`rounded-xl px-4 py-2 text-xs font-semibold uppercase tracking-wide ${
                subTab === "rejected" ? "bg-red-500/20 text-red-300" : "text-white/45 hover:text-white/70"
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
                    className={`rounded-2xl p-4 ${
                      rejected
                        ? "border-2 border-red-500/35 bg-red-500/[0.06]"
                        : "border border-white/10 bg-white/[0.04]"
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${categoryBadgeClass(m.reason_category)}`}>
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
