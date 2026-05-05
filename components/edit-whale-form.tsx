"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { updateWhaleFields } from "@/app/actions/whales";
import type { AppNotification, Whale } from "@/types";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { useToast } from "@/contexts/toast-context";
import {
  Label,
  Textarea,
  SubmitButton,
  btnSecondaryClass,
  formSpace,
} from "@/components/ui/form";
import { CustomSelect } from "@/components/ui/custom-select";

const selectTapClass = "[&_button]:min-h-12 [&_button]:h-auto";

const EDIT_RELATIONSHIP_OPTIONS = [
  { value: "", label: "—" },
  { value: "New", label: "New" },
  { value: "Angry", label: "Angry" },
  { value: "In Love", label: "In Love" },
  { value: "Interested", label: "Interested" },
  { value: "Simp", label: "Simp" },
  { value: "Deleted Account", label: "Deleted Account" },
] as const;

const EDIT_STATUS_OPTIONS = [
  { value: "Active", label: "Active" },
  { value: "Inactive", label: "Inactive" },
  { value: "Dead", label: "Dead" },
] as const;

const REL_ALLOWED = new Set(EDIT_RELATIONSHIP_OPTIONS.map((o) => o.value));
const STATUS_ALLOWED = new Set(EDIT_STATUS_OPTIONS.map((o) => o.value));

type EditRelationshipValue = (typeof EDIT_RELATIONSHIP_OPTIONS)[number]["value"];
type EditStatusValue = (typeof EDIT_STATUS_OPTIONS)[number]["value"];

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

function normalizeRelationship(s: string): EditRelationshipValue {
  return REL_ALLOWED.has(s as EditRelationshipValue) ? (s as EditRelationshipValue) : "";
}

function normalizeStatus(s: string): EditStatusValue {
  if (STATUS_ALLOWED.has(s as EditStatusValue)) return s as EditStatusValue;
  return "Dead";
}

export function EditWhaleForm({ whale }: { whale: Whale }) {
  const router = useRouter();
  const { addToast } = useToast();
  const [relationshipStatus, setRelationshipStatus] = React.useState(() => normalizeRelationship(whale.relationship_status));
  const [status, setStatus] = React.useState(() => normalizeStatus(whale.status));
  const [notes, setNotes] = React.useState(whale.notes);
  const [pending, setPending] = React.useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    console.log("[edit-whale] saving", {
      whaleId: whale.id,
      relationship_status: relationshipStatus,
      status,
    });
    setPending(true);
    try {
      const res = await updateWhaleFields(whale.id, {
        relationship_status: relationshipStatus,
        status,
        notes,
      });
      if (!res.success) {
        addToast(
          localToast(`edit-whale-err-${Date.now()}`, "Could not save", res.error || "Something went wrong.", "high")
        );
        return;
      }
      addToast(
        localToast(`edit-whale-ok-${Date.now()}`, "Saved", "Whale updated successfully.", "normal")
      );
      router.push(ROUTES.chatter.myWhales);
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      addToast(localToast(`edit-whale-err-${Date.now()}`, "Could not save", message, "high"));
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className={cn(formSpace, "max-md:pb-[80px]")}>
      <div>
        <Label className="text-white/50">Username</Label>
        <p className="mt-1 text-[15px] text-white/90">{whale.username}</p>
      </div>
      <div>
        <Label className="text-white/50">Model</Label>
        <p className="mt-1 text-[15px] text-white/90">{whale.assigned_model_name || "—"}</p>
      </div>
      <div className={cn("relative", selectTapClass)}>
        <Label>Relationship status</Label>
        <CustomSelect
          key={`edit-whale-relationship-${whale.id}`}
          portaled
          value={relationshipStatus}
          onChange={(v) => setRelationshipStatus(normalizeRelationship(v))}
          options={[...EDIT_RELATIONSHIP_OPTIONS]}
        />
      </div>
      <div className={cn("relative", selectTapClass)}>
        <Label>Status</Label>
        <CustomSelect
          key={`edit-whale-status-${whale.id}`}
          portaled
          value={status}
          onChange={(v) => setStatus(normalizeStatus(v))}
          options={[...EDIT_STATUS_OPTIONS]}
        />
      </div>
      <div>
        <Label>Notes</Label>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} />
      </div>
      <div className="flex flex-col gap-3 pt-3 md:flex-row md:flex-wrap md:items-center md:gap-4 md:pt-2">
        <SubmitButton disabled={pending} className="min-h-12 w-full sm:w-auto">
          {pending ? "Saving..." : "Save changes"}
        </SubmitButton>
        <Link
          href={ROUTES.chatter.myWhales}
          className={cn(btnSecondaryClass, "inline-flex min-h-12 w-full items-center justify-center sm:w-auto")}
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
