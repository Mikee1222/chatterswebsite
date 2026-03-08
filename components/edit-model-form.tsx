"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { updateModel } from "@/services/modelss";
import type { ModelRecord } from "@/types";
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
const PRIORITY_OPTIONS = ["low", "medium", "high"] as const;

export function EditModelForm({ model }: { model: ModelRecord }) {
  const router = useRouter();
  const [modelName, setModelName] = React.useState(model.model_name);
  const [platform, setPlatform] = React.useState(model.platform);
  const [status, setStatus] = React.useState(model.status);
  const [priority, setPriority] = React.useState(model.priority || "medium");
  const [notes, setNotes] = React.useState(model.notes || "");
  const [pending, setPending] = React.useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    try {
      await updateModel(model.id, {
        model_name: modelName.trim(),
        platform,
        status,
        priority,
        notes: notes.trim(),
      });
      router.push(`${ROUTES.accounts}?section=modelss&success=model_updated`);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className={formSpace}>
      <div>
        <Label htmlFor="model_name">Model name</Label>
        <Input
          id="model_name"
          value={modelName}
          onChange={(e) => setModelName(e.target.value)}
          required
        />
      </div>
      <div>
        <Label htmlFor="platform">Platform</Label>
        <Select
          id="platform"
          value={platform}
          onChange={(e) => setPlatform(e.target.value as ModelRecord["platform"])}
        >
          {PLATFORMS.map((p) => (
            <option key={p} value={p} className={selectOptionClass}>{p}</option>
          ))}
        </Select>
      </div>
      <div>
        <Label htmlFor="status">Status</Label>
        <Select id="status" value={status} onChange={(e) => setStatus(e.target.value)}>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s} className={selectOptionClass}>{s}</option>
          ))}
        </Select>
      </div>
      <div>
        <Label htmlFor="priority">Priority</Label>
        <Select id="priority" value={priority} onChange={(e) => setPriority(e.target.value)}>
          {PRIORITY_OPTIONS.map((p) => (
            <option key={p} value={p} className={selectOptionClass}>{p}</option>
          ))}
        </Select>
      </div>
      <div>
        <Label>Current status</Label>
        <p className="text-sm text-white/90">{model.current_status}</p>
      </div>
      {model.current_status === "occupied" && model.current_chatter_name && (
        <div>
          <Label>Current chatter</Label>
          <p className="text-sm text-white/90">{model.current_chatter_name}</p>
        </div>
      )}
      <div>
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Optional"
        />
      </div>
      <FormActions>
        <SubmitButton disabled={pending}>{pending ? "Saving…" : "Save changes"}</SubmitButton>
        <Link href={ROUTES.accountsModelss} className={btnSecondaryClass}>Cancel</Link>
      </FormActions>
    </form>
  );
}
