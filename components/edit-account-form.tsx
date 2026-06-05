"use client";

import * as React from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import {
  Activity,
  KeyRound,
  Languages,
  Link2,
  Mail,
  Send,
  StickyNote,
  User,
  UserCog,
} from "lucide-react";
import { updateAccount } from "@/app/actions/accounts";
import { ROUTES } from "@/lib/routes";
import type { UserRecord, UserRole } from "@/types";
import { Checkbox, btnSecondaryClass, formSpace, selectOptionClass } from "@/components/ui/form";
import { FormField } from "@/components/ui/form-field";
import { FormInput } from "@/components/ui/form-input";
import { FormSelect } from "@/components/ui/form-select";
import { FormTextarea } from "@/components/ui/form-textarea";
import { FormSubmitButton } from "@/components/ui/form-submit-button";

const ROLES: UserRole[] = ["admin", "manager", "chatter", "virtual_assistant", "model"];
const STATUSES = ["active", "inactive", "suspended"];

function EditAccountSubmit() {
  const { pending } = useFormStatus();
  return (
    <FormSubmitButton className="w-full" loading={pending} disabled={pending}>
      {pending ? "Saving…" : "Save changes"}
    </FormSubmitButton>
  );
}

type Props = { user: UserRecord; modelOptions?: { id: string; model_name: string; alreadyLinked?: boolean }[] };

export function EditAccountForm({ user, modelOptions = [] }: Props) {
  const [role, setRole] = React.useState<UserRole>(user.role);
  const [secondaryRole, setSecondaryRole] = React.useState(
    user.secondary_role === "chatter" || user.secondary_role === "virtual_assistant"
      ? user.secondary_role
      : ""
  );
  const [linkedModelId, setLinkedModelId] = React.useState(user.linked_model_id ?? "");
  const [languagePreference, setLanguagePreference] = React.useState(user.language_preference ?? "en");
  const [accountStatus, setAccountStatus] = React.useState(user.status || "active");

  return (
    <form action={updateAccount} className={`${formSpace} space-y-4`}>
      <input type="hidden" name="recordId" value={user.id} />
      <FormField label="Full name" icon={<User />} htmlFor="full_name" required>
        <FormInput id="full_name" name="full_name" type="text" required defaultValue={user.full_name} />
      </FormField>
      <FormField label="Email" icon={<Mail />} htmlFor="email" required>
        <FormInput id="email" name="email" type="email" required defaultValue={user.email} />
      </FormField>
      <FormField label="Role" icon={<UserCog />} htmlFor="role" required>
        <FormSelect
          id="role"
          name="role"
          value={role}
          onChange={(e) => {
            const r = e.target.value as UserRole;
            setRole(r);
            if (r !== "chatter" && r !== "virtual_assistant") setSecondaryRole("");
          }}
          required
        >
          {ROLES.map((r) => (
            <option key={r} value={r} className={selectOptionClass}>
              {r.replace("_", " ")}
            </option>
          ))}
        </FormSelect>
      </FormField>
      {(role === "chatter" || role === "virtual_assistant") && (
        <FormField
          label="Secondary role"
          icon={<UserCog />}
          htmlFor="secondary_role"
          description="Optional second hat (chatter ↔ VA). User switches in Settings."
        >
          <FormSelect
            id="secondary_role"
            name="secondary_role"
            value={secondaryRole}
            onChange={(e) => setSecondaryRole(e.target.value)}
          >
            <option value="" className={selectOptionClass}>
              No secondary role
            </option>
            <option value="virtual_assistant" className={selectOptionClass}>
              Virtual Assistant
            </option>
            <option value="chatter" className={selectOptionClass}>
              Chatter
            </option>
          </FormSelect>
        </FormField>
      )}
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
            defaultValue={user.telegram_username ?? ""}
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
                  disabled={Boolean(m.alreadyLinked && m.id !== linkedModelId)}
                  className={selectOptionClass}
                >
                  {m.model_name}
                  {m.alreadyLinked && m.id !== linkedModelId ? " (already linked)" : ""}
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
      <FormField label="Status" icon={<Activity />} htmlFor="status" required>
        <FormSelect
          id="status"
          name="status"
          value={accountStatus}
          onChange={(e) => setAccountStatus(e.target.value)}
          required
        >
          {STATUSES.map((s) => (
            <option key={s} value={s} className={selectOptionClass}>
              {s}
            </option>
          ))}
        </FormSelect>
      </FormField>
      <FormField
        label="Can log in"
        icon={<KeyRound />}
        htmlFor="can_login"
        description="Allow this user to sign in to the dashboard."
      >
        <div className="flex justify-end pt-0.5">
          <Checkbox id="can_login" name="can_login" defaultChecked={user.can_login} />
        </div>
      </FormField>
      <FormField label="Notes" icon={<StickyNote />} htmlFor="notes" description="Optional internal note.">
        <FormTextarea id="notes" name="notes" rows={3} defaultValue={user.notes} placeholder="Optional" />
      </FormField>
      <div className="flex flex-col gap-3 pt-2">
        <EditAccountSubmit />
        <Link href={ROUTES.accounts} className={`${btnSecondaryClass} flex min-h-[52px] w-full items-center justify-center`}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
