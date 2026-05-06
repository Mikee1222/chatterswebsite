"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  Banknote,
  Calendar,
  Clock,
  Fish,
  Layers,
  MessageSquare,
  Sparkles,
  Timer,
  UserRound,
} from "lucide-react";
import { createWhaleTransaction } from "@/services/whale-transactions";
import type { TransactionType, TransactionCurrency } from "@/types";
import { TRANSACTION_TYPES, TRANSACTION_CURRENCY_OPTIONS } from "@/lib/airtable-options";
import { ROUTES } from "@/lib/routes";
import { isoToEuropeanDisplay, parseEuropeanDateInput } from "@/lib/format";
import { SuccessBlock, btnSecondaryClass, formSpace, formRowClass } from "@/components/ui/form";
import { FormField } from "@/components/ui/form-field";
import { FormInput } from "@/components/ui/form-input";
import { FormTextarea } from "@/components/ui/form-textarea";
import { FormSubmitButton } from "@/components/ui/form-submit-button";
import { CustomSelect } from "@/components/ui/custom-select";
import { cn } from "@/lib/utils";

export function FieldShell({
  icon: Icon,
  label,
  htmlFor,
  children,
  required,
}: {
  icon: LucideIcon;
  label: string;
  htmlFor?: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <FormField label={label} icon={<Icon className="h-4 w-4" aria-hidden />} htmlFor={htmlFor} required={required}>
      {children}
    </FormField>
  );
}

export function sanitizeDecimalInput(raw: string): string {
  const cleaned = raw.replace(/[^\d.]/g, "");
  const parts = cleaned.split(".");
  if (parts.length <= 1) return cleaned;
  return parts[0] + "." + parts.slice(1).join("").replace(/\./g, "");
}

const selectTriggerLuxury =
  "border-white/12 bg-black/35 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] hover:border-pink-400/25 hover:bg-white/[0.06]";

type WhaleOption = {
  id: string;
  username: string;
  assigned_model_id: string;
  assigned_model_name: string;
};

type Props = {
  chatterRecordId: string;
  chatterName: string;
  whales: WhaleOption[];
};

