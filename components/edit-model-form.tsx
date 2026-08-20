"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Activity,
  Building2,
  CreditCard,
  Gauge,
  Hash,
  Info,
  Layers,
  Link2,
  Sparkles,
  StickyNote,
  Trophy,
  User,
  Users,
} from "lucide-react";
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
import { SopFormSection } from "@/components/sop/sop-form-section";
import { StatInfoTooltip } from "@/components/infloww-performance-ui";
import {
  ClarioSuiteAccountsEditor,
  draftAccountsForSave,
  type ClarioSuiteAccountDraft,
} from "@/components/clariosuite-accounts-editor";

const PLATFORMS = ["onlyfans", "fanvue", "other"] as const;
const STATUS_OPTIONS = ["active", "inactive"] as const;
const PRIORITY_OPTIONS = ["low", "medium", "high"] as const;
const TEAM_OPTIONS = [
  { value: "gunzo_team", label: "Gunzo Team" },
  { value: "chatting_agency", label: "Chatting Agency" },
] as const;

const INFLOWW_CREATOR_TOOLTIP =
  "Stable Infloww creator ID from Earnings → Creator ID lookup. Used to sync creator revenue and performance — distinct from this app's model record ID.";

const CLARIOSUITE_IG_TOOLTIP =
  "Instagram account ID from Marketing → Instagram Insights → IG account lookup. Links this model to ClarioSuite analytics.";

const WINNER_THRESHOLD_TOOLTIP =
  "Per-model view thresholds for Winner Videos Hub auto-detect from ClarioSuite. Changing these does NOT reclassify already-detected videos.";

const STORY_LINK_A_TOOLTIP =
  "Link A for the weekly Story CTA rotation — used Monday and Saturday (48h story w/ Instagram Plus).";

const STORY_LINK_B_TOOLTIP =
  "Link B for the weekly Story CTA rotation — used Wednesday (48h story w/ Instagram Plus).";

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

