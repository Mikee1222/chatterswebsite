"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Activity, Building2, CreditCard, Gauge, Hash, Info, Layers, Link2, Sparkles, StickyNote, User, Users } from "lucide-react";
import { updateModel } from "@/services/modelss";
import { relinkModelUserForModelProfile } from "@/services/users";
import type { ClientModelRecord } from "@/types/client-portal";
import type { ModelRecord } from "@/types";
import { ROUTES } from "@/lib/routes";
import { btnSecondaryClass, formSpace, selectOptionClass } from "@/components/ui/form";
import { FormField } from "@/components/ui/form-field";
import { FormInput } from "@/components/ui/form-input";
import { FormSelect } from "@/components/ui/form-select";
import { FormTextarea } from "@/components/ui/form-textarea";
import { FormSubmitButton } from "@/components/ui/form-submit-button";

const PLATFORMS = ["onlyfans", "fanvue", "other"] as const;
const STATUS_OPTIONS = ["active", "inactive"] as const;
const PRIORITY_OPTIONS = ["low", "medium", "high"] as const;
const TEAM_OPTIONS = [
  { value: "gunzo_team", label: "Gunzo Team" },
  { value: "chatting_agency", label: "Chatting Agency" },
] as const;

type LinkedUserOption = {
  id: string;
  name: string;
  email: string;
  alreadyLinked: boolean;
  linkedToThisModel: boolean;
};

type ClientOption = {
  id: string;
  label: string;
};

