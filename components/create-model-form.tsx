"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createModel } from "@/services/modelss";
import { ROUTES } from "@/lib/routes";
import {
  Label,
  Input,
  Textarea,
  Select,
  FormActions,
  SubmitButton,
  btnSecondaryClass,
  formSpace,
  selectOptionClass,
} from "@/components/ui/form";

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
    <form onSubmit={submit} className={formSpace}>
      <div>
        <Label htmlFor="model_name">Model name</Label>
        <Input id="model_name" name="model_name" type="text" required placeholder="Display name" />
      </div>
      <div>
        <Label htmlFor="platform">Platform</Label>
        <Select id="platform" name="platform">
          {PLATFORMS.map((p) => (
            <option key={p} value={p} className={selectOptionClass}>
              {p}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label htmlFor="status">Status</Label>
        <Select id="status" name="status">
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s} className={selectOptionClass}>
              {s}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" name="notes" rows={3} placeholder="Optional" />
      </div>
      <FormActions>
        <SubmitButton disabled={pending}>{pending ? "Creating…" : "Create model"}</SubmitButton>
        <Link href={ROUTES.accountsModelss} className={btnSecondaryClass}>Cancel</Link>
      </FormActions>
    </form>
  );
}
