"use client";

import Link from "next/link";
import { Lock } from "lucide-react";
import { setAccountPassword } from "@/app/actions/accounts";
import { ROUTES } from "@/lib/routes";
import { btnSecondaryClass, formSpace } from "@/components/ui/form";
import { FormField } from "@/components/ui/form-field";
import { FormInput } from "@/components/ui/form-input";
import { FormSubmitButton } from "@/components/ui/form-submit-button";

export function ResetPasswordForm({ recordId }: { recordId: string }) {
  return (
    <form action={setAccountPassword} className={formSpace}>
      <input type="hidden" name="recordId" value={recordId} />
      <FormField
        label="New password (min 8 characters)"
        icon={<Lock />}
        htmlFor="password"
        required
      >
        <FormInput
          id="password"
          name="password"
          type="password"
          minLength={8}
          required
          placeholder="••••••••"
        />
      </FormField>
      <div className="flex flex-col gap-3 pt-2">
        <FormSubmitButton className="w-full">Reset password</FormSubmitButton>
        <Link href={ROUTES.accounts} className={`${btnSecondaryClass} flex w-full min-h-[52px] items-center justify-center`}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
