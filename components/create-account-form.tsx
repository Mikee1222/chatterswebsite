"use client";

import * as React from "react";
import Link from "next/link";
import { createAccount } from "@/app/actions/accounts";
import { ROUTES } from "@/lib/routes";
import type { UserRole } from "@/types";
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

type Props = {
  modelOptions?: { id: string; model_name: string }[];
};

export function CreateAccountForm({ modelOptions = [] }: Props) {
  const [role, setRole] = React.useState<UserRole>("chatter");
  const [linkedModelId, setLinkedModelId] = React.useState("");
  const [languagePreference, setLanguagePreference] = React.useState("en");

  return (
    <form action={createAccount} className={formSpace}>
      <div>
        <Label htmlFor="full_name">Full name</Label>
        <Input id="full_name" name="full_name" type="text" required placeholder="Jane Doe" />
      </div>
      <div>
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" required placeholder="jane@example.com" />
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
        <Label htmlFor="password">Password (min 8 characters)</Label>
        <Input
          id="password"
          name="password"
          type="password"
          minLength={8}
          placeholder="••••••••"
        />
      </div>
      <div>
        <Checkbox id="can_login" name="can_login" defaultChecked label="Can log in" />
      </div>
      <div>
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" name="notes" rows={2} placeholder="Optional" />
      </div>
      <FormActions>
        <SubmitButton>Create user</SubmitButton>
        <Link href={ROUTES.accounts} className={btnSecondaryClass}>Cancel</Link>
      </FormActions>
    </form>
  );
}
