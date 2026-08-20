"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import {
  APPLY_BTN_ADMIN_CHAMPAGNE,
  APPLY_BTN_ADMIN_PRIMARY,
  APPLY_BTN_ADMIN_SECONDARY,
  APPLY_BTN_GHOST,
  APPLY_BTN_PRIMARY,
  APPLY_BTN_PRIMARY_INLINE,
  APPLY_BTN_SECONDARY,
} from "@/lib/application-ui-tokens";
import { cn } from "@/lib/utils";

type Variant =
  | "primary"
  | "primaryInline"
  | "secondary"
  | "ghost"
  | "adminPrimary"
  | "adminSecondary"
  | "adminChampagne";

const VARIANT_CLASS: Record<Variant, string> = {
  primary: APPLY_BTN_PRIMARY,
  primaryInline: APPLY_BTN_PRIMARY_INLINE,
  secondary: APPLY_BTN_SECONDARY,
  ghost: APPLY_BTN_GHOST,
  adminPrimary: APPLY_BTN_ADMIN_PRIMARY,
  adminSecondary: APPLY_BTN_ADMIN_SECONDARY,
  adminChampagne: APPLY_BTN_ADMIN_CHAMPAGNE,
};

export type ApplyButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  loading?: boolean;
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
};

export function ApplyButton({
  variant = "primary",
  loading,
  iconLeft,
  iconRight,
  className,
  disabled,
  children,
  type = "button",
  ...props
}: ApplyButtonProps) {
  const busy = Boolean(disabled || loading);
  return (
    <button
      type={type}
      disabled={busy}
      className={cn(VARIANT_CLASS[variant], className)}
      {...props}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
      ) : (
        iconLeft
      )}
      <span>{children}</span>
      {!loading ? iconRight : null}
    </button>
  );
}
