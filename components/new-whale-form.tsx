"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createWhale } from "@/services/whales";
import type { RelationshipStatus } from "@/types";
import { RELATIONSHIP_STATUS_OPTIONS } from "@/lib/airtable-options";
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

type Props = {
  chatterId: string;
  chatterName: string;
  modelOptions: { id: string; name: string }[];
};

export function NewWhaleForm({ chatterId, chatterName, modelOptions }: Props) {
  const router = useRouter();
  const [username, setUsername] = React.useState("");
  const [modelId, setModelId] = React.useState("");
  const [modelName, setModelName] = React.useState("");
  const [relationshipStatus, setRelationshipStatus] = React.useState<RelationshipStatus>("New");
  const [notes, setNotes] = React.useState("");
  const [pending, setPending] = React.useState(false);

  const handleModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const opt = modelOptions.find((o) => o.id === e.target.value);
    setModelId(e.target.value);
    setModelName(opt?.name ?? "");
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!modelId) return;
    setPending(true);
    try {
      const whaleId = `whale_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      await createWhale({
        whale_id: whaleId,
        username: username.trim(),
        assigned_chatter: [chatterId],
        assigned_chatter_name: chatterName,
        assigned_model: [modelId],
        assigned_model_name: modelName,
        relationship_status: relationshipStatus,
        notes: notes.trim(),
        status: "Active",
      });
      router.push(ROUTES.chatter.myWhales);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className={formSpace}>
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
        <Select value={modelId} onChange={handleModelChange} required>
          <option value="" className={selectOptionClass}>Select model</option>
          {modelOptions.map((m) => (
            <option key={m.id} value={m.id} className={selectOptionClass}>
              {m.name}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label>Relationship status</Label>
        <Select value={relationshipStatus} onChange={(e) => setRelationshipStatus(e.target.value as RelationshipStatus)}>
          {RELATIONSHIP_STATUS_OPTIONS.map((r) => (
            <option key={r} value={r} className={selectOptionClass}>
              {r}
            </option>
          ))}
        </Select>
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
      <FormActions>
        <SubmitButton disabled={pending}>{pending ? "Creating…" : "Create whale"}</SubmitButton>
        <Link href={ROUTES.chatter.myWhales} className={btnSecondaryClass}>Cancel</Link>
      </FormActions>
    </form>
  );
}
