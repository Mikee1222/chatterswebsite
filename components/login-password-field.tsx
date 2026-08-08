"use client";

import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { Label } from "@/components/ui/form";
import { cn } from "@/lib/utils";

const inputClass = cn(
  "w-full min-h-11 rounded-2xl border border-white/10 bg-white/5 px-4 py-3.5 pr-12 text-base text-white placeholder:text-white/30 [color-scheme:dark]",
  "transition-[border-color,box-shadow,background-color] duration-150 ease-out",
  "focus:border-[#FF1493]/55 focus:outline-none focus:ring-0",
  "disabled:cursor-not-allowed disabled:opacity-60",
  "md:min-h-[52px] md:rounded-xl md:border-white/12 md:bg-[#0D0B0D] md:py-4 md:text-[15px] md:placeholder:text-white/40",
  "md:hover:border-[#FF1493]/30 md:hover:bg-[#151315]",
  "md:focus:border-[#FF1493] md:focus:ring-2 md:focus:ring-[#FF1493]/25 md:focus:bg-[#151315]",
  "md:disabled:hover:border-white/12 md:disabled:hover:bg-[#0D0B0D]"
);

export function LoginPasswordField(
  props: React.ComponentPropsWithoutRef<"input"> & { omitLabel?: boolean }
) {
  const [showPassword, setShowPassword] = React.useState(false);
  const { className = "", omitLabel: _omit, ...rest } = props;
  return (
    <div>
      {!_omit ? <Label htmlFor={props.id ?? "password"}>Password</Label> : null}
      <div className="relative">
        <input
          {...rest}
          id={props.id ?? "password"}
          type={showPassword ? "text" : "password"}
          autoComplete="current-password"
          className={`${inputClass} ${className}`}
        />
        <button
          type="button"
          onClick={() => setShowPassword((v) => !v)}
          disabled={rest.disabled}
          className={cn(
            "absolute right-2.5 top-1/2 -translate-y-1/2 touch-target-min",
            "inline-flex items-center justify-center rounded-lg p-2 text-white/50",
            "transition-colors duration-150",
            "hover:bg-white/10 hover:text-[#D4AF8C]",
            "focus:outline-none focus:ring-2 focus:ring-[#FF1493]/30 focus:ring-offset-0",
            "disabled:pointer-events-none disabled:opacity-40"
          )}
          aria-label={showPassword ? "Hide password" : "Show password"}
          tabIndex={-1}
        >
          {showPassword ? (
            <EyeOff className="h-5 w-5" strokeWidth={1.8} />
          ) : (
            <Eye className="h-5 w-5" strokeWidth={1.8} />
          )}
        </button>
      </div>
    </div>
  );
}
