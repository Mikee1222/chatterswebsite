"use client";

import Link from "next/link";
import { createAccount } from "@/app/actions/accounts";
import { ROUTES } from "@/lib/routes";
import type { UserRole } from "@/types";
import {
  Label,
  Input,
  Textarea,
  Select,
  Checkbox,
  FormActions,
  SubmitButton,
  btnSecondaryClass,
  formSpace,
  selectOptionClass,
} from "@/components/ui/form";

const ROLES: UserRole[] = ["admin", "manager", "chatter", "virtual_assistant"];

export function CreateAccountForm() {
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
        <Select id="role" name="role">
          {ROLES.map((r) => (
            <option key={r} value={r} className={selectOptionClass}>
              {r.replace("_", " ")}
            </option>
          ))}
        </Select>
      </div>
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
