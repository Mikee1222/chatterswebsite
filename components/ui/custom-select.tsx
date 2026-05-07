"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type CustomSelectOption = { value: string; label: string };

export type CustomSelectProps = {
  value: string;
  onChange: (next: string) => void;
  options: CustomSelectOption[];
  placeholder?: string;
  className?: string;
  /** Merged onto the trigger button (e.g. pink border accents). */
  triggerClassName?: string;
  disabled?: boolean;
  required?: boolean;
  name?: string;
  id?: string;
  "aria-invalid"?: boolean;
  "aria-labelledby"?: string;
  "aria-label"?: string;
  /** When true, menu is fixed to the viewport and portaled to `document.body` (avoids clipping by overflow:hidden). */
  portaled?: boolean;
};

const defaultButtonClass =
  "flex h-11 w-full min-h-0 items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/5 px-4 text-sm text-white transition-all hover:border-white/20 hover:bg-white/8 disabled:pointer-events-none disabled:opacity-50";

const panelSurfaceClass =
  "rounded-xl border border-white/10 bg-[#1a1a1a] shadow-2xl max-h-48 overflow-y-auto scroll-smooth md:max-h-72";

export function CustomSelect({
  value,
  onChange,
  options,
  placeholder,
  className,
  triggerClassName,
  disabled,
  required,
  name,
  id,
  "aria-invalid": ariaInvalid,
  "aria-labelledby": ariaLabelledby,
  "aria-label": ariaLabel,
  portaled = false,
}: CustomSelectProps) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const [flipUp, setFlipUp] = React.useState(false);
  const [portalPos, setPortalPos] = React.useState<{
    left: number;
    width: number;
    top?: number;
    bottom?: number;
  } | null>(null);

  const updatePortalPosition = React.useCallback(() => {
    const root = ref.current;
    if (!root || !open || !portaled) return;
    const rect = root.getBoundingClientRect();
    const mobile = typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches;
    const need = mobile ? 200 : 280;
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const up = spaceBelow < need && spaceAbove > spaceBelow;
    const gap = 4;
    if (up) {
      setPortalPos({
        left: rect.left,
        width: rect.width,
        bottom: window.innerHeight - rect.top + gap,
      });
    } else {
      setPortalPos({
        left: rect.left,
        width: rect.width,
        top: rect.bottom + gap,
      });
    }
  }, [open, portaled]);

  React.useLayoutEffect(() => {
    if (!open) {
      setPortalPos(null);
      return;
    }
    const root = ref.current;
    if (!root) return;

    if (portaled) {
      updatePortalPosition();
      window.addEventListener("resize", updatePortalPosition);
      window.addEventListener("scroll", updatePortalPosition, true);
      return () => {
        window.removeEventListener("resize", updatePortalPosition);
        window.removeEventListener("scroll", updatePortalPosition, true);
      };
    }

    const rect = root.getBoundingClientRect();
    const mobile = typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches;
    const need = mobile ? 200 : 280;
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    setFlipUp(spaceBelow < need && spaceAbove > spaceBelow);
    return undefined;
  }, [open, portaled, updatePortalPosition, options.length]);

  React.useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  React.useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      if (ref.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const currentLabel = options.find((o) => o.value === value)?.label;

  const listbox = (
    <div
      ref={panelRef}
      className={cn(
        panelSurfaceClass,
        !portaled && "absolute left-0 right-0 z-[9999]",
        !portaled && (flipUp ? "bottom-full mb-1" : "top-full mt-1")
      )}
      style={
        portaled && portalPos
          ? {
              position: "fixed",
              left: portalPos.left,
              width: portalPos.width,
              zIndex: 10050,
              maxHeight: 288,
              overflowY: "auto",
              ...(portalPos.top != null ? { top: portalPos.top } : {}),
              ...(portalPos.bottom != null ? { bottom: portalPos.bottom } : {}),
            }
          : undefined
      }
      role="listbox"
    >
      {options.map((option) => (
        <button
          key={option.value === "" ? "__empty__" : option.value}
          type="button"
          role="option"
          aria-selected={value === option.value}
          onClick={() => {
            onChange(option.value);
            setOpen(false);
          }}
          className="flex w-full items-center justify-between px-4 py-3 text-left text-sm transition-colors hover:bg-white/10"
        >
          <span className={value === option.value ? "font-medium text-pink-400" : "text-white"}>{option.label}</span>
          {value === option.value ? <Check className="h-4 w-4 shrink-0 text-pink-400" /> : null}
        </button>
      ))}
    </div>
  );

  return (
    <div
      ref={ref}
      className={cn("relative", className)}
      style={{ position: "relative", zIndex: open ? 50 : 1 }}
    >
      {name != null && name !== "" ? (
        <input type="hidden" name={name} value={value} required={required} readOnly aria-hidden tabIndex={-1} />
      ) : null}
      <button
        type="button"
        id={id}
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-required={required || undefined}
        aria-invalid={ariaInvalid}
        aria-labelledby={ariaLabelledby}
        aria-label={ariaLabel}
        onClick={() => !disabled && setOpen(!open)}
        className={cn(defaultButtonClass, triggerClassName)}
      >
        <span className={value ? "text-white" : "text-white/40"}>
          {currentLabel || placeholder || "Select…"}
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-white/40 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && !disabled && portaled && portalPos && typeof document !== "undefined"
        ? createPortal(listbox, document.body)
        : null}
      {open && !disabled && !portaled ? listbox : null}
    </div>
  );
}

/** Stable 1–12 hour options for 12h time blocks */
export const CUSTOM_SELECT_HOUR_12_OPTIONS: CustomSelectOption[] = Array.from({ length: 12 }, (_, i) => {
  const h = i + 1;
  return { value: String(h), label: String(h) };
});
