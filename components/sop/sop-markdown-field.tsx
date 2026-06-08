"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { FormTextarea } from "@/components/ui/form-textarea";
import { Markdown } from "@/components/ui/markdown";
import { SopFormLabel } from "@/components/sop/sop-form-label";

type Tab = "edit" | "preview";

export function SopMarkdownField({
  label,
  value,
  onChange,
  rows = 8,
  placeholder,
  id,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
  id?: string;
}) {
  const [mobileTab, setMobileTab] = React.useState<Tab>("edit");
  const fieldId = id ?? React.useId();

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <SopFormLabel htmlFor={fieldId} className="mb-0">
          {label}
        </SopFormLabel>
        <div className="flex rounded-xl border border-white/10 bg-black/30 p-0.5 md:hidden">
          {(["edit", "preview"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setMobileTab(tab)}
              className={cn(
                "min-h-[36px] rounded-lg px-3 text-xs font-semibold uppercase tracking-wide transition",
                mobileTab === tab
                  ? "bg-white/10 text-white"
                  : "text-white/45 hover:text-white/70"
              )}
            >
              {tab === "edit" ? "Edit" : "Preview"}
            </button>
          ))}
        </div>
      </div>

      <div className="hidden gap-4 md:grid md:grid-cols-2">
        <FormTextarea
          id={fieldId}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={rows}
          placeholder={placeholder}
          className="min-h-[200px]"
        />
        <div className="min-h-[200px] overflow-y-auto rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-white/35">
            Preview
          </p>
          <Markdown framed={false}>{value}</Markdown>
        </div>
      </div>

      <div className="md:hidden">
        {mobileTab === "edit" ? (
          <FormTextarea
            id={fieldId}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            rows={rows}
            placeholder={placeholder}
            className="min-h-[180px]"
          />
        ) : (
          <div className="min-h-[180px] overflow-y-auto rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <Markdown framed={false}>{value}</Markdown>
          </div>
        )}
      </div>
    </div>
  );
}
