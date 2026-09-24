"use client";

import * as React from "react";
import {
  CalendarClock,
  DollarSign,
  Flag,
  MessageSquare,
  Sparkles,
  Tag,
  User,
} from "lucide-react";
import { createCustomRequest } from "@/services/custom-requests";
import type { CustomRequestType, CustomRequestPriority } from "@/types";
import { CUSTOM_REQUEST_TYPE_OPTIONS, CUSTOM_REQUEST_PRIORITY_OPTIONS } from "@/lib/airtable-options";
import { FormError, formRowClass } from "@/components/ui/form";
import { FormField } from "@/components/ui/form-field";
import { FormInput } from "@/components/ui/form-input";
import { FormSelect } from "@/components/ui/form-select";
import { FormTextarea } from "@/components/ui/form-textarea";
import { FormSubmitButton } from "@/components/ui/form-submit-button";
import { SopFormSection } from "@/components/sop/sop-form-section";
import { CustomRequestStatusBadge } from "@/components/custom-request-ui";
import { cn } from "@/lib/utils";

const selectOptionClass = "bg-[#1a1a1a] text-white";

type Props = {
  chatterRecordId: string;
  chatterName: string;
  modelOptions: { id: string; name: string }[];
  onCreated?: () => void;
};

/** Digits and at most one decimal point; strips $ and other characters. */
function sanitizePriceAmountInput(raw: string): string {
  const cleaned = raw.replace(/[^0-9.]/g, "");
  const dot = cleaned.indexOf(".");
  if (dot === -1) return cleaned;
  return cleaned.slice(0, dot + 1) + cleaned.slice(dot + 1).replace(/\./g, "");
}

export function RequestCustomForm({ chatterRecordId, chatterName, modelOptions, onCreated }: Props) {
  const [modelRecordId, setModelRecordId] = React.useState("");
  const [modelName, setModelName] = React.useState("");
  const [fanUsername, setFanUsername] = React.useState("");
  const [customType, setCustomType] = React.useState<CustomRequestType>("video");
  const [description, setDescription] = React.useState("");
  const [priceAmount, setPriceAmount] = React.useState("");
  const [priority, setPriority] = React.useState<CustomRequestPriority>("normal");
  const [deadline, setDeadline] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const [submittedTitle, setSubmittedTitle] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  const handleModelChange = (id: string) => {
    const opt = modelOptions.find((o) => o.id === id);
    setModelRecordId(id);
    setModelName(opt?.name ?? "");
  };

  const resetForm = () => {
    setFanUsername("");
    setDescription("");
    setPriceAmount("");
    setDeadline("");
    setPriority("normal");
    setCustomType("video");
    setDone(false);
    setSubmittedTitle("");
    setError(null);
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!modelRecordId || !modelName) return;
    setError(null);
    setPending(true);
    try {
      await createCustomRequest({
        chatter_record_id: chatterRecordId,
        chatter_name: chatterName,
        model_record_id: modelRecordId,
        model_name: modelName,
        fan_username: fanUsername.trim(),
        custom_type: customType,
        description: description.trim(),
        price: priceAmount.trim(),
        deadline_requested: deadline.trim() || null,
      });
      setSubmittedTitle(description.trim() || customType.replace(/_/g, " "));
      setDone(true);
      onCreated?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message || "Failed to submit request");
    } finally {
      setPending(false);
    }
  }

  if (done) {
    return (
      <div className="space-y-4 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-5 py-6">
        <p className="text-sm font-semibold text-emerald-200">Request submitted</p>
        <p className="text-sm text-white/70">
          {submittedTitle ? `"${submittedTitle}" ` : "Your custom "}is now with the agency.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-white/45">Status</span>
          <CustomRequestStatusBadge status="pending" />
        </div>
        <p className="text-xs leading-relaxed text-white/45">
          Next: Pending → Accepted → Scheduled → In progress → Delivered. You’ll see each step here.
        </p>
        <button
          type="button"
          onClick={resetForm}
          className="rounded-2xl border border-white/15 bg-white/[0.06] px-5 py-3 text-[15px] font-medium text-white/90 transition-all hover:border-white/20 hover:bg-white/[0.1] focus:outline-none focus:ring-2 focus:ring-white/20"
        >
          Submit another
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {error && <FormError>{error}</FormError>}

      <SopFormSection title="Assignment" description="Who this custom is for">
        <FormField label="Model" icon={<Sparkles />} htmlFor="request-custom-model" required>
          <FormSelect
            id="request-custom-model"
            value={modelRecordId}
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

        <FormField label="Fan username" icon={<User />} htmlFor="request-custom-fan" required>
          <FormInput
            id="request-custom-fan"
            value={fanUsername}
            onChange={(e) => setFanUsername(e.target.value)}
            required
            placeholder="@username"
          />
        </FormField>
      </SopFormSection>

      <SopFormSection title="Request details" description="What the fan asked for">
        <FormField label="Type" icon={<Tag />} htmlFor="request-custom-type" required>
          <FormSelect
            id="request-custom-type"
            value={customType}
            onChange={(e) => setCustomType(e.target.value as CustomRequestType)}
            required
          >
            {CUSTOM_REQUEST_TYPE_OPTIONS.map((t) => (
              <option key={t} value={t} className={selectOptionClass}>
                {t.replace(/_/g, " ")}
              </option>
            ))}
          </FormSelect>
        </FormField>

        <FormField
          label="Description"
          icon={<MessageSquare />}
          htmlFor="request-custom-description"
          required
          description="Include duration, poses, or anything the model needs to deliver."
        >
          <FormTextarea
            id="request-custom-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            rows={4}
            placeholder="e.g. 8-minute video, lingerie, name drop…"
          />
        </FormField>
      </SopFormSection>

      <SopFormSection title="Commercial" description="Price, timing, and priority">
        <div className={cn(formRowClass, "gap-4")}>
          <FormField label="Price" icon={<DollarSign />} htmlFor="request-custom-price">
            <div className="relative">
              <span
                className="pointer-events-none absolute left-4 top-1/2 z-[1] -translate-y-1/2 text-[15px] font-medium text-pink-400/90"
                aria-hidden
              >
                $
              </span>
              <FormInput
                id="request-custom-price"
                className="pl-8"
                value={priceAmount}
                onChange={(e) => setPriceAmount(sanitizePriceAmountInput(e.target.value))}
                inputMode="decimal"
                autoComplete="transaction-amount"
                placeholder="50"
              />
            </div>
          </FormField>

          <FormField label="Priority" icon={<Flag />} htmlFor="request-custom-priority">
            <FormSelect
              id="request-custom-priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value as CustomRequestPriority)}
            >
              {CUSTOM_REQUEST_PRIORITY_OPTIONS.map((p) => (
                <option key={p} value={p} className={selectOptionClass}>
                  {p}
                </option>
              ))}
            </FormSelect>
          </FormField>
        </div>

        <FormField
          label="Deadline"
          icon={<CalendarClock />}
          htmlFor="request-custom-deadline"
          description="Optional promised date for the model."
        >
          <FormInput
            id="request-custom-deadline"
            type="date"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            className="[color-scheme:dark]"
          />
        </FormField>
      </SopFormSection>

      <FormSubmitButton disabled={pending} loading={pending} className="w-full">
        {pending ? "Submitting…" : "Submit request"}
      </FormSubmitButton>
    </form>
  );
}
