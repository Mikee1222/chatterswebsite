"use client";

import * as React from "react";
import {
  CheckCircle2,
  Copy,
  Loader2,
  Send,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { GlassModal, ButtonPrimary, ButtonSecondary } from "@/components/ui/form";
import { FormInput } from "@/components/ui/form-input";
import { FormSelect } from "@/components/ui/form-select";
import { FormTextarea } from "@/components/ui/form-textarea";
import {
  CHATTER_ATTACHMENT_MAX_BYTES,
  CHATTER_ATTACHMENT_MAX_MB,
} from "@/lib/chatter-attachment-constants";
import { uploadScreenshotToSupabaseStorage } from "@/lib/client-direct-storage-upload";
import { postFormData } from "@/lib/post-form-data";
import { useIsSupabaseBackend } from "@/contexts/data-backend-context";
import type { FineBonusPaymentMethod } from "@/services/fines-bonuses";

export type ModelPaymentInfo = {
  id: string;
  model_name: string;
  paypal_email?: string;
  paypal_link?: string;
  revolut_tag?: string;
  payment_notes?: string;
  payment_threshold_eur?: number;
};

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = React.useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success(`${label} copied`);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Copy failed");
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-white/70 transition hover:bg-white/10"
    >
      {copied ? <CheckCircle2 className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
      Copy
    </button>
  );
}

