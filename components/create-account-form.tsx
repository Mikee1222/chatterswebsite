"use client";

import * as React from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import {
  Eye,
  EyeOff,
  Headphones,
  KeyRound,
  Languages,
  Link2,
  Lock,
  Mail,
  Send,
  Shield,
  StickyNote,
  User,
  Users,
  UserCog,
} from "lucide-react";
import { createAccount } from "@/app/actions/accounts";
import { ROUTES } from "@/lib/routes";
import type { RoleRecord, SopColor, VaType } from "@/types";
import { Checkbox, btnSecondaryClass, formSpace, selectOptionClass } from "@/components/ui/form";
import { FormField } from "@/components/ui/form-field";
import { FormInput } from "@/components/ui/form-input";
import { FormSelect } from "@/components/ui/form-select";
import { FormTextarea } from "@/components/ui/form-textarea";
import { FormSubmitButton } from "@/components/ui/form-submit-button";
import { SopFormSection } from "@/components/sop/sop-form-section";
import { SOP_COLOR_STYLES } from "@/components/sop/sop-colors";
import { AccountCompensationSection } from "@/components/account-compensation-section";
import { cn } from "@/lib/utils";

const VA_TYPES: VaType[] = ["chatting", "marketing", "both"];

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

function RoleColorDot({ color }: { color: string }) {
  const key = (color in SOP_COLOR_STYLES ? color : "gray") as SopColor;
  return <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", SOP_COLOR_STYLES[key].dot)} />;
}

function CreateAccountSubmit() {
  const { pending } = useFormStatus();
  return (
    <FormSubmitButton className="w-full sm:w-auto sm:min-w-[180px]" loading={pending} disabled={pending}>
      {pending ? "Creating…" : "Create user"}
    </FormSubmitButton>
  );
}

type Props = {
  roles: RoleRecord[];
  modelOptions?: { id: string; model_name: string; alreadyLinked?: boolean }[];
  defaultRole?: string;
};

