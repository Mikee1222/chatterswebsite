"use client";
import { devLog } from "@/lib/dev-log";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Heart, Sparkles, StickyNote, User } from "lucide-react";
import { createWhaleWithModelAction } from "@/app/actions/whales";
import type { AppNotification, RelationshipStatus } from "@/types";
import { RELATIONSHIP_STATUS_OPTIONS } from "@/lib/airtable-options";
import { ROUTES } from "@/lib/routes";
import { useToast } from "@/contexts/toast-context";
import { btnSecondaryClass, formSpace, selectOptionClass } from "@/components/ui/form";
import { FormField } from "@/components/ui/form-field";
import { FormInput } from "@/components/ui/form-input";
import { FormSelect } from "@/components/ui/form-select";
import { FormTextarea } from "@/components/ui/form-textarea";
import { FormSubmitButton } from "@/components/ui/form-submit-button";

function localToast(id: string, title: string, body: string, priority: "normal" | "high"): AppNotification {
  return {
    id,
    notification_id: id,
    user_id: "local",
    category: "system",
    event_type: "system_alert",
    priority,
    title,
    body,
    entity_type: "system",
    entity_id: "",
    read_at: null,
    created_at: new Date().toISOString(),
  };
}

type Props = {
  chatterId: string;
  chatterName: string;
  modelOptions: { id: string; name: string }[];
};

export function NewWhaleForm({ modelOptions, chatterId: _cid, chatterName: _cname }: Props) {
  const router = useRouter();
  const { addToast } = useToast();
  const [username, setUsername] = React.useState("");
  const [modelId, setModelId] = React.useState("");
  const [modelName, setModelName] = React.useState("");
  const [relationshipStatus, setRelationshipStatus] = React.useState<RelationshipStatus>("New");
  const [notes, setNotes] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  const handleModelChange = (id: string) => {
    const opt = modelOptions.find((o) => o.id === id);
    setModelId(id);
    setModelName(opt?.name ?? "");
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    devLog("[NewWhaleForm] submit fired", { username: username.trim(), modelId });
    setFormError(null);
    if (!modelId) {
      setFormError("Select a model.");
      addToast(localToast(`nw-err-${Date.now()}`, "Could not create whale", "Select a model.", "high"));
      return;
    }
    setPending(true);
    try {
      const res = await createWhaleWithModelAction({
        username: username.trim(),
        modelRecordId: modelId,
        modelName: modelName,
        relationship_status: relationshipStatus,
        notes: notes.trim(),
      });
      if (!res.success) {
        const msg = res.error || "Something went wrong.";
        console.error("[NewWhaleForm] action error", msg);
        setFormError(msg);
        addToast(localToast(`nw-err-${Date.now()}`, "Could not create whale", msg, "high"));
        return;
      }
      addToast(
        localToast(`nw-ok-${Date.now()}`, "Whale created", `${username.trim() || "Whale"} was created.`, "normal")
      );
      router.push(ROUTES.chatter.myWhales);
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[NewWhaleForm] submit threw", err);
      setFormError(msg);
      addToast(localToast(`nw-err-${Date.now()}`, "Could not create whale", msg, "high"));
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className={`${formSpace} space-y-4`} noValidate>
      <FormField label="Whale username" icon={<User />} htmlFor="new-whale-username" required>
        <FormInput
          id="new-whale-username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          placeholder="@username"
        />
      </FormField>
      <FormField label="Model" icon={<Sparkles />} htmlFor="new-whale-model" required>
        <FormSelect
          id="new-whale-model"
          value={modelId}
          onChange={(e) => handleModelChange(e.target.value)}
          required
        >
          <option value="" disabled className={selectOptionClass}>
            Select model
          </option>
          {modelOptions.map((m) => (
            <option key={m.id} value={m.id} className={selectOptionClass}>
              {m.name}
            </option>
          ))}
        </FormSelect>
      </FormField>
      <FormField label="Relationship status" icon={<Heart />} htmlFor="new-whale-relationship">
        <FormSelect
          id="new-whale-relationship"
          value={relationshipStatus}
          onChange={(e) => setRelationshipStatus(e.target.value as RelationshipStatus)}
        >
          {RELATIONSHIP_STATUS_OPTIONS.map((r) => (
            <option key={r} value={r} className={selectOptionClass}>
              {r}
            </option>
          ))}
        </FormSelect>
      </FormField>
      <FormField label="Notes" icon={<StickyNote />} htmlFor="new-whale-notes" description="Optional context for your team.">
        <FormTextarea
          id="new-whale-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Optional"
        />
      </FormField>
      {formError ? <p className="text-sm text-rose-300">{formError}</p> : null}
      <div className="flex flex-col gap-3 pt-1">
        <FormSubmitButton disabled={pending} loading={pending} className="w-full">
          {pending ? "Creating…" : "Create whale"}
        </FormSubmitButton>
        <Link href={ROUTES.chatter.myWhales} className={`${btnSecondaryClass} flex min-h-[52px] w-full items-center justify-center`}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