function PaymentInfoRow({ label, value }: { label: string; value?: string }) {
  if (!value?.trim()) {
    return (
      <div className="text-sm">
        <span className="text-white/40">{label}: </span>
        <span className="text-white/30">Not set</span>
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-white/40">{label}:</span>
      <span className="break-all font-medium text-white/90">{value}</span>
      <CopyButton value={value} label={label} />
    </div>
  );
}

function ModelPaymentInfoBox({ model }: { model: ModelPaymentInfo }) {
  const threshold = model.payment_threshold_eur ?? 200;
  const hasPaypal = !!(model.paypal_email?.trim() || model.paypal_link?.trim());
  const hasRevolut = !!model.revolut_tag?.trim();
  const hasAny = hasPaypal || hasRevolut || !!model.payment_notes?.trim();

  return (
    <div className="rounded-xl border border-pink-500/20 bg-pink-500/[0.06] p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-pink-200/80">Payment details</p>
        <span className="rounded-full border border-pink-500/25 bg-pink-500/10 px-2.5 py-0.5 text-xs font-medium text-pink-200">
          Over €{threshold}
        </span>
      </div>
      {!hasAny ? (
        <p className="text-sm text-white/35">No payment details on file for this model.</p>
      ) : (
        <div className="space-y-2">
          <PaymentInfoRow label="PayPal email" value={model.paypal_email} />
          <PaymentInfoRow label="PayPal link" value={model.paypal_link} />
          <PaymentInfoRow label="Revolut" value={model.revolut_tag} />
          {model.payment_notes?.trim() ? (
            <p className="text-xs text-white/50">{model.payment_notes}</p>
          ) : null}
        </div>
      )}
    </div>
  );
}

export function ExtraRevenueModal({
  open,
  onClose,
  modelss,
  onSubmitted,
}: {
  open: boolean;
  onClose: () => void;
  modelss: ModelPaymentInfo[];
  onSubmitted?: () => void;
}) {
  const isSupabase = useIsSupabaseBackend();
  const [modelId, setModelId] = React.useState("");
  const [amount, setAmount] = React.useState("");
  const [paymentMethod, setPaymentMethod] = React.useState<FineBonusPaymentMethod>("PayPal");
  const [paymentSource, setPaymentSource] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [screenshot, setScreenshot] = React.useState<File | null>(null);
  const [dragOver, setDragOver] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    if (!open) {
      setModelId("");
      setAmount("");
      setPaymentMethod("PayPal");
      setPaymentSource("");
      setNotes("");
      setScreenshot(null);
      setDragOver(false);
      setPending(false);
    }
  }, [open]);

  const selectedModel = modelss.find((m) => m.id === modelId);

  function setScreenshotFile(file: File | null) {
    if (!file) {
      setScreenshot(null);
      return;
    }
    if (file.size > CHATTER_ATTACHMENT_MAX_BYTES) {
      toast.error(`Screenshot must be under ${CHATTER_ATTACHMENT_MAX_MB}MB`);
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }
    setScreenshot(file);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!modelId || !selectedModel) {
      toast.error("Select a model");
      return;
    }
    if (!screenshot) {
      toast.error("Screenshot is required");
      return;
    }
    setPending(true);
    try {
      const fd = new FormData();
      fd.set("model_id", modelId);
      fd.set("model_name", selectedModel.model_name);
      fd.set("amount", amount);
      fd.set("payment_method", paymentMethod);
      if (paymentMethod === "Other") fd.set("payment_source", paymentSource);
      if (notes.trim()) fd.set("notes", notes.trim());
      if (isSupabase) {
        const { sbUrl } = await uploadScreenshotToSupabaseStorage(screenshot, "extra-revenue");
        fd.set("screenshot_url", sbUrl);
      } else {
        fd.set("screenshot", screenshot);
      }

      const res = await postFormData("/api/chatter/extra-revenue", fd);
      const data = (await res.json()) as { error?: string; success?: boolean };
      if (!res.ok) {
        toast.error(data.error || "Submit failed");
        return;
      }
      toast.success("Payment submitted for review");
      onSubmitted?.();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Submit failed");
    } finally {
      setPending(false);
    }
  }

  if (!open) return null;

  return (
    <GlassModal
      onClose={onClose}
      title="Submit extra revenue"
      subtitle="Log a payment received outside the usual flow"
      className="md:max-w-lg"
    >
      <form onSubmit={submit} className="space-y-5 px-4 py-4 md:px-5 md:py-5">
        {/* Section 1: Model & Amount */}
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block text-xs font-semibold uppercase tracking-wider text-white/40">
            Model
            <FormSelect
              value={modelId}
              onChange={(e) => setModelId(e.target.value)}
              className="mt-1.5"
              required
            >
              <option value="">— Select model —</option>
              {modelss.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.model_name}
                </option>
              ))}
            </FormSelect>
          </label>

          <label className="block text-xs font-semibold uppercase tracking-wider text-white/40">
            Amount (EUR)
            <FormInput
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="mt-1.5"
              placeholder="0.00"
              required
            />
          </label>
        </section>

        {/* Section 2: Model payment info */}
        {selectedModel ? <ModelPaymentInfoBox model={selectedModel} /> : null}

        {/* Section 3: Payment method & other source */}
        <section className="space-y-4">
          <label className="block text-xs font-semibold uppercase tracking-wider text-white/40">
            Payment method
            <FormSelect
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as FineBonusPaymentMethod)}
              className="mt-1.5"
            >
              <option value="PayPal">PayPal</option>
              <option value="Revolut">Revolut</option>
              <option value="Other">Other</option>
            </FormSelect>
          </label>

          {paymentMethod === "Other" && (
            <label className="block text-xs font-semibold uppercase tracking-wider text-white/40">
              Other payment source
              <FormInput
                value={paymentSource}
                onChange={(e) => setPaymentSource(e.target.value)}
                className="mt-1.5"
                placeholder="e.g. Wise, bank transfer"
                required
              />
            </label>
          )}
        </section>

        {/* Section 4: Screenshot upload */}
        <section>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/40">Screenshot</p>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => setScreenshotFile(e.target.files?.[0] ?? null)}
          />
          <div
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") fileRef.current?.click();
            }}
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const file = e.dataTransfer.files?.[0];
              if (file) setScreenshotFile(file);
            }}
            className={`flex min-h-[120px] cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-6 text-center transition ${
              dragOver
                ? "border-pink-400/50 bg-pink-500/10"
                : screenshot
                  ? "border-green-500/30 bg-green-500/[0.06]"
                  : "border-white/20 bg-white/[0.03] hover:bg-white/[0.05]"
            }`}
          >
            {screenshot ? (
              <>
                <CheckCircle2 className="h-8 w-8 text-green-400" />
                <p className="text-sm font-medium text-white">{screenshot.name}</p>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setScreenshot(null);
                    if (fileRef.current) fileRef.current.value = "";
                  }}
                  className="inline-flex items-center gap-1 text-xs text-white/50 hover:text-white/80"
                >
                  <X className="h-3 w-3" />
                  Remove
                </button>
              </>
            ) : (
              <>
                <Upload className="h-8 w-8 text-pink-300/70" />
                <p className="text-sm text-white/70">Drag & drop or click to upload</p>
                <p className="text-xs text-white/40">PNG, JPG — max {CHATTER_ATTACHMENT_MAX_MB}MB</p>
              </>
            )}
          </div>
        </section>

        {/* Section 5: Notes */}
        <section>
          <label className="block text-xs font-semibold uppercase tracking-wider text-white/40">
            Notes (optional)
            <FormTextarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="mt-1.5"
              placeholder="Any extra context for the admin review…"
            />
          </label>
        </section>

        <div className="flex gap-2 pt-1">
          <ButtonPrimary type="submit" disabled={pending} className="flex flex-1 items-center justify-center gap-2">
            {pending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Submitting…
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                Submit payment
              </>
            )}
          </ButtonPrimary>
          <ButtonSecondary type="button" onClick={onClose} disabled={pending}>
            Cancel
          </ButtonSecondary>
        </div>
      </form>
    </GlassModal>
  );
}
