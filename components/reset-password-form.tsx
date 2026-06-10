"use client";

import * as React from "react";
import Link from "next/link";
import { Eye, EyeOff, Lock, Shield } from "lucide-react";
import { setAccountPassword } from "@/app/actions/accounts";
import { ROUTES } from "@/lib/routes";
import { btnSecondaryClass, formSpace } from "@/components/ui/form";
import { FormField } from "@/components/ui/form-field";
import { FormInput } from "@/components/ui/form-input";
import { FormSubmitButton } from "@/components/ui/form-submit-button";
import { AdminRowAvatar } from "@/components/admin-list-primitives";
import { cn } from "@/lib/utils";

function passwordStrength(pw: string): { score: number; label: string; color: string } {
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  const labels = ["", "Weak", "Fair", "Good", "Strong", "Very strong"];
  const colors = ["", "bg-red-500", "bg-orange-500", "bg-amber-500", "bg-emerald-500", "bg-emerald-400"];
  return {
    score,
    label: labels[Math.min(score, 5)] || "",
    color: colors[Math.min(score, 5)] || "bg-white/20",
  };
}

type Props = {
  recordId: string;
  fullName: string;
  email: string;
};

export function ResetPasswordForm({ recordId, fullName, email }: Props) {
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [showConfirm, setShowConfirm] = React.useState(false);
  const strength = passwordStrength(password);
  const mismatch = confirm.length > 0 && password !== confirm;

  return (
    <div className="mx-auto w-full max-w-md">
      <div className="glass-card overflow-hidden rounded-2xl border border-white/10 p-6 shadow-[0_0_48px_-16px_rgba(236,72,153,0.15)]">
        <div className="mb-6 flex items-center gap-4 border-b border-white/10 pb-5">
          <AdminRowAvatar name={fullName || email || "?"} />
          <div className="min-w-0">
            <p className="truncate font-semibold text-white">{fullName}</p>
            <p className="truncate text-sm text-white/55">{email}</p>
          </div>
        </div>

        <form action={setAccountPassword} className={formSpace}>
          <input type="hidden" name="recordId" value={recordId} />

          <FormField label="New password" icon={<Lock />} htmlFor="password" required description="Minimum 8 characters.">
            <div className="space-y-2">
              <div className="relative">
                <FormInput
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  minLength={8}
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pr-11"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-white/45 hover:bg-white/10 hover:text-white/80"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {password.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div
                        key={i}
                        className={cn(
                          "h-1 flex-1 rounded-full transition-colors",
                          i <= strength.score ? strength.color : "bg-white/10"
                        )}
                      />
                    ))}
                  </div>
                  {strength.label ? (
                    <p className="text-xs text-white/45">Strength: {strength.label}</p>
                  ) : null}
                </div>
              )}
            </div>
          </FormField>

          <FormField label="Confirm password" icon={<Lock />} htmlFor="confirm_password" required>
            <div className="relative">
              <FormInput
                id="confirm_password"
                type={showConfirm ? "text" : "password"}
                minLength={8}
                required
                placeholder="••••••••"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="pr-11"
                error={mismatch ? "Passwords do not match" : undefined}
              />
              <button
                type="button"
                onClick={() => setShowConfirm((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-white/45 hover:bg-white/10 hover:text-white/80"
                aria-label={showConfirm ? "Hide confirm password" : "Show confirm password"}
              >
                {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </FormField>

          <div className="flex items-center gap-2 text-xs text-white/40">
            <Shield className="h-3.5 w-3.5 shrink-0" aria-hidden />
            Password is hashed before storage
          </div>

          <div className="flex flex-col gap-3 pt-2">
            <FormSubmitButton className="w-full" disabled={mismatch}>
              Reset password
            </FormSubmitButton>
            <Link
              href={ROUTES.admin.accounts}
              className={`${btnSecondaryClass} flex min-h-[52px] w-full items-center justify-center`}
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
