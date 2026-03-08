"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { updateWhale } from "@/services/whales";
import type { Whale, RelationshipStatus, WhaleStatus } from "@/types";
import { RELATIONSHIP_STATUS_OPTIONS, WHALE_STATUS_OPTIONS } from "@/lib/airtable-options";
import { ROUTES } from "@/lib/routes";
import {
  Label,
  Textarea,
  Select,
  FormActions,
  SubmitButton,
  btnSecondaryClass,
  formSpace,
  selectOptionClass,
} from "@/components/ui/form";

export function EditWhaleForm({ whale }: { whale: Whale }) {
  const router = useRouter();
  const [relationshipStatus, setRelationshipStatus] = React.useState(whale.relationship_status);
  const [status, setStatus] = React.useState(whale.status);
  const [notes, setNotes] = React.useState(whale.notes);
  const [pending, setPending] = React.useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    try {
      await updateWhale(whale.id, {
        relationship_status: relationshipStatus,
        status,
        notes,
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
        <Label className="text-white/50">Username</Label>
        <p className="mt-1 text-[15px] text-white/90">{whale.username}</p>
      </div>
      <div>
        <Label className="text-white/50">Model</Label>
        <p className="mt-1 text-[15px] text-white/90">{whale.assigned_model_name || "—"}</p>
      </div>
      <div>
        <Label>Relationship status</Label>
        <Select
          value={relationshipStatus}
          onChange={(e) => setRelationshipStatus(e.target.value as RelationshipStatus)}
        >
          {RELATIONSHIP_STATUS_OPTIONS.map((r) => (
            <option key={r} value={r} className={selectOptionClass}>
              {r}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label>Status</Label>
        <Select value={status} onChange={(e) => setStatus(e.target.value as WhaleStatus)}>
          {WHALE_STATUS_OPTIONS.map((s) => (
            <option key={s} value={s} className={selectOptionClass}>
              {s}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label>Notes</Label>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} />
      </div>
      <FormActions>
        <SubmitButton disabled={pending}>{pending ? "Saving…" : "Save changes"}</SubmitButton>
        <Link href={ROUTES.chatter.myWhales} className={btnSecondaryClass}>Cancel</Link>
      </FormActions>
    </form>
  );
}
