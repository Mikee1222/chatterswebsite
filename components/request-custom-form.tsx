"use client";

import * as React from "react";
import { createCustomRequest } from "@/services/custom-requests";
import type { CustomRequestType, CustomRequestPriority } from "@/types";
import { CUSTOM_REQUEST_TYPE_OPTIONS, CUSTOM_REQUEST_PRIORITY_OPTIONS } from "@/lib/airtable-options";
import {
  Label,
  Input,
  Textarea,
  Select,
  FormError,
  SuccessBlock,
  SubmitButton,
  formSpace,
  selectOptionClass,
} from "@/components/ui/form";

type Props = {
  chatterRecordId: string;
  chatterName: string;
  modelOptions: { id: string; name: string }[];
};

export function RequestCustomForm({ chatterRecordId, chatterName, modelOptions }: Props) {
  const [modelRecordId, setModelRecordId] = React.useState("");
  const [modelName, setModelName] = React.useState("");
  const [fanUsername, setFanUsername] = React.useState("");
  const [customType, setCustomType] = React.useState<CustomRequestType>("video");
  const [description, setDescription] = React.useState("");
  const [price, setPrice] = React.useState("");
  const [priority, setPriority] = React.useState<CustomRequestPriority>("normal");
  const [pending, setPending] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
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
        price: price.trim(),
        priority,
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
    <form onSubmit={submit} className={formSpace}>
      {error && <FormError>{error}</FormError>}
      <div>
        <Label>Model</Label>
        <Select value={modelRecordId} onChange={handleModelChange} required>
          <option value="" className={selectOptionClass}>Select model</option>
          {modelOptions.map((m) => (
            <option key={m.id} value={m.id} className={selectOptionClass}>
              {m.name}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label>Fan username</Label>
        <Input
          value={fanUsername}
          onChange={(e) => setFanUsername(e.target.value)}
          required
          placeholder="@username"
        />
      </div>
      <div>
        <Label>Type</Label>
        <Select value={customType} onChange={(e) => setCustomType(e.target.value as CustomRequestType)}>
          {CUSTOM_REQUEST_TYPE_OPTIONS.map((t) => (
            <option key={t} value={t} className={selectOptionClass}>
              {t.replace(/_/g, " ")}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label>Description</Label>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
          rows={3}
          placeholder="Details..."
        />
      </div>
      <div>
        <Label>Price</Label>
        <Input
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder="e.g. 50"
        />
      </div>
      <div>
        <Label>Priority</Label>
        <Select value={priority} onChange={(e) => setPriority(e.target.value as CustomRequestPriority)}>
          {CUSTOM_REQUEST_PRIORITY_OPTIONS.map((p) => (
            <option key={p} value={p} className={selectOptionClass}>
              {p}
            </option>
          ))}
        </Select>
      </div>
      <SubmitButton disabled={pending}>
        {pending ? "Submitting…" : "Submit request"}
      </SubmitButton>
    </form>
  );
}
