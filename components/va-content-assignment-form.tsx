"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Label } from "@/components/ui/form";
import { FormInput } from "@/components/ui/form-input";
import { Textarea } from "@/components/ui/form";
import { Select, selectOptionClass } from "@/components/ui/form";
import { VaContentAssignmentFileDropzone } from "@/components/va-content-assignment-file-dropzone";
import { VA_CONTENT_ASSIGNMENT_MAX_FILES } from "@/lib/va-content-assignment-files";
import type { ModelRecord } from "@/types";

const CONTENT_TYPES = ["PDF", "Video Script", "Photo Guide", "Other"] as const;
const PRIORITIES = ["low", "normal", "high", "urgent"] as const;

export type VaContentAssignmentFormProps = {
  models: Pick<ModelRecord, "id" | "model_name">[];
  /** When set, posts to admin create API and shows VA selector. */
  vaOptions?: { id: string; full_name: string }[];
  createEndpoint?: string;
  onSuccess?: () => void;
  embedded?: boolean;
  submitLabel?: string;
};

export function VaContentAssignmentForm({
  models,
  vaOptions,
  createEndpoint,
  onSuccess,
  embedded = false,
  submitLabel,
}: VaContentAssignmentFormProps) {
  const router = useRouter();
  const isAdminMode = Boolean(vaOptions?.length);
  const endpoint = createEndpoint ?? (isAdminMode ? "/api/admin/va-content-assignments/create" : "/api/va/content/create");

  const [submitting, setSubmitting] = React.useState(false);
  const [uploadProgress, setUploadProgress] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [files, setFiles] = React.useState<File[]>([]);

  const [modelId, setModelId] = React.useState("");
  const [vaId, setVaId] = React.useState("");
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [contentType, setContentType] = React.useState<string>("Other");
  const [priority, setPriority] = React.useState<string>("normal");
  const [deadline, setDeadline] = React.useState("");
  const [fileUrl, setFileUrl] = React.useState("");

  const resetForm = () => {
    setModelId("");
    setVaId("");
    setTitle("");
    setDescription("");
    setContentType("Other");
    setPriority("normal");
    setDeadline("");
    setFileUrl("");
    setFiles([]);
    setUploadProgress(null);
  };

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (isAdminMode && !vaId.trim()) {
      setError("Select a VA.");
      return;
    }
    if (!modelId.trim()) {
      setError("Select a model.");
      return;
    }
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    if (files.length > VA_CONTENT_ASSIGNMENT_MAX_FILES) {
      setError(`Too many files (max ${VA_CONTENT_ASSIGNMENT_MAX_FILES}).`);
      return;
    }

    setSubmitting(true);
    setUploadProgress(files.length > 0 ? `Preparing ${files.length} file${files.length === 1 ? "" : "s"}…` : null);

    try {
      const fd = new FormData();
      if (isAdminMode) fd.set("va_user_record_id", vaId.trim());
      fd.set("model_record_id", modelId.trim());
      fd.set("title", title.trim());
      fd.set("description", description.trim());
      fd.set("content_type", contentType);
      fd.set("priority", priority);
      if (deadline.trim()) fd.set("deadline", deadline.trim());
      if (fileUrl.trim() && files.length === 0) fd.set("file_url", fileUrl.trim());
      for (const file of files) {
        fd.append("files", file);
      }

      if (files.length > 0) {
        setUploadProgress(`Uploading ${files.length} file${files.length === 1 ? "" : "s"}…`);
      }

      const res = await fetch(endpoint, { method: "POST", body: fd });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Request failed");
        return;
      }
      resetForm();
      router.refresh();
      onSuccess?.();
    } finally {
      setSubmitting(false);
      setUploadProgress(null);
    }
  };

  const buttonClass = isAdminMode
    ? "border-pink-500/40 bg-pink-500/15 text-pink-100 hover:bg-pink-500/25"
    : "border-sky-500/40 bg-sky-500/15 text-sky-100 hover:bg-sky-500/30";

  return (
    <form
      onSubmit={(ev) => void onSubmit(ev)}
      className={
        embedded
          ? "space-y-4 p-5"
          : "space-y-4 rounded-2xl border border-white/10 bg-white/[0.06] p-6"
      }
      style={embedded ? undefined : { boxShadow: "0 0 0 1px rgba(255,255,255,0.04)" }}
    >
      {!embedded ? <h2 className="text-lg font-semibold text-white">New assignment</h2> : null}
      {error ? <p className="text-sm text-rose-300">{error}</p> : null}
      {uploadProgress ? <p className="text-xs text-white/50">{uploadProgress}</p> : null}

      {isAdminMode ? (
        <div>
          <Label htmlFor="va-ca-va">Virtual assistant</Label>
          <Select
            id="va-ca-va"
            value={vaId}
            onChange={(e) => setVaId(e.target.value)}
            required
            className="mt-1 min-h-11 w-full border-white/10 bg-black/30 text-white"
          >
            <option value="" disabled className={selectOptionClass}>
              Select VA…
            </option>
            {vaOptions!.map((v) => (
              <option key={v.id} value={v.id} className={selectOptionClass}>
                {v.full_name || v.id}
              </option>
            ))}
          </Select>
        </div>
      ) : null}

      <div>
        <Label htmlFor="va-ca-model">Model</Label>
        <Select
          id="va-ca-model"
          value={modelId}
          onChange={(e) => setModelId(e.target.value)}
          required
          className="mt-1 min-h-11 w-full border-white/10 bg-black/30 text-white"
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
        <FormInput
          id="va-ca-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          className="mt-1"
          placeholder="Brief title"
        />
      </div>

      <div>
        <Label htmlFor="va-ca-description">Description</Label>
        <Textarea
          id="va-ca-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="mt-1 min-h-[100px] border-white/10 bg-black/30 text-white"
          placeholder="Instructions for the model…"
        />
      </div>

      <div>
        <Label htmlFor="va-ca-content_type">Content type</Label>
        <Select
          id="va-ca-content_type"
          value={contentType}
          onChange={(e) => setContentType(e.target.value)}
          className="mt-1 min-h-11 w-full border-white/10 bg-black/30 text-white"
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
          value={fileUrl}
          onChange={(e) => setFileUrl(e.target.value)}
          type="url"
          className="mt-1"
          placeholder="https://… or upload files below"
          disabled={files.length > 0}
        />
        <p className="mt-1 text-xs text-white/45">
          Public HTTPS link, or upload up to {VA_CONTENT_ASSIGNMENT_MAX_FILES} files below (not both).
        </p>
      </div>

      <div>
        <Label>Attachments (optional)</Label>
        <VaContentAssignmentFileDropzone
          files={files}
          onChange={(next) => {
            setFiles(next);
            if (next.length > 0) setFileUrl("");
          }}
          className="mt-1"
          disabled={submitting}
        />
      </div>

      <div>
        <Label htmlFor="va-ca-deadline">Deadline</Label>
        <FormInput
          id="va-ca-deadline"
          value={deadline}
          onChange={(e) => setDeadline(e.target.value)}
          type="date"
          className="mt-1"
        />
      </div>

      <div>
        <Label htmlFor="va-ca-priority">Priority</Label>
        <Select
          id="va-ca-priority"
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
          className="mt-1 min-h-11 w-full border-white/10 bg-black/30 text-white"
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
        disabled={submitting || models.length === 0 || (isAdminMode && (vaOptions?.length ?? 0) === 0)}
        className={`w-full rounded-xl border py-3 text-sm font-semibold disabled:opacity-50 ${buttonClass}`}
      >
        {submitting
          ? uploadProgress ?? "Creating…"
          : submitLabel ?? (isAdminMode ? "Create assignment" : "Create assignment")}
      </button>
    </form>
  );
}
