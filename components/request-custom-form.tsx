"use client";

import * as React from "react";
import {
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
import { FormError, SuccessBlock, formRowClass } from "@/components/ui/form";
import { FormField } from "@/components/ui/form-field";
import { FormInput } from "@/components/ui/form-input";
import { FormSelect } from "@/components/ui/form-select";
import { FormTextarea } from "@/components/ui/form-textarea";
import { FormSubmitButton } from "@/components/ui/form-submit-button";
import { cn } from "@/lib/utils";

const selectOptionClass = "bg-[#1a1a1a] text-white";

type Props = {
  chatterRecordId: string;
  chatterName: string;
  modelOptions: { id: string; name: string }[];
};

/** Digits and at most one decimal point; strips $ and other characters. */
function sanitizePriceAmountInput(raw: string): string {
  const cleaned = raw.replace(/[^0-9.]/g, "");
  const dot = cleaned.indexOf(".");
  if (dot === -1) return cleaned;
  return cleaned.slice(0, dot + 1) + cleaned.slice(dot + 1).replace(/\./g, "");
}

export function RequestCustomForm({ chatterRecordId, chatterName, modelOptions }: Props) {
  const [modelRecordId, setModelRecordId] = React.useState("");
  const [modelName, setModelName] = React.useState("");
  const [fanUsername, setFanUsername] = React.useState("");
  const [customType, setCustomType] = React.useState<CustomRequestType>("video");
  const [description, setDescription] = React.useState("");
  /** Numeric characters only (e.g. "150" or "12.50"); submitted without "$". */
  const [priceAmount, setPriceAmount] = React.useState("");
  const [priority, setPriority] = React.useState<CustomRequestPriority>("normal");
  const [pending, setPending] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleModelChange = (id: string) => {
    const opt = modelOptions.find((o) => o.id === id);
    setModelRecordId(id);
    setModelName(opt?.name ?? "");
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
      });
      setDone(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message || "Failed to submit request");
    } finally {
      setPending(false);
    }
  }

  if (done) {
    return (
      <SuccessBlock title="Request submitted.">
        <button
          type="button"
          onClick={() => setDone(false)}
          className="rounded-2xl border border-white/15 bg-white/[0.06] px-5 py-3 text-[15px] font-medium text-white/90 transition-all hover:bg-white/[0.1] hover:border-white/20 focus:outline-none focus:ring-2 focus:ring-white/20"
        >
          Submit another
        </button>
      </SuccessBlock>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4 md:space-y-4">
      {error && <FormError>{error}</FormError>}

      <FormField label="Model" icon={<Sparkles />} htmlFor="request-custom-model" required staggerIndex={0}>
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

      <FormField label="Fan username" icon={<User />} htmlFor="request-custom-fan" required staggerIndex={1}>
        <FormInput
          id="request-custom-fan"
          value={fanUsername}
          onChange={(e) => setFanUsername(e.target.value)}
          required
          placeholder="@username"
        />
      </FormField>

      <FormField label="Type" icon={<Tag />} htmlFor="request-custom-type" staggerIndex={2}>
        <FormSelect
          id="request-custom-type"
          value={customType}
          onChange={(e) => setCustomType(e.target.value as CustomRequestType)}
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
        staggerIndex={3}
      >
        <FormTextarea
          id="request-custom-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
          rows={4}
          placeholder="Details…"
        />
      </FormField>

      <div className={cn(formRowClass, "gap-4")}>
        <FormField label="Price" icon={<DollarSign />} htmlFor="request-custom-price" staggerIndex={4}>
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

        <FormField label="Priority" icon={<Flag />} htmlFor="request-custom-priority" staggerIndex={5}>
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

      <FormSubmitButton disabled={pending} loading={pending} className="w-full">
        {pending ? "Submitting…" : "Submit request"}
      </FormSubmitButton>
    </form>
  );
}
