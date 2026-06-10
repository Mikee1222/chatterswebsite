"use client";

import * as React from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import {
  Headphones,
  KeyRound,
  Languages,
  Link2,
  Lock,
  Mail,
  Send,
  StickyNote,
  User,
  Users,
  UserCog,
} from "lucide-react";
import { createAccount } from "@/app/actions/accounts";
import { ROUTES } from "@/lib/routes";
import type { RoleRecord, VaType } from "@/types";
import { Checkbox, btnSecondaryClass, formSpace, selectOptionClass } from "@/components/ui/form";
import { FormField } from "@/components/ui/form-field";
import { FormInput } from "@/components/ui/form-input";
import { FormSelect } from "@/components/ui/form-select";
import { FormTextarea } from "@/components/ui/form-textarea";
import { FormSubmitButton } from "@/components/ui/form-submit-button";

const VA_TYPES: VaType[] = ["chatting", "marketing", "both"];

function CreateAccountSubmit() {
  const { pending } = useFormStatus();
  return (
    <FormSubmitButton className="w-full" loading={pending} disabled={pending}>
      {pending ? "Creating…" : "Create user"}
    </FormSubmitButton>
  );
}

type Props = {
  roles: RoleRecord[];
  modelOptions?: { id: string; model_name: string; alreadyLinked?: boolean }[];
  /** Pre-select role (e.g. from `/accounts/new?role=chatter`). */
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

  return (
    <form action={createAccount} className={`${formSpace} space-y-4`}>
      <FormField label="Full name" icon={<User />} htmlFor="full_name" required staggerIndex={0}>
        <FormInput id="full_name" name="full_name" type="text" required placeholder="Jane Doe" />
      </FormField>
      <FormField label="Email" icon={<Mail />} htmlFor="email" required staggerIndex={1}>
        <FormInput id="email" name="email" type="email" required placeholder="jane@example.com" />
      </FormField>
      <FormField
        label="Role"
        icon={role === "virtual_assistant" ? <Headphones /> : role === "chatter" ? <Users /> : <UserCog />}
        htmlFor="role"
        required
        staggerIndex={2}
      >
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
        >
          {roles.map((r) => (
            <option key={r.id} value={r.role_id} className={selectOptionClass}>
              {r.label || r.role_id.replace(/_/g, " ")}
            </option>
          ))}
        </FormSelect>
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
      {(role === "chatter" || role === "virtual_assistant") && (
        <FormField
          label="Telegram username"
          icon={<Send />}
          htmlFor="telegram_username"
          description="Without @ — used for Message links on live shifts."
          staggerIndex={role === "virtual_assistant" ? 4 : 3}
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
            staggerIndex={3}
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
                  {m.alreadyLinked ? "(already linked)" : ""}
                </option>
              ))}
            </FormSelect>
          </FormField>
          <FormField label="Language" icon={<Languages />} htmlFor="language_preference" staggerIndex={4}>
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
      <FormField label="Password (min 8 characters)" icon={<Lock />} htmlFor="password" staggerIndex={5}>
        <FormInput
          id="password"
          name="password"
          type="password"
          minLength={8}
          placeholder="••••••••"
        />
      </FormField>
      <FormField
        label="Can log in"
        icon={<KeyRound />}
        htmlFor="can_login"
        description="Uncheck to create the account without dashboard access."
        staggerIndex={6}
      >
        <div className="flex justify-end pt-0.5">
          <Checkbox id="can_login" name="can_login" defaultChecked />
        </div>
      </FormField>
      <FormField label="Notes" icon={<StickyNote />} htmlFor="notes" description="Optional internal note." staggerIndex={7}>
        <FormTextarea id="notes" name="notes" rows={3} placeholder="Optional" />
      </FormField>
      <div className="flex flex-col gap-3 pt-2">
        <CreateAccountSubmit />
        <Link href={ROUTES.accounts} className={`${btnSecondaryClass} flex min-h-[52px] w-full items-center justify-center`}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
