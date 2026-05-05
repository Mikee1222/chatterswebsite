"use client";

import * as React from "react";
import Link from "next/link";
import { updateAccount } from "@/app/actions/accounts";
import { ROUTES } from "@/lib/routes";
import type { UserRecord, UserRole } from "@/types";
import {
  Label,
  Input,
  Textarea,
  Checkbox,
  FormActions,
  SubmitButton,
  btnSecondaryClass,
  formSpace,
} from "@/components/ui/form";
import { CustomSelect } from "@/components/ui/custom-select";

const ROLES: UserRole[] = ["admin", "manager", "chatter", "virtual_assistant", "model"];
const STATUSES = ["active", "inactive", "suspended"];

type Props = { user: UserRecord; modelOptions?: { id: string; model_name: string }[] };

export function EditAccountForm({ user, modelOptions = [] }: Props) {
  const [role, setRole] = React.useState<UserRole>(user.role);
  const [linkedModelId, setLinkedModelId] = React.useState(user.linked_model_id ?? "");
  const [languagePreference, setLanguagePreference] = React.useState(user.language_preference ?? "en");
  const [accountStatus, setAccountStatus] = React.useState(user.status || "active");

  return (
    <form action={updateAccount} className={formSpace}>
      <input type="hidden" name="recordId" value={user.id} />
      <div>
        <Label htmlFor="full_name">Full name</Label>
        <Input id="full_name" name="full_name" type="text" required defaultValue={user.full_name} />
      </div>
      <div>
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" required defaultValue={user.email} />
      </div>
      <div>
        <Label htmlFor="role">Role</Label>
        <CustomSelect
          id="role"
          name="role"
          value={role}
          onChange={(v) => setRole(v as UserRole)}
          options={ROLES.map((r) => ({ value: r, label: r.replace("_", " ") }))}
        />
      </div>
      {role === "model" && (
        <>
          <div>
            <Label htmlFor="linked_model_id">Linked model</Label>
            <CustomSelect
              id="linked_model_id"
              name="linked_model_id"
              value={linkedModelId}
              onChange={setLinkedModelId}
              options={[
                { value: "", label: "Select model" },
                ...modelOptions.map((m) => ({ value: m.id, label: m.model_name })),
              ]}
            />
          </div>
          <div>
            <Label htmlFor="language_preference">Language</Label>
            <CustomSelect
              id="language_preference"
              name="language_preference"
              value={languagePreference}
              onChange={setLanguagePreference}
              options={[
                { value: "en", label: "English" },
                { value: "es", label: "Spanish" },
              ]}
            />
          </div>
        </>
      )}
      <div>
        <Label htmlFor="status">Status</Label>
        <CustomSelect
          id="status"
          name="status"
          value={accountStatus}
          onChange={setAccountStatus}
          options={STATUSES.map((s) => ({ value: s, label: s }))}
        />
      </div>
      <div>
        <Checkbox id="can_login" name="can_login" defaultChecked={user.can_login} label="Can log in" />
      </div>
      <div>
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" name="notes" rows={2} defaultValue={user.notes} placeholder="Optional" />
      </div>
      <FormActions>
        <SubmitButton>Save changes</SubmitButton>
        <Link href={ROUTES.accounts} className={btnSecondaryClass}>Cancel</Link>
      </FormActions>
    </form>
  );
}
