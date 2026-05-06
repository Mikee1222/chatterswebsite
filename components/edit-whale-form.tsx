"use client";
import { devLog } from "@/lib/dev-log";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Activity, Heart, Sparkles, StickyNote, User } from "lucide-react";
import { updateWhaleFields } from "@/app/actions/whales";
import type { AppNotification, Whale } from "@/types";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { useToast } from "@/contexts/toast-context";
import { btnSecondaryClass, formSpace, selectOptionClass } from "@/components/ui/form";
import { FormField } from "@/components/ui/form-field";
import { FormSelect } from "@/components/ui/form-select";
import { FormTextarea } from "@/components/ui/form-textarea";
import { FormSubmitButton } from "@/components/ui/form-submit-button";

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
  const [relationshipStatus, setRelationshipStatus] = React.useState(() =>
    normalizeRelationship(whale.relationship_status)
  );
  const [status, setStatus] = React.useState(() => normalizeStatus(whale.status));
  const [notes, setNotes] = React.useState(whale.notes);
  const [pending, setPending] = React.useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    devLog("[edit-whale] saving", {
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
    <form onSubmit={submit} className={cn(formSpace, "max-md:pb-[80px] space-y-4")}>
      <FormField label="Username" icon={<User />} description="Whale handle (read-only).">
        <p className="rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-[15px] text-white/90">
          {whale.username}
        </p>
      </FormField>
      <FormField label="Model" icon={<Sparkles />} description="Assigned model (read-only).">
        <p className="rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-[15px] text-white/90">
          {whale.assigned_model_name || "—"}
        </p>
      </FormField>
      <FormField label="Relationship status" icon={<Heart />} htmlFor={`edit-whale-relationship-${whale.id}`}>
        <FormSelect
          id={`edit-whale-relationship-${whale.id}`}
          key={`edit-whale-relationship-${whale.id}`}
          value={relationshipStatus}
          onChange={(e) => setRelationshipStatus(normalizeRelationship(e.target.value))}
        >
          {EDIT_RELATIONSHIP_OPTIONS.map((o) => (
            <option key={o.value || "dash"} value={o.value} className={selectOptionClass}>
              {o.label}
            </option>
          ))}
        </FormSelect>
      </FormField>
      <FormField label="Status" icon={<Activity />} htmlFor={`edit-whale-status-${whale.id}`}>
        <FormSelect
          id={`edit-whale-status-${whale.id}`}
          key={`edit-whale-status-${whale.id}`}
          value={status}
          onChange={(e) => setStatus(normalizeStatus(e.target.value))}
        >
          {EDIT_STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value} className={selectOptionClass}>
              {o.label}
            </option>
          ))}
        </FormSelect>
      </FormField>
      <FormField label="Notes" icon={<StickyNote />} htmlFor={`edit-whale-notes-${whale.id}`}>
        <FormTextarea
          id={`edit-whale-notes-${whale.id}`}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
        />
      </FormField>
      <div className="flex flex-col gap-3 pt-2 md:flex-row md:flex-wrap md:items-stretch">
        <FormSubmitButton
          disabled={pending}
          loading={pending}
          className="w-full min-h-12 md:min-w-[12rem] md:flex-1"
        >
          {pending ? "Saving…" : "Save changes"}
        </FormSubmitButton>
        <Link
          href={ROUTES.chatter.myWhales}
          className={cn(btnSecondaryClass, "inline-flex min-h-12 w-full items-center justify-center md:w-auto md:px-8")}
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
