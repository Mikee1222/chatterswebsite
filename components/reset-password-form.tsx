"use client";

import Link from "next/link";
import { setAccountPassword } from "@/app/actions/accounts";
import { ROUTES } from "@/lib/routes";
import { Label, Input, FormActions, SubmitButton, btnSecondaryClass, formSpace } from "@/components/ui/form";

export function ResetPasswordForm({ recordId }: { recordId: string }) {
  return (
    <form action={setAccountPassword} className={formSpace}>
      <input type="hidden" name="recordId" value={recordId} />
      <div>
        <Label htmlFor="password">New password (min 8 characters)</Label>
        <Input id="password" name="password" type="password" minLength={8} required placeholder="••••••••" />
      </div>
      <FormActions>
        <SubmitButton>Reset password</SubmitButton>
        <Link href={ROUTES.accounts} className={btnSecondaryClass}>Cancel</Link>
      </FormActions>
    </form>
  );
}
