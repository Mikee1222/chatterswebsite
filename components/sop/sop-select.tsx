"use client";

import {
  CustomSelect,
  type CustomSelectOption,
  type CustomSelectProps,
} from "@/components/ui/custom-select";
import { cn } from "@/lib/utils";

const sopTriggerClass =
  "min-h-[52px] rounded-xl border-white/12 bg-[rgba(14,14,20,0.68)] backdrop-blur-sm hover:border-pink-400/28 hover:bg-[rgba(22,22,30,0.78)] focus-visible:border-pink-500/45 focus-visible:ring-2 focus-visible:ring-pink-500/22";

export type SopSelectProps = CustomSelectProps & {
  options: CustomSelectOption[];
};

/** Dark-glass dropdown for SOP modals and forms — portaled by default to avoid modal clipping. */
export function SopSelect({
  triggerClassName,
  portaled = true,
  className,
  ...props
}: SopSelectProps) {
  return (
    <CustomSelect
      portaled={portaled}
      className={className}
      triggerClassName={cn(sopTriggerClass, triggerClassName)}
      {...props}
    />
  );
}