export function EditModelForm({
  model,
  userOptions = [],
  currentLinkedUserId = "",
  clientAssignments = [],
}: {
  model: ModelRecord;
  userOptions?: LinkedUserOption[];
  currentLinkedUserId?: string;
  clientAssignments?: ClientModelRecord[];
}) {
  const router = useRouter();
  const [modelName, setModelName] = React.useState(model.model_name);
  const [platform, setPlatform] = React.useState(model.platform);
  const [status, setStatus] = React.useState(model.status);
  const [priority, setPriority] = React.useState(model.priority || "medium");
  const [notes, setNotes] = React.useState(model.notes || "");
  const [paypalEmail, setPaypalEmail] = React.useState(model.paypal_email ?? "");
  const [paypalLink, setPaypalLink] = React.useState(model.paypal_link ?? "");
  const [revolutTag, setRevolutTag] = React.useState(model.revolut_tag ?? "");
  const [paymentNotes, setPaymentNotes] = React.useState(model.payment_notes ?? "");
  const [paymentThreshold, setPaymentThreshold] = React.useState(
    String(model.payment_threshold_eur ?? 200)
  );
  const [team, setTeam] = React.useState<ModelRecord["team"]>(model.team ?? "gunzo_team");
  const [inflowwCreatorId, setInflowwCreatorId] = React.useState(
    model.infloww_creator_id?.trim() ? model.infloww_creator_id.trim() : ""
  );
  const [clariosuiteIgUserId, setClariosuiteIgUserId] = React.useState(
    model.clariosuite_ig_user_id?.trim() ? model.clariosuite_ig_user_id.trim() : ""
  );
  const [linkedUserId, setLinkedUserId] = React.useState(currentLinkedUserId);
  const [clientId, setClientId] = React.useState(
    () => clientAssignments.find((a) => a.client[0])?.client[0] ?? ""
  );
  const [clientOptions, setClientOptions] = React.useState<ClientOption[]>([]);
  const [clientsLoading, setClientsLoading] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  React.useEffect(() => {
    if (team !== "chatting_agency") return;
    let cancelled = false;
    setClientsLoading(true);
    fetch("/api/admin/clients?activeOnly=true")
      .then((res) => res.json())
      .then((data: { clients?: { id: string; display_name?: string; company_name?: string; user_type?: string; status?: string }[] }) => {
        if (cancelled) return;
        const options = (data.clients ?? [])
          .filter((c) => c.user_type !== "team_member" && c.status === "active")
          .map((c) => ({
            id: c.id,
            label: c.display_name?.trim() || c.company_name?.trim() || c.id,
          }))
          .sort((a, b) => a.label.localeCompare(b.label));
        setClientOptions(options);
      })
      .finally(() => {
        if (!cancelled) setClientsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [team]);

  async function syncClientAssignments(): Promise<void> {
    if (team === "gunzo_team") {
      for (const assignment of clientAssignments) {
        const assignmentClientId = assignment.client[0];
        if (!assignmentClientId) continue;
        await fetch(`/api/admin/clients/${assignmentClientId}/models/${assignment.id}`, {
          method: "DELETE",
        });
      }
      return;
    }

    if (team === "chatting_agency" && clientId) {
      for (const assignment of clientAssignments) {
        const assignmentClientId = assignment.client[0];
        if (assignmentClientId && assignmentClientId !== clientId) {
          await fetch(`/api/admin/clients/${assignmentClientId}/models/${assignment.id}`, {
            method: "DELETE",
          });
        }
      }

      const alreadyAssigned = clientAssignments.some(
        (a) => a.client[0] === clientId && a.model.includes(model.id)
      );
      if (!alreadyAssigned) {
        await fetch(`/api/admin/clients/${clientId}/models`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ modelId: model.id }),
        });
      }
    }
  }

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
        team,
        infloww_creator_id: inflowwCreatorId.trim() || null,
        clariosuite_ig_user_id: clariosuiteIgUserId.trim() || null,
        paypal_email: paypalEmail.trim() || undefined,
        paypal_link: paypalLink.trim() || undefined,
        revolut_tag: revolutTag.trim() || undefined,
        payment_notes: paymentNotes.trim() || undefined,
        payment_threshold_eur: Number.parseInt(paymentThreshold, 10) || 200,
      });
      await relinkModelUserForModelProfile(model.id, linkedUserId || null);
      await syncClientAssignments();
      router.push(`${ROUTES.accounts}?section=modelss&success=model_updated`);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className={`${formSpace} space-y-4`}>
      <FormField label="Model name" icon={<Sparkles />} htmlFor="model_name" required>
        <FormInput
          id="model_name"
          value={modelName}
          onChange={(e) => setModelName(e.target.value)}
          required
        />
      </FormField>
      <FormField label="Platform" icon={<Layers />} htmlFor="platform">
        <FormSelect
          id="platform"
          value={platform}
          onChange={(e) => setPlatform(e.target.value as ModelRecord["platform"])}
        >
          {PLATFORMS.map((p) => (
            <option key={p} value={p} className={selectOptionClass}>
              {p}
            </option>
          ))}
        </FormSelect>
      </FormField>
      <FormField label="Team" icon={<Users />} htmlFor="team">
        <FormSelect
          id="team"
          value={team}
          onChange={(e) => setTeam(e.target.value as ModelRecord["team"])}
        >
          {TEAM_OPTIONS.map((option) => (
            <option key={option.value} value={option.value} className={selectOptionClass}>
              {option.label}
            </option>
          ))}
        </FormSelect>
      </FormField>
      {team === "chatting_agency" && (
        <FormField
          label="Client"
          icon={<Building2 />}
          htmlFor="client_id"
          description="Assign this model to a B2B client for billing and portal access."
        >
          <FormSelect
            id="client_id"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            disabled={clientsLoading}
          >
            <option value="" className={selectOptionClass}>
              {clientsLoading ? "Loading clients…" : "— Select client —"}
            </option>
            {clientOptions.map((c) => (
              <option key={c.id} value={c.id} className={selectOptionClass}>
                {c.label}
              </option>
            ))}
          </FormSelect>
        </FormField>
      )}
      <FormField label="Status" icon={<Activity />} htmlFor="status">
        <FormSelect id="status" value={status} onChange={(e) => setStatus(e.target.value)}>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s} className={selectOptionClass}>
              {s}
            </option>
          ))}
        </FormSelect>
      </FormField>
      <FormField label="Priority" icon={<Gauge />} htmlFor="priority">
        <FormSelect id="priority" value={priority} onChange={(e) => setPriority(e.target.value)}>
          {PRIORITY_OPTIONS.map((p) => (
            <option key={p} value={p} className={selectOptionClass}>
              {p}
            </option>
          ))}
        </FormSelect>
      </FormField>
      <FormField
        label="Linked user account"
        icon={<Link2 />}
        htmlFor="linked_user_id"
        description="The login account that belongs to this model."
      >
        <FormSelect
          id="linked_user_id"
          name="linked_user_id"
          value={linkedUserId}
          onChange={(e) => setLinkedUserId(e.target.value)}
        >
          <option value="" className={selectOptionClass}>
            — No account linked —
          </option>
          {userOptions.map((u) => (
            <option
              key={u.id}
              value={u.id}
              disabled={u.alreadyLinked && !u.linkedToThisModel}
              className={selectOptionClass}
            >
              {u.name} ({u.email})
              {u.alreadyLinked && !u.linkedToThisModel ? "(linked to other model)" : ""}
            </option>
          ))}
        </FormSelect>
      </FormField>
      <FormField
        label="Infloww creator ID"
        icon={<Hash />}
        htmlFor="infloww_creator_id"
        description="Stable Infloww creator id from Earnings → Creator ID lookup. Distinct from the app model_* id."
      >
        <FormInput
          id="infloww_creator_id"
          name="infloww_creator_id"
          type="text"
          inputMode="numeric"
          value={inflowwCreatorId}
          onChange={(e) => setInflowwCreatorId(e.target.value)}
          placeholder="e.g. 2243348022951978"
          autoComplete="off"
        />
      </FormField>
      <FormField
        label="ClarioSuite IG user ID"
        icon={<Hash />}
        htmlFor="clariosuite_ig_user_id"
        description="Instagram account id from Marketing → Instagram Insights → IG account lookup."
      >
        <FormInput
          id="clariosuite_ig_user_id"
          name="clariosuite_ig_user_id"
          type="text"
          inputMode="numeric"
          value={clariosuiteIgUserId}
          onChange={(e) => setClariosuiteIgUserId(e.target.value)}
          placeholder="e.g. 17841400000000000"
          autoComplete="off"
        />
      </FormField>
      <FormField label="Current status" icon={<Info />} description="Live state from scheduling (read-only).">
        <p className="rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white/90">
          {model.current_status}
        </p>
      </FormField>
      {model.current_status === "occupied" && model.current_chatter_name && (
        <FormField label="Current chatter" icon={<User />} description="Who is on this model right now.">
          <p className="rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white/90">
            {model.current_chatter_name}
          </p>
        </FormField>
      )}
      <FormField label="Notes" icon={<StickyNote />} htmlFor="notes">
        <FormTextarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Optional"
        />
      </FormField>

      <div className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          <CreditCard className="h-4 w-4 text-pink-300" aria-hidden />
          Payment Methods
        </div>
        <FormField label="PayPal Email" icon={<CreditCard />} htmlFor="paypal_email">
          <FormInput
            id="paypal_email"
            type="email"
            value={paypalEmail}
            onChange={(e) => setPaypalEmail(e.target.value)}
            placeholder="name@example.com"
          />
        </FormField>
        <FormField
          label="PayPal Link"
          icon={<Link2 />}
          htmlFor="paypal_link"
          description="e.g. paypal.me/username"
        >
          <FormInput
            id="paypal_link"
            type="url"
            value={paypalLink}
            onChange={(e) => setPaypalLink(e.target.value)}
            placeholder="https://paypal.me/..."
          />
        </FormField>
        <FormField label="Revolut Tag" icon={<CreditCard />} htmlFor="revolut_tag">
          <FormInput
            id="revolut_tag"
            value={revolutTag}
            onChange={(e) => setRevolutTag(e.target.value)}
            placeholder="@username"
          />
        </FormField>
        <FormField
          label="Payment Notes"
          icon={<StickyNote />}
          htmlFor="payment_notes"
          description="Other payment methods or instructions."
        >
          <FormTextarea
            id="payment_notes"
            value={paymentNotes}
            onChange={(e) => setPaymentNotes(e.target.value)}
            rows={2}
            placeholder="Optional"
          />
        </FormField>
        <FormField
          label="Payment Threshold EUR"
          icon={<Gauge />}
          htmlFor="payment_threshold_eur"
          description="Minimum amount before submitting extra revenue."
        >
          <FormInput
            id="payment_threshold_eur"
            type="number"
            min={0}
            step={1}
            value={paymentThreshold}
            onChange={(e) => setPaymentThreshold(e.target.value)}
          />
        </FormField>
      </div>

      <div className="flex flex-col gap-3 pt-2">
        <FormSubmitButton disabled={pending} loading={pending} className="w-full">
          {pending ? "Saving…" : "Save changes"}
        </FormSubmitButton>
        <Link href={ROUTES.accountsModelss} className={`${btnSecondaryClass} flex min-h-[52px] w-full items-center justify-center`}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
