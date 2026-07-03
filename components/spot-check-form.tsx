"use client";

import * as React from "react";
import { ImageIcon } from "lucide-react";
import { VA_FILTER_INPUT } from "@/lib/va-tasks-tokens";
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
        <span className="text-[#B8B4B8]/60">Type</span>
        <select
          value={values.type}
          onChange={(e) => setValues((v) => ({ ...v, type: e.target.value as SpotCheckType }))}
          className={cn(VA_FILTER_INPUT, "w-full")}
          required
        >
          {SPOT_CHECK_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </label>
      <label className="block space-y-1.5 text-sm">
        <span className="text-[#B8B4B8]/60">Exec / VA</span>
        <select
          value={values.exec_va_id}
          onChange={(e) => setValues((v) => ({ ...v, exec_va_id: e.target.value }))}
          className={cn(VA_FILTER_INPUT, "w-full")}
        >
          <option value="">—</option>
          {marketingVas.map((v) => (
            <option key={v.id} value={v.id}>
              {v.full_name || v.email}
            </option>
          ))}
        </select>
      </label>
      <label className="block space-y-1.5 text-sm">
        <span className="text-[#B8B4B8]/60">Creator</span>
        <select
          value={values.creator_id}
          onChange={(e) => setValues((v) => ({ ...v, creator_id: e.target.value }))}
          className={cn(VA_FILTER_INPUT, "w-full")}
        >
          <option value="">—</option>
          {models.map((m) => (
            <option key={m.id} value={m.id}>
              {m.model_name}
            </option>
          ))}
        </select>
      </label>
      <label className="block space-y-1.5 text-sm">
        <span className="text-[#B8B4B8]/60">What was wrong</span>
        <textarea
          value={values.what_was_wrong}
          onChange={(e) => setValues((v) => ({ ...v, what_was_wrong: e.target.value }))}
          rows={3}
          className={cn(VA_FILTER_INPUT, "w-full resize-y py-2")}
          required
        />
      </label>
      <label className="block space-y-1.5 text-sm">
        <span className="text-[#B8B4B8]/60">Action taken</span>
        <textarea
          value={values.action_taken}
          onChange={(e) => setValues((v) => ({ ...v, action_taken: e.target.value }))}
          rows={2}
          className={cn(VA_FILTER_INPUT, "w-full resize-y py-2")}
        />
      </label>
      {!lockStatusToPending ? (
        <label className="block space-y-1.5 text-sm">
          <span className="text-[#B8B4B8]/60">Status</span>
          <select
            value={values.status}
            onChange={(e) => setValues((v) => ({ ...v, status: e.target.value as SpotCheckStatus }))}
            className={cn(VA_FILTER_INPUT, "w-full")}
          >
            {SPOT_CHECK_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <label className="block space-y-1.5 text-sm">
        <span className="text-[#B8B4B8]/60">Attachments</span>
        <input
          type="file"
          multiple
          accept="image/*,.pdf"
          onChange={(e) => setValues((v) => ({ ...v, files: Array.from(e.target.files ?? []) }))}
          className="block w-full text-sm text-[#B8B4B8]/60 file:mr-3 file:rounded-lg file:border-0 file:bg-[#FF1493]/20 file:px-3 file:py-1.5 file:text-sm file:text-[#FFB3D9]"
        />
        {values.files.length > 0 ? (
          <p className="flex items-center gap-1 text-xs text-[#D4AF8C]/70">
            <ImageIcon className="h-3.5 w-3.5" aria-hidden />
            {values.files.length} file(s) selected
          </p>
        ) : null}
      </label>
      <div className="flex flex-wrap justify-end gap-2 pt-2">
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="rounded-xl border border-white/15 px-4 py-2.5 text-sm text-white/80"
          >
            Cancel
          </button>
        ) : null}
        <button type="submit" disabled={saving} className="rounded-xl bg-[#FF1493] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#FF1493]/90 disabled:opacity-50">
          {saving ? "Saving…" : submitLabel}
        </button>
      </div>
    </form>
  );
}
