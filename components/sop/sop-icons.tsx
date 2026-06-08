"use client";

import * as React from "react";
import * as LucideIcons from "lucide-react";
import { BookOpen, type LucideIcon } from "lucide-react";
import { FormInput } from "@/components/ui/form-input";
import { FormSelect } from "@/components/ui/form-select";
import { cn } from "@/lib/utils";

export const SOP_ICON_PRESETS = [
  "BookOpen",
  "Users",
  "User",
  "Megaphone",
  "Target",
  "Briefcase",
  "Headphones",
  "MessageCircle",
  "Video",
  "Layers",
  "Building2",
  "ClipboardList",
  "Sparkles",
  "Crown",
  "Heart",
  "Star",
  "Zap",
  "Shield",
  "Globe",
  "Camera",
  "PenTool",
  "BarChart3",
  "Settings",
  "Mail",
  "Phone",
] as const;

export type SopIconPreset = (typeof SOP_ICON_PRESETS)[number];

const DEFAULT_ICON_NAME = "BookOpen";
const DEFAULT_ICON = BookOpen;

const lucideRegistry = LucideIcons as unknown as Record<string, LucideIcon | undefined>;

function isEmoji(value: string): boolean {
  return /\p{Extended_Pictographic}/u.test(value);
}

export function isValidLucideIconName(name: string): boolean {
  const trimmed = name.trim();
  if (!trimmed || isEmoji(trimmed)) return false;
  const icon = lucideRegistry[trimmed];
  return typeof icon === "function";
}

export function resolveSopIcon(name?: string | null): LucideIcon {
  if (!name?.trim() || isEmoji(name)) return DEFAULT_ICON;
  const icon = lucideRegistry[name.trim()];
  return icon && typeof icon === "function" ? icon : DEFAULT_ICON;
}

/** Normalize stored icon values — never persist emoji or invalid names. */
export function normalizeSopIconName(name?: string | null): string {
  if (!name?.trim() || isEmoji(name)) return DEFAULT_ICON_NAME;
  const trimmed = name.trim();
  return isValidLucideIconName(trimmed) ? trimmed : DEFAULT_ICON_NAME;
}

const ICON_SIZE = {
  sm: "h-4 w-4",
  md: "h-5 w-5",
  lg: "h-6 w-6",
} as const;

export function SopRoleIcon({
  name,
  className,
  size = "md",
}: {
  name?: string | null;
  className?: string;
  size?: keyof typeof ICON_SIZE;
}) {
  const Icon = resolveSopIcon(name);
  return <Icon className={cn(ICON_SIZE[size], className)} strokeWidth={1.75} aria-hidden />;
}

export function SopIconPicker({
  value,
  onChange,
  id,
}: {
  value: string;
  onChange: (name: string) => void;
  id?: string;
}) {
  const trimmed = value.trim();
  const isPreset = (SOP_ICON_PRESETS as readonly string[]).includes(trimmed);
  const [customMode, setCustomMode] = React.useState(!isPreset && isValidLucideIconName(trimmed));

  React.useEffect(() => {
    setCustomMode(!isPreset && isValidLucideIconName(trimmed));
  }, [trimmed, isPreset]);

  const previewName = customMode && trimmed ? trimmed : normalizeSopIconName(value);
  const selectValue = customMode ? "custom" : isPreset ? trimmed : DEFAULT_ICON_NAME;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center text-white/55">
          <SopRoleIcon name={previewName} size="md" />
        </span>
        <FormSelect
          id={id}
          value={selectValue}
          onChange={(e) => {
            const next = e.target.value;
            if (next === "custom") {
              setCustomMode(true);
              if (isPreset) onChange("");
            } else {
              setCustomMode(false);
              onChange(next);
            }
          }}
          className="min-w-0 flex-1"
        >
          {SOP_ICON_PRESETS.map((iconName) => (
            <option key={iconName} value={iconName}>
              {iconName}
            </option>
          ))}
          <option value="custom">Custom Lucide name…</option>
        </FormSelect>
      </div>
      {customMode ? (
        <FormInput
          value={trimmed}
          onChange={(e) => {
            const raw = e.target.value.replace(/[^A-Za-z0-9]/g, "");
            onChange(raw);
          }}
          placeholder="e.g. BookOpen"
          className="font-mono text-sm"
        />
      ) : null}
    </div>
  );
}
