"use client";

import { Plus, X } from "lucide-react";
import { VA_BTN_SECONDARY, VA_FILTER_INPUT } from "@/lib/va-tasks-tokens";
import {
  UPLOAD_FOLDER_NAME_HINT,
  UPLOAD_FOLDER_NAME_PLACEHOLDER,
} from "@/lib/upload-folder-names";
import { cn } from "@/lib/utils";

export function UploadFolderNamesList({
  names,
  label,
  className,
}: {
  names: string[];
  label: string;
  className?: string;
}) {
  if (names.length === 0) return null;
  return (
    <div className={className}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#D4AF8C]/65">
        {label}
      </p>
      <ul className="mt-1.5 space-y-1">
        {names.map((name, i) => (
          <li key={`${i}-${name}`} className="break-all text-sm text-white/90">
            {name}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function UploadFolderNamesFields({
  values,
  onChange,
  disabled,
}: {
  values: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}) {
  const rows = values.length > 0 ? values : [""];

  function setRow(index: number, value: string) {
    const next = [...rows];
    next[index] = value;
    onChange(next);
  }

  function removeRow(index: number) {
    if (rows.length <= 1) {
      onChange([""]);
      return;
    }
    onChange(rows.filter((_, i) => i !== index));
  }

  function addRow() {
    onChange([...rows, ""]);
  }

  return (
    <div className="mt-4 space-y-2">
      <p className="text-[11px] leading-relaxed text-[#B8B4B8]/50">{UPLOAD_FOLDER_NAME_HINT}</p>
      {rows.map((value, index) => (
        <div key={index} className="flex items-center gap-2">
          <input
            className={cn(VA_FILTER_INPUT, "min-w-0 flex-1")}
            placeholder={index === 0 ? UPLOAD_FOLDER_NAME_PLACEHOLDER : "Another folder name"}
            value={value}
            disabled={disabled}
            onChange={(e) => setRow(index, e.target.value)}
            aria-label={`Folder name ${index + 1}`}
          />
          {rows.length > 1 ? (
            <button
              type="button"
              className={cn(VA_BTN_SECONDARY, "shrink-0 px-2.5 py-2")}
              disabled={disabled}
              onClick={() => removeRow(index)}
              aria-label={`Remove folder name ${index + 1}`}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
      ))}
      <button
        type="button"
        className={cn(VA_BTN_SECONDARY, "inline-flex items-center gap-1.5 text-xs")}
        disabled={disabled}
        onClick={addRow}
      >
        <Plus className="h-3.5 w-3.5" /> Add another folder
      </button>
    </div>
  );
}