function IntegrationFieldLabel({ label, tooltip }: { label: string; tooltip: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {label}
      <StatInfoTooltip text={tooltip} />
    </span>
  );
}

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
  const [clariosuiteAccounts, setClariosuiteAccounts] = React.useState<ClarioSuiteAccountDraft[]>(
    []
  );
  const [accountsLoaded, setAccountsLoaded] = React.useState(false);
  const [storyLinkA, setStoryLinkA] = React.useState("");
  const [storyLinkB, setStoryLinkB] = React.useState("");
  const [storyLinksLoaded, setStoryLinksLoaded] = React.useState(false);
  const [winnerThresholdViews, setWinnerThresholdViews] = React.useState("100000");
  const [superWinnerThresholdViews, setSuperWinnerThresholdViews] = React.useState("300000");
  const [winnerThresholdsLoaded, setWinnerThresholdsLoaded] = React.useState(false);
  const [linkedUserId, setLinkedUserId] = React.useState(currentLinkedUserId);
  const [clientId, setClientId] = React.useState(
    () => clientAssignments.find((a) => a.client[0])?.client[0] ?? ""
  );
  const [clientOptions, setClientOptions] = React.useState<ClientOption[]>([]);
  const [clientsLoading, setClientsLoading] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    fetch(`/api/admin/models/${encodeURIComponent(model.id)}/clariosuite-accounts`)
      .then((res) => res.json())
      .then((data: { accounts?: ClarioSuiteAccountDraft[] }) => {
        if (cancelled) return;
        const rows = data.accounts ?? [];
        if (rows.length) {
          setClariosuiteAccounts(rows);
        } else if (model.clariosuite_ig_user_id?.trim()) {
          setClariosuiteAccounts([
            {
              clariosuite_ig_user_id: model.clariosuite_ig_user_id.trim(),
              account_label: "Main",
              is_primary: true,
            },
          ]);
        }
        setAccountsLoaded(true);
      })
      .catch(() => setAccountsLoaded(true));
    return () => {
      cancelled = true;
    };
  }, [model.id, model.clariosuite_ig_user_id]);

  React.useEffect(() => {
    let cancelled = false;
    fetch(`/api/admin/models/${encodeURIComponent(model.id)}/story-link-config`)
      .then((res) => res.json())
      .then((data: { config?: { link_a_url?: string | null; link_b_url?: string | null } }) => {
        if (cancelled) return;
        setStoryLinkA(data.config?.link_a_url?.trim() ?? "");
        setStoryLinkB(data.config?.link_b_url?.trim() ?? "");
        setStoryLinksLoaded(true);
      })
      .catch(() => setStoryLinksLoaded(true));
    return () => {
      cancelled = true;
    };
  }, [model.id]);

  React.useEffect(() => {
    let cancelled = false;
    fetch(`/api/admin/models/${encodeURIComponent(model.id)}/winner-thresholds`)
      .then((res) => res.json())
      .then(
        (data: {
          thresholds?: {
            winner_threshold_views?: number;
            super_winner_threshold_views?: number;
          };
        }) => {
          if (cancelled) return;
          setWinnerThresholdViews(String(data.thresholds?.winner_threshold_views ?? 100000));
          setSuperWinnerThresholdViews(
            String(data.thresholds?.super_winner_threshold_views ?? 300000),
          );
          setWinnerThresholdsLoaded(true);
        },
      )
      .catch(() => setWinnerThresholdsLoaded(true));
    return () => {
      cancelled = true;
    };
  }, [model.id]);

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
        paypal_email: paypalEmail.trim() || undefined,
        paypal_link: paypalLink.trim() || undefined,
        revolut_tag: revolutTag.trim() || undefined,
        payment_notes: paymentNotes.trim() || undefined,
        payment_threshold_eur: Number.parseInt(paymentThreshold, 10) || 200,
      });
      if (accountsLoaded) {
        const toSave = draftAccountsForSave(clariosuiteAccounts);
        await fetch(`/api/admin/models/${encodeURIComponent(model.id)}/clariosuite-accounts`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accounts: toSave }),
        });
      }
      if (storyLinksLoaded) {
        await fetch(`/api/admin/models/${encodeURIComponent(model.id)}/story-link-config`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            link_a_url: storyLinkA.trim() || null,
            link_b_url: storyLinkB.trim() || null,
          }),
        });
      }
      if (winnerThresholdsLoaded) {
        await fetch(`/api/admin/models/${encodeURIComponent(model.id)}/winner-thresholds`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            winner_threshold_views: Number.parseInt(winnerThresholdViews, 10) || 100000,
            super_winner_threshold_views:
              Number.parseInt(superWinnerThresholdViews, 10) || 300000,
          }),
        });
      }
      await relinkModelUserForModelProfile(model.id, linkedUserId || null);
      await syncClientAssignments();
      router.push(`${ROUTES.accounts}?section=modelss&success=model_updated`);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className={`${formSpace} mx-auto max-w-2xl space-y-5`}>
      <SopFormSection title="Basic info" description="Name, platform, team, and operational settings">
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
        <FormField label="Notes" icon={<StickyNote />} htmlFor="notes">
          <FormTextarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Optional"
          />
        </FormField>
      </SopFormSection>

      <SopFormSection title="Role & account link" description="Login account and live scheduling state">
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
      </SopFormSection>

      <SopFormSection
        title="Integrations"
        description="External IDs for earnings, marketing analytics, and Story CTA links"
        defaultOpen={Boolean(
          inflowwCreatorId ||
            clariosuiteAccounts.some((a) => a.clariosuite_ig_user_id) ||
            storyLinkA ||
            storyLinkB,
        )}
      >
        <FormField
          label={<IntegrationFieldLabel label="Infloww creator ID" tooltip={INFLOWW_CREATOR_TOOLTIP} />}
          icon={<Hash />}
          htmlFor="infloww_creator_id"
          description="Numeric creator ID from Infloww — links creator earnings sync."
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
          label={
            <IntegrationFieldLabel label="Instagram accounts (ClarioSuite)" tooltip={CLARIOSUITE_IG_TOOLTIP} />
          }
          icon={<Hash />}
          description="Link one primary and optional secondary IG accounts. Daily sync runs for every linked account."
        >
          {accountsLoaded ? (
            <ClarioSuiteAccountsEditor
              modelId={model.id}
              initialAccounts={clariosuiteAccounts}
              onChange={setClariosuiteAccounts}
            />
          ) : (
            <p className="text-sm text-white/40">Loading linked accounts…</p>
          )}
        </FormField>
        <FormField
          label={
            <IntegrationFieldLabel
              label="Winner / Super Winner thresholds"
              tooltip={WINNER_THRESHOLD_TOOLTIP}
            />
          }
          icon={<Trophy />}
          description="View counts that auto-classify ClarioSuite Reels into Winner Videos Hub. Not retroactive."
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <FormInput
              id="winner_threshold_views"
              type="number"
              min={0}
              step={1000}
              value={winnerThresholdViews}
              onChange={(e) => setWinnerThresholdViews(e.target.value)}
              placeholder="100000"
              disabled={!winnerThresholdsLoaded}
              aria-label="Winner threshold views"
            />
            <FormInput
              id="super_winner_threshold_views"
              type="number"
              min={0}
              step={1000}
              value={superWinnerThresholdViews}
              onChange={(e) => setSuperWinnerThresholdViews(e.target.value)}
              placeholder="300000"
              disabled={!winnerThresholdsLoaded}
              aria-label="Super Winner threshold views"
            />
          </div>
        </FormField>
        <FormField
          label={<IntegrationFieldLabel label="Story CTA — Link A" tooltip={STORY_LINK_A_TOOLTIP} />}
          icon={<Link2 />}
          htmlFor="story_link_a"
          description="Monday & Saturday — 48h story w/ Instagram Plus."
        >
          <FormInput
            id="story_link_a"
            type="url"
            value={storyLinkA}
            onChange={(e) => setStoryLinkA(e.target.value)}
            placeholder="https://…"
            disabled={!storyLinksLoaded}
          />
        </FormField>
        <FormField
          label={<IntegrationFieldLabel label="Story CTA — Link B" tooltip={STORY_LINK_B_TOOLTIP} />}
          icon={<Link2 />}
          htmlFor="story_link_b"
          description="Wednesday — 48h story w/ Instagram Plus."
        >
          <FormInput
            id="story_link_b"
            type="url"
            value={storyLinkB}
            onChange={(e) => setStoryLinkB(e.target.value)}
            placeholder="https://…"
            disabled={!storyLinksLoaded}
          />
        </FormField>
      </SopFormSection>

      <SopFormSection
        title="Compensation & payment"
        description="PayPal, Revolut, and payout thresholds for this model"
        defaultOpen={Boolean(
          paypalEmail || paypalLink || revolutTag || paymentNotes || model.payment_threshold_eur
        )}
      >
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
      </SopFormSection>

      <div className="flex flex-col-reverse gap-3 border-t border-white/10 pt-5 sm:flex-row sm:items-center sm:justify-between">
        <Link
          href={ROUTES.accountsModelss}
          className={`${btnSecondaryClass} flex min-h-[52px] w-full items-center justify-center sm:w-auto sm:px-8`}
        >
          Cancel
        </Link>
        <FormSubmitButton disabled={pending} loading={pending} className="w-full sm:w-auto sm:min-w-[180px]">
          {pending ? "Saving…" : "Save changes"}
        </FormSubmitButton>
      </div>
    </form>
  );
}
