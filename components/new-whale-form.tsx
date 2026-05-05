"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { createWhaleWithModelAction } from "@/app/actions/whales";
import type { AppNotification, RelationshipStatus } from "@/types";
import { RELATIONSHIP_STATUS_OPTIONS } from "@/lib/airtable-options";
import { ROUTES } from "@/lib/routes";
import { useToast } from "@/contexts/toast-context";
import {
  Label,
  Input,
  Textarea,
  FormActions,
  SubmitButton,
  btnSecondaryClass,
  formSpace,
} from "@/components/ui/form";
import { CustomSelect } from "@/components/ui/custom-select";

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
    console.log("[NewWhaleForm] submit fired", { username: username.trim(), modelId });
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
    <form onSubmit={submit} className={formSpace} noValidate>
      <div>
        <Label>Whale username</Label>
        <Input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          placeholder="@username"
        />
      </div>
      <div>
        <Label>Model</Label>
        <CustomSelect
          value={modelId}
          onChange={handleModelChange}
          required
          placeholder="Select model"
          options={[
            { value: "", label: "Select model" },
            ...modelOptions.map((m) => ({ value: m.id, label: m.name })),
          ]}
        />
      </div>
      <div>
        <Label>Relationship status</Label>
        <CustomSelect
          value={relationshipStatus}
          onChange={(v) => setRelationshipStatus(v as RelationshipStatus)}
          options={RELATIONSHIP_STATUS_OPTIONS.map((r) => ({ value: r, label: r }))}
        />
      </div>
      <div>
        <Label>Notes</Label>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Optional"
        />
      </div>
      {formError ? <p className="text-sm text-rose-300">{formError}</p> : null}
      <FormActions>
        <SubmitButton disabled={pending}>
          {pending ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
              Creating…
            </span>
          ) : (
            "Create whale"
          )}
        </SubmitButton>
        <Link href={ROUTES.chatter.myWhales} className={btnSecondaryClass}>Cancel</Link>
      </FormActions>
    </form>
  );
}
