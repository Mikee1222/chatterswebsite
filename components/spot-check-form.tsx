"use client";

import * as React from "react";
import {
  ManagerReviewFileDropzone,
  ManagerReviewSelect,
  ManagerReviewTextarea,
  ReviewFieldLabel,
  VA_BTN_PRIMARY,
  type CustomSelectOption,
} from "@/components/manager-review-ui";
import { cn } from "@/lib/utils";
import {
  SPOT_CHECK_STATUSES,
  SPOT_CHECK_TYPES,
  type SpotCheckStatus,
  type SpotCheckType,
} from "@/lib/marketing-reviews-helpers";
import type { ModelRecord, UserRecord } from "@/types";

export type SpotCheckFormValues = {
  type: SpotCheckType;
  exec_va_id: string;
  creator_id: string;
  what_was_wrong: string;
  action_taken: string;
  status: SpotCheckStatus;
  files: File[];
};

type Props = {
  vaUsers: UserRecord[];
  models: ModelRecord[];
  saving?: boolean;
  submitLabel?: string;
  /** When true, status is locked to Pending and hidden from the form. */
  lockStatusToPending?: boolean;
  onSubmit: (values: SpotCheckFormValues) => void | Promise<void | boolean>;
  onCancel?: () => void;
  className?: string;
};

const DEFAULT_VALUES: SpotCheckFormValues = {
  type: "Account audit",
  exec_va_id: "",
  creator_id: "",
  what_was_wrong: "",
  action_taken: "",
  status: "Pending",
  files: [],
};

export function SpotCheckForm({
  vaUsers,
  models,
  saving = false,
  submitLabel = "Save finding",
  lockStatusToPending = false,
  onSubmit,
  onCancel,
  className,
}: Props) {
  const [values, setValues] = React.useState<SpotCheckFormValues>(DEFAULT_VALUES);

  const marketingVas = React.useMemo(
    () =>
      vaUsers.filter(
        (u) => u.va_type === "marketing" || u.va_type === "both" || !u.va_type,
      ),
    [vaUsers],
  );

  const typeOptions = React.useMemo<CustomSelectOption[]>(
    () => SPOT_CHECK_TYPES.map((t) => ({ value: t, label: t })),
    [],
  );
  const vaOptions = React.useMemo<CustomSelectOption[]>(
    () => [
      { value: "", label: "—" },
      ...marketingVas.map((v) => ({ value: v.id, label: v.full_name || v.email || "—" })),
    ],
    [marketingVas],
  );
  const modelOptions = React.useMemo<CustomSelectOption[]>(
    () => [
      { value: "", label: "—" },
      ...models.map((m) => ({ value: m.id, label: m.model_name })),
    ],
    [models],
  );
  const statusOptions = React.useMemo<CustomSelectOption[]>(
    () => SPOT_CHECK_STATUSES.map((s) => ({ value: s, label: s })),
    [],
  );

  function reset() {
    setValues(DEFAULT_VALUES);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = lockStatusToPending ? { ...values, status: "Pending" as const } : values;
    const ok = await onSubmit(payload);
    if (ok !== false) reset();
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className={cn("space-y-4", className)}>
      <label className="block space-y-1.5 text-sm">
        <ReviewFieldLabel>Type</ReviewFieldLabel>
        <ManagerReviewSelect
          value={values.type}
          onChange={(v) => setValues((prev) => ({ ...prev, type: v as SpotCheckType }))}
          options={typeOptions}
          className="w-full"
          required
        />
      </label>
      <label className="block space-y-1.5 text-sm">
        <ReviewFieldLabel>Exec / VA</ReviewFieldLabel>
        <ManagerReviewSelect
          value={values.exec_va_id}
          onChange={(v) => setValues((prev) => ({ ...prev, exec_va_id: v }))}
          options={vaOptions}
          className="w-full"
        />
      </label>
      <label className="block space-y-1.5 text-sm">
        <ReviewFieldLabel>Creator</ReviewFieldLabel>
        <ManagerReviewSelect
          value={values.creator_id}
          onChange={(v) => setValues((prev) => ({ ...prev, creator_id: v }))}
          options={modelOptions}
          className="w-full"
        />
      </label>
      <label className="block space-y-1.5 text-sm">
        <ReviewFieldLabel>What was wrong</ReviewFieldLabel>
        <ManagerReviewTextarea
          value={values.what_was_wrong}
          onChange={(e) => setValues((prev) => ({ ...prev, what_was_wrong: e.target.value }))}
          rows={3}
          required
        />
      </label>
      <label className="block space-y-1.5 text-sm">
        <ReviewFieldLabel>Action taken</ReviewFieldLabel>
        <ManagerReviewTextarea
          value={values.action_taken}
          onChange={(e) => setValues((prev) => ({ ...prev, action_taken: e.target.value }))}
          rows={2}
        />
      </label>
      {!lockStatusToPending ? (
        <label className="block space-y-1.5 text-sm">
          <ReviewFieldLabel>Status</ReviewFieldLabel>
          <ManagerReviewSelect
            value={values.status}
            onChange={(v) => setValues((prev) => ({ ...prev, status: v as SpotCheckStatus }))}
            options={statusOptions}
            className="w-full"
          />
        </label>
      ) : null}
      <div className="block space-y-1.5 text-sm">
        <ReviewFieldLabel>Attachments</ReviewFieldLabel>
        <ManagerReviewFileDropzone
          files={values.files}
          onChange={(files) => setValues((prev) => ({ ...prev, files }))}
        />
      </div>
      <div className="flex flex-wrap justify-end gap-2 pt-2">
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="rounded-xl border border-white/15 px-4 py-2.5 text-sm text-white/80 transition hover:border-[#D4AF8C]/30 hover:text-white"
          >
            Cancel
          </button>
        ) : null}
        <button type="submit" disabled={saving} className={cn(VA_BTN_PRIMARY, "px-4 py-2.5 disabled:opacity-50")}>
          {saving ? "Saving…" : submitLabel}
        </button>
      </div>
    </form>
  );
}
