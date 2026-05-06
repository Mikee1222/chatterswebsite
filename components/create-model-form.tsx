"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Activity, Globe, StickyNote, UserPlus } from "lucide-react";
import { createModel } from "@/services/modelss";
import { ROUTES } from "@/lib/routes";
import { btnSecondaryClass, formSpace, selectOptionClass } from "@/components/ui/form";
import { FormField } from "@/components/ui/form-field";
import { FormInput } from "@/components/ui/form-input";
import { FormSelect } from "@/components/ui/form-select";
import { FormTextarea } from "@/components/ui/form-textarea";
import { FormSubmitButton } from "@/components/ui/form-submit-button";

const PLATFORMS = ["onlyfans", "fanvue", "other"] as const;
const STATUS_OPTIONS = ["active", "inactive"] as const;

export function CreateModelForm() {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    const model_name = (formData.get("model_name") as string)?.trim();
    if (!model_name) return;
    setPending(true);
    try {
      await createModel({
        model_name,
        platform: (formData.get("platform") as string) || "other",
        status: (formData.get("status") as string) || "active",
        notes: (formData.get("notes") as string)?.trim() || "",
      });
      router.push(`${ROUTES.accounts}?section=modelss&success=model_created`);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className={`${formSpace} space-y-4`}>
      <FormField label="Model name" icon={<UserPlus />} htmlFor="model_name" required staggerIndex={0}>
        <FormInput id="model_name" name="model_name" type="text" required placeholder="Display name" />
      </FormField>
      <FormField label="Platform" icon={<Globe />} htmlFor="platform" staggerIndex={1}>
        <FormSelect id="platform" name="platform" defaultValue="onlyfans">
          {PLATFORMS.map((p) => (
            <option key={p} value={p} className={selectOptionClass}>
              {p}
            </option>
          ))}
        </FormSelect>
      </FormField>
      <FormField label="Status" icon={<Activity />} htmlFor="status" staggerIndex={2}>
        <FormSelect id="status" name="status" defaultValue="active">
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s} className={selectOptionClass}>
              {s}
            </option>
          ))}
        </FormSelect>
      </FormField>
      <FormField label="Notes" icon={<StickyNote />} htmlFor="notes" description="Optional." staggerIndex={3}>
        <FormTextarea id="notes" name="notes" rows={3} placeholder="Optional" />
      </FormField>
      <div className="flex flex-col gap-3 pt-2">
        <FormSubmitButton disabled={pending} loading={pending} className="w-full">
          {pending ? "Creating…" : "Create model"}
        </FormSubmitButton>
        <Link href={ROUTES.accountsModelss} className={`${btnSecondaryClass} flex min-h-[52px] w-full items-center justify-center`}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
