"use client";

import Link from "next/link";
import { updateAccount } from "@/app/actions/accounts";
import { ROUTES } from "@/lib/routes";
import type { UserRecord, UserRole } from "@/types";
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
const STATUSES = ["active", "inactive", "suspended"];

export function EditAccountForm({ user }: { user: UserRecord }) {
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
        <Select id="role" name="role" defaultValue={user.role}>
          {ROLES.map((r) => (
            <option key={r} value={r} className={selectOptionClass}>{r.replace("_", " ")}</option>
          ))}
        </Select>
      </div>
      <div>
        <Label htmlFor="status">Status</Label>
        <Select id="status" name="status" defaultValue={user.status || "active"}>
          {STATUSES.map((s) => (
            <option key={s} value={s} className={selectOptionClass}>{s}</option>
          ))}
        </Select>
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
