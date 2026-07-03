"use client";

import * as React from "react";
import { Upload, X } from "lucide-react";
import { VA_CONTENT_ASSIGNMENT_MAX_FILES } from "@/lib/va-content-assignment-files";
import { cn } from "@/lib/utils";

export type VaContentAssignmentFileDropzoneProps = {
  files: File[];
  onChange: (files: File[]) => void;
  maxFiles?: number;
  accept?: string;
  className?: string;
  disabled?: boolean;
};

export function VaContentAssignmentFileDropzone({
  files,
  onChange,
  maxFiles = VA_CONTENT_ASSIGNMENT_MAX_FILES,
  accept = "image/*,.pdf,.doc,.docx,.zip,.mp4,.mov",
  className,
  disabled = false,
}: VaContentAssignmentFileDropzoneProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = React.useState(false);
  const [limitError, setLimitError] = React.useState<string | null>(null);

  function mergeIncoming(incoming: FileList | File[]) {
    if (disabled) return;
    const next = Array.from(incoming);
    if (!next.length) return;

    const combined = [...files, ...next];
    if (combined.length > maxFiles) {
      setLimitError(`You can attach up to ${maxFiles} files. Remove some files or choose fewer.`);
      onChange(combined.slice(0, maxFiles));
      return;
    }

    setLimitError(null);
    onChange(combined);
  }

  function removeAt(index: number) {
    if (disabled) return;
    const next = files.filter((_, i) => i !== index);
    onChange(next);
    if (next.length <= maxFiles) setLimitError(null);
  }

  const atLimit = files.length >= maxFiles;

  return (
    <div className={cn("space-y-2", className)}>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={accept}
        disabled={disabled || atLimit}
        className="hidden"
        onChange={(e) => {
          mergeIncoming(e.target.files ?? []);
          e.target.value = "";
        }}
      />
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled || atLimit}
        onClick={() => !disabled && !atLimit && inputRef.current?.click()}
        onKeyDown={(e) => {
          if (disabled || atLimit) return;
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
        onDragEnter={(e) => {
          e.preventDefault();
          if (!disabled && !atLimit) setDragOver(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled && !atLimit) setDragOver(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setDragOver(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (!disabled && !atLimit) mergeIncoming(e.dataTransfer.files);
        }}
        className={cn(
          "flex min-h-[108px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-5 text-center transition duration-200 motion-reduce:transition-none",
          disabled || atLimit
            ? "cursor-not-allowed border-white/10 bg-white/[0.02] opacity-60"
            : "cursor-pointer",
          !disabled &&
            !atLimit &&
            (dragOver
              ? "border-pink-400/50 bg-pink-500/[0.06] shadow-[0_0_24px_-8px_rgba(236,72,153,0.35)]"
              : "border-white/20 bg-black/30 hover:border-pink-400/35 hover:bg-pink-500/[0.03]")
        )}
      >
        <Upload className="h-6 w-6 text-white/40" aria-hidden />
        <p className="text-sm text-white/55">
          {atLimit ? "File limit reached" : "Click or drag files"}
        </p>
        <p className="text-xs text-white/35">Up to {maxFiles} files · 4 MB each</p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <span
          className={cn(
            "font-medium tabular-nums",
            files.length > maxFiles ? "text-rose-300" : "text-white/50"
          )}
        >
          {files.length}/{maxFiles} files selected
        </span>
        {files.length > 0 && !disabled ? (
          <button
            type="button"
            onClick={() => {
              onChange([]);
              setLimitError(null);
            }}
            className="text-pink-300/90 underline-offset-2 hover:text-pink-200 hover:underline"
          >
            Clear all
          </button>
        ) : null}
      </div>

      {limitError ? (
        <p className="text-xs text-rose-300" role="alert">
          {limitError}
        </p>
      ) : null}

      {files.length > 0 ? (
        <ul className="flex max-h-40 flex-wrap gap-2 overflow-y-auto">
          {files.map((file, i) => (
            <li
              key={`${file.name}-${file.size}-${i}`}
              className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-white/15 bg-white/[0.06] px-2.5 py-1 text-xs text-white/80"
            >
              <span className="truncate">{file.name}</span>
              <button
                type="button"
                disabled={disabled}
                onClick={() => removeAt(i)}
                className="shrink-0 rounded-full p-0.5 text-white/50 hover:bg-white/10 hover:text-white disabled:opacity-40"
                aria-label={`Remove ${file.name}`}
              >
                <X className="h-3 w-3" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
