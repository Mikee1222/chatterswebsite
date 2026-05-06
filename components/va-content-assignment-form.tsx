"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Label } from "@/components/ui/form";
import { FormInput } from "@/components/ui/form-input";
import { Textarea } from "@/components/ui/form";
import { Select, selectOptionClass } from "@/components/ui/form";
import type { ModelRecord } from "@/types";

const CONTENT_TYPES = ["PDF", "Video Script", "Photo Guide", "Other"] as const;
const PRIORITIES = ["low", "normal", "high", "urgent"] as const;

export type VaContentAssignmentFormProps = {
  models: Pick<ModelRecord, "id" | "model_name">[];
};

export function VaContentAssignmentForm({ models }: VaContentAssignmentFormProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const form = e.currentTarget;
      const fd = new FormData(form);
      const res = await fetch("/api/va/content/create", { method: "POST", body: fd });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Request failed");
        return;
      }
      form.reset();
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={(ev) => void onSubmit(ev)}
      className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.06] p-6"
      style={{ boxShadow: "0 0 0 1px rgba(255,255,255,0.04)" }}
    >
      <h2 className="text-lg font-semibold text-white">New assignment</h2>
      {error ? <p className="text-sm text-rose-300">{error}</p> : null}

      <div>
        <Label htmlFor="va-ca-model">Model</Label>
        <Select
          id="va-ca-model"
          name="model_record_id"
          required
          className="mt-1 min-h-11 w-full border-white/10 bg-black/30 text-white"
          defaultValue=""
        >
          <option value="" disabled className={selectOptionClass}>
            Select model…
          </option>
          {models.map((m) => (
            <option key={m.id} value={m.id} className={selectOptionClass}>
              {m.model_name || m.id}
            </option>
          ))}
        </Select>
      </div>

      <div>
        <Label htmlFor="va-ca-title">Title</Label>
        <FormInput id="va-ca-title" name="title" required className="mt-1" placeholder="Brief title" />
      </div>

      <div>
        <Label htmlFor="va-ca-description">Description</Label>
        <Textarea
          id="va-ca-description"
          name="description"
          className="mt-1 min-h-[100px] border-white/10 bg-black/30 text-white"
          placeholder="Instructions for the model…"
        />
      </div>

      <div>
        <Label htmlFor="va-ca-content_type">Content type</Label>
        <Select
          id="va-ca-content_type"
          name="content_type"
          className="mt-1 min-h-11 w-full border-white/10 bg-black/30 text-white"
          defaultValue="Other"
        >
          {CONTENT_TYPES.map((c) => (
            <option key={c} value={c} className={selectOptionClass}>
              {c}
            </option>
          ))}
        </Select>
      </div>

      <div>
        <Label htmlFor="va-ca-file_url">File URL (optional)</Label>
        <FormInput
          id="va-ca-file_url"
          name="file_url"
          type="url"
          className="mt-1"
          placeholder="https://… or upload below"
        />
        <p className="mt-1 text-xs text-white/45">Public HTTPS link, or upload a file (e.g. PDF).</p>
      </div>

      <div>
        <Label htmlFor="va-ca-file">Upload PDF / file (optional)</Label>
        <input
          id="va-ca-file"
          name="file"
          type="file"
          className="mt-1 block w-full text-sm text-white/80 file:mr-3 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-white"
        />
      </div>

      <div>
        <Label htmlFor="va-ca-deadline">Deadline</Label>
        <FormInput id="va-ca-deadline" name="deadline" type="date" className="mt-1" />
      </div>

      <div>
        <Label htmlFor="va-ca-priority">Priority</Label>
        <Select
          id="va-ca-priority"
          name="priority"
          className="mt-1 min-h-11 w-full border-white/10 bg-black/30 text-white"
          defaultValue="normal"
        >
          {PRIORITIES.map((p) => (
            <option key={p} value={p} className={selectOptionClass}>
              {p}
            </option>
          ))}
        </Select>
      </div>

      <button
        type="submit"
        disabled={submitting || models.length === 0}
        className="w-full rounded-xl border border-pink-500/40 bg-pink-500/15 py-3 text-sm font-semibold text-pink-100 hover:bg-pink-500/25 disabled:opacity-50"
      >
        {submitting ? "Creating…" : "Create assignment"}
      </button>
    </form>
  );
}