export function LogTransactionForm({ chatterRecordId, chatterName, whales }: Props) {
  const router = useRouter();
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const timeNow = now.toTimeString().slice(0, 5);

  const [whaleId, setWhaleId] = React.useState("");
  const [modelName, setModelName] = React.useState("");
  const [date, setDate] = React.useState(today);
  const [dateDisplay, setDateDisplay] = React.useState(() => isoToEuropeanDisplay(today));
  React.useEffect(() => setDateDisplay(isoToEuropeanDisplay(date)), [date]);
  const [time, setTime] = React.useState(timeNow);
  const [sessionMinutes, setSessionMinutes] = React.useState("");
  const [amount, setAmount] = React.useState("");
  const [currency, setCurrency] = React.useState<TransactionCurrency>("usd");
  const [type, setType] = React.useState<TransactionType>("sexting + videos");
  const [note, setNote] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [done, setDone] = React.useState(false);

  const whaleOptions = React.useMemo(
    () => [
      { value: "", label: "Select whale" },
      ...whales.map((w) => ({ value: w.id, label: w.username })),
    ],
    [whales]
  );
  const currencyOptions = React.useMemo(
    () => TRANSACTION_CURRENCY_OPTIONS.map((c) => ({ value: c, label: c.toUpperCase() })),
    []
  );
  const typeOptions = React.useMemo(
    () => TRANSACTION_TYPES.map((t) => ({ value: t, label: t })),
    []
  );

  const selectedWhale = whales.find((w) => w.id === whaleId);

  React.useEffect(() => {
    if (selectedWhale) {
      setModelName(selectedWhale.assigned_model_name || "");
    }
  }, [selectedWhale]);

  const sessionMinutesNum = sessionMinutes.trim() ? parseInt(sessionMinutes, 10) : NaN;
  const isSessionMinutesValid = Number.isInteger(sessionMinutesNum) && sessionMinutesNum >= 0;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedWhale) return;
    if (!isSessionMinutesValid) return;
    const dateIso = parseEuropeanDateInput(dateDisplay) ?? date;
    setPending(true);
    try {
      await createWhaleTransaction({
        whale_record_id: selectedWhale.id,
        whale_username: selectedWhale.username,
        chatter_record_id: chatterRecordId,
        chatter_name: chatterName,
        model_record_id: selectedWhale.assigned_model_id || undefined,
        model_name: modelName,
        date: dateIso,
        time,
        session_length_minutes: sessionMinutesNum,
        amount: parseFloat(amount) || 0,
        currency,
        type,
        note,
      });
      router.refresh();
      setDone(true);
    } finally {
      setPending(false);
    }
  }

  if (done) {
    return (
      <SuccessBlock title="Session logged.">
        <button
          type="button"
          onClick={() => {
            setDone(false);
            setAmount("");
            setNote("");
          }}
          className={btnSecondaryClass}
        >
          Log another
        </button>
        <button type="button" onClick={() => router.push(ROUTES.chatter.myWhales)} className={btnSecondaryClass}>
          Back to My whales
        </button>
      </SuccessBlock>
    );
  }

  const currencySymbol = currency === "usd" ? "$" : "€";

  return (
    <form onSubmit={submit} className={cn(formSpace, "space-y-4")}>
      <FieldShell icon={Fish} label="Whale" htmlFor="log-tx-whale" required>
        <CustomSelect
          id="log-tx-whale"
          value={whaleId}
          onChange={setWhaleId}
          required
          options={whaleOptions}
          triggerClassName={selectTriggerLuxury}
        />
      </FieldShell>

      <FieldShell icon={Sparkles} label="Model name" htmlFor="log-tx-model">
        <FormInput
          id="log-tx-model"
          value={modelName}
          onChange={(e) => setModelName(e.target.value)}
          placeholder="Auto-filled from whale"
        />
      </FieldShell>

      <div className={cn(formRowClass, "gap-4")}>
        <FieldShell icon={Calendar} label="Date" htmlFor="log-tx-date" required>
          <FormInput
            id="log-tx-date"
            type="text"
            inputMode="numeric"
            placeholder="dd/mm/yyyy"
            required
            value={dateDisplay}
            onChange={(e) => setDateDisplay(e.target.value)}
            onBlur={() => {
              const iso = parseEuropeanDateInput(dateDisplay);
              if (iso) setDate(iso);
              else setDateDisplay(isoToEuropeanDisplay(date));
            }}
          />
        </FieldShell>
        <FieldShell icon={Clock} label="Time" htmlFor="log-tx-time">
          <FormInput id="log-tx-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </FieldShell>
      </div>

      <FieldShell icon={Timer} label="Session length (minutes)" htmlFor="log-tx-mins" required>
        <FormInput
          id="log-tx-mins"
          type="number"
          min={0}
          value={sessionMinutes}
          onChange={(e) => setSessionMinutes(e.target.value)}
          placeholder="Required"
          required
          error={sessionMinutes.trim() !== "" && !isSessionMinutesValid ? "Enter a whole number (0 or more)." : undefined}
        />
      </FieldShell>

      <div className={cn(formRowClass, "items-stretch gap-4")}>
        <FieldShell icon={Banknote} label="Amount" htmlFor="log-tx-amount" required>
          <div className="relative">
            <span
              className="pointer-events-none absolute left-4 top-1/2 z-[1] -translate-y-1/2 text-[15px] font-semibold text-white/45"
              aria-hidden
            >
              {currencySymbol}
            </span>
            <FormInput
              id="log-tx-amount"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              required
              value={amount}
              onChange={(e) => setAmount(sanitizeDecimalInput(e.target.value))}
              placeholder="0.00"
              className="pl-8 tabular-nums"
            />
          </div>
        </FieldShell>
        <FieldShell icon={Layers} label="Currency" htmlFor="log-tx-currency">
          <CustomSelect
            id="log-tx-currency"
            value={currency}
            onChange={(v) => setCurrency(v as TransactionCurrency)}
            options={currencyOptions}
            triggerClassName={selectTriggerLuxury}
          />
        </FieldShell>
      </div>

      <FieldShell icon={UserRound} label="Type" htmlFor="log-tx-type">
        <CustomSelect
          id="log-tx-type"
          value={type}
          onChange={(v) => setType(v as TransactionType)}
          options={typeOptions}
          triggerClassName={selectTriggerLuxury}
        />
      </FieldShell>

      <FieldShell icon={MessageSquare} label="Note" htmlFor="log-tx-note">
        <FormTextarea
          id="log-tx-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          placeholder="Optional context for this session…"
        />
      </FieldShell>

      <FormSubmitButton disabled={pending || !isSessionMinutesValid || !whaleId.trim()} loading={pending} className="w-full">
        {pending ? "Logging…" : "Log session"}
      </FormSubmitButton>
    </form>
  );
}
