"use client";

import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { Label } from "@/components/ui/form";

const inputClass =
  "w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 pr-12 text-[15px] text-white placeholder:text-white/40 transition-colors focus:border-[hsl(330,80%,55%)]/60 focus:outline-none focus:ring-2 focus:ring-[hsl(330,80%,55%)]/20 focus:bg-white/[0.08] hover:border-white/15";

export function LoginPasswordField(props: React.ComponentPropsWithoutRef<"input">) {
  const [showPassword, setShowPassword] = React.useState(false);
  const { className = "", ...rest } = props;
  return (
    <div>
      <Label htmlFor={props.id ?? "password"}>Password</Label>
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
          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-white/50 transition-colors hover:bg-white/10 hover:text-white/80 focus:outline-none focus:ring-2 focus:ring-[hsl(330,80%,55%)]/30 focus:ring-offset-0"
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
