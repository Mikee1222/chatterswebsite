"use client";

import * as React from "react";
import { Clock } from "lucide-react";
import { FormField } from "@/components/ui/form-field";
import { FormInput } from "@/components/ui/form-input";
import { cn } from "@/lib/utils";
import { normalizeHHmm } from "@/lib/weekly-program";

export type WeeklyProgramCustomTimeInputProps = {
  label: string;
  required?: boolean;
  /** `HH:mm` (24h); may be unpadded until normalized on change */
  value: string;
  onChange: (next: string) => void;
  ariaInvalid?: boolean;
  /** Step in seconds; default 60 = minute granularity */
  step?: number;
};

/** Native 24h `<input type="time">` for weekly program custom shifts (avoids 12h AM/PM mistakes). */
export function WeeklyProgramCustomTimeInput({
  label,
  required,
  value,
  onChange,
  ariaInvalid,
  step = 60,
}: WeeklyProgramCustomTimeInputProps) {
  const display = React.useMemo(() => {
    const n = normalizeHHmm(value?.trim() ?? "");
    return n ?? "";
  }, [value]);

  return (
    <FormField label={label} icon={<Clock />} required={required}>
      <FormInput
        type="time"
        step={step}
        value={display}
        onChange={(e) => {
          const raw = e.target.value;
          if (!raw) {
            onChange("00:00");
            return;
          }
          const n = normalizeHHmm(raw);
          onChange(n ?? raw.slice(0, 5));
        }}
        aria-invalid={ariaInvalid}
        className={cn(
          "!min-h-[44px] [color-scheme:dark] md:!min-h-[var(--luxury-form-min-height)]",
          "focus:border-pink-500/50"
        )}
      />
    </FormField>
  );
}