export function CreateAccountForm({ roles, modelOptions = [], defaultRole }: Props) {
  const roleIds = React.useMemo(() => new Set(roles.map((r) => r.role_id)), [roles]);
  const initialRole =
    defaultRole && roleIds.has(defaultRole)
      ? defaultRole
      : roles.find((r) => r.role_id === "chatter")?.role_id ?? roles[0]?.role_id ?? "chatter";
  const [role, setRole] = React.useState(initialRole);
  const [vaType, setVaType] = React.useState<VaType | "">("");
  const [linkedModelId, setLinkedModelId] = React.useState("");
  const [languagePreference, setLanguagePreference] = React.useState("en");
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const strength = passwordStrength(password);
  const selectedRole = roles.find((r) => r.role_id === role);

  return (
    <form action={createAccount} encType="multipart/form-data" className={`${formSpace} mx-auto max-w-2xl space-y-5`}>
      <SopFormSection title="Basic info" description="Name and email for the new account">
        <FormField label="Full name" icon={<User />} htmlFor="full_name" required staggerIndex={0}>
          <FormInput id="full_name" name="full_name" type="text" required placeholder="Jane Doe" />
        </FormField>
        <FormField label="Email" icon={<Mail />} htmlFor="email" required staggerIndex={1}>
          <FormInput id="email" name="email" type="email" required placeholder="jane@example.com" />
        </FormField>
      </SopFormSection>

      <SopFormSection title="Role & access" description="Primary role and login permissions">
        <FormField
          label="Role"
          icon={role === "virtual_assistant" ? <Headphones /> : role === "chatter" ? <Users /> : <UserCog />}
          htmlFor="role"
          required
          staggerIndex={2}
        >
          <div className="relative">
            {selectedRole ? (
              <span className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2">
                <RoleColorDot color={selectedRole.color || "gray"} />
              </span>
            ) : null}
            <FormSelect
              id="role"
              name="role"
              value={role}
              onChange={(e) => {
                const r = e.target.value;
                setRole(r);
                if (r !== "virtual_assistant") setVaType("");
              }}
              required
              className={selectedRole ? "pl-8" : undefined}
            >
              {roles.map((r) => (
                <option key={r.id} value={r.role_id} className={selectOptionClass}>
                  {r.label || r.role_id.replace(/_/g, " ")}
                </option>
              ))}
            </FormSelect>
          </div>
        </FormField>
        {role === "virtual_assistant" && (
          <FormField
            label="VA type"
            icon={<UserCog />}
            htmlFor="va_type"
            description="Specialization for virtual assistant accounts."
            staggerIndex={3}
          >
            <FormSelect
              id="va_type"
              name="va_type"
              value={vaType}
              onChange={(e) => setVaType(e.target.value as VaType | "")}
            >
              <option value="" className={selectOptionClass}>
                — Select VA type —
              </option>
              {VA_TYPES.map((t) => (
                <option key={t} value={t} className={selectOptionClass}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </option>
              ))}
            </FormSelect>
          </FormField>
        )}
        <FormField
          label="Can log in"
          icon={<KeyRound />}
          htmlFor="can_login"
          description="Uncheck to create the account without dashboard access."
          staggerIndex={4}
        >
          <div className="flex justify-end pt-0.5">
            <Checkbox id="can_login" name="can_login" defaultChecked />
          </div>
        </FormField>
      </SopFormSection>

      <AccountCompensationSection />

      <SopFormSection title="Profile" description="Optional profile fields for this role" defaultOpen={role === "model" || role === "chatter" || role === "virtual_assistant"}>
        {(role === "chatter" || role === "virtual_assistant") && (
          <FormField
            label="Telegram username"
            icon={<Send />}
            htmlFor="telegram_username"
            description="Without @ — used for Message links on live shifts."
          >
            <FormInput
              id="telegram_username"
              name="telegram_username"
              type="text"
              placeholder="username"
              autoComplete="off"
            />
          </FormField>
        )}
        {role === "model" && (
          <>
            <FormField
              label="Link to model profile"
              icon={<Link2 />}
              htmlFor="linked_model_id"
              description="Links this login account to a model profile so they can access their dashboard."
            >
              <FormSelect
                id="linked_model_id"
                name="linked_model_id"
                value={linkedModelId}
                onChange={(e) => setLinkedModelId(e.target.value)}
              >
                <option value="" className={selectOptionClass}>
                  — No model profile linked —
                </option>
                {modelOptions.map((m) => (
                  <option
                    key={m.id}
                    value={m.id}
                    disabled={Boolean(m.alreadyLinked)}
                    className={selectOptionClass}
                  >
                    {m.model_name}
                    {m.alreadyLinked ? " (already linked)" : ""}
                  </option>
                ))}
              </FormSelect>
            </FormField>
            <FormField label="Language" icon={<Languages />} htmlFor="language_preference">
              <FormSelect
                id="language_preference"
                name="language_preference"
                value={languagePreference}
                onChange={(e) => setLanguagePreference(e.target.value)}
              >
                <option value="en" className={selectOptionClass}>
                  English
                </option>
                <option value="es" className={selectOptionClass}>
                  Spanish
                </option>
              </FormSelect>
            </FormField>
          </>
        )}
        {role !== "model" && role !== "chatter" && role !== "virtual_assistant" && (
          <p className="text-sm text-white/45">No additional profile fields for this role.</p>
        )}
      </SopFormSection>

      <SopFormSection title="Security" description="Set an initial password (optional)">
        <FormField label="Password" icon={<Lock />} htmlFor="password" description="Minimum 8 characters.">
          <div className="space-y-2">
            <div className="relative">
              <FormInput
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                minLength={8}
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
      </SopFormSection>

      <SopFormSection title="Notes" description="Internal notes visible to admins only" defaultOpen={false}>
        <FormField label="Notes" icon={<StickyNote />} htmlFor="notes">
          <FormTextarea id="notes" name="notes" rows={3} placeholder="Optional internal note" />
        </FormField>
      </SopFormSection>

      <div className="flex flex-col-reverse gap-3 border-t border-white/10 pt-5 sm:flex-row sm:items-center sm:justify-between">
        <Link
          href={ROUTES.admin.accounts}
          className={`${btnSecondaryClass} flex min-h-[52px] w-full items-center justify-center sm:w-auto sm:px-8`}
        >
          Cancel
        </Link>
        <div className="flex items-center gap-2 text-xs text-white/40">
          <Shield className="h-3.5 w-3.5" aria-hidden />
          Passwords are hashed — never stored in plain text
        </div>
        <CreateAccountSubmit />
      </div>
    </form>
  );
}
