"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { createWhaleTransaction } from "@/services/whale-transactions";
import type { TransactionType, TransactionCurrency } from "@/types";
import { TRANSACTION_TYPES, TRANSACTION_CURRENCY_OPTIONS } from "@/lib/airtable-options";
import { ROUTES } from "@/lib/routes";
import { isoToEuropeanDisplay, parseEuropeanDateInput } from "@/lib/format";
import {
  Label,
  Input,
  Textarea,
  Select,
  SuccessBlock,
  SubmitButton,
  btnSecondaryClass,
  formSpace,
  formRowClass,
  selectOptionClass,
} from "@/components/ui/form";

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
          onClick={() => { setDone(false); setAmount(""); setNote(""); }}
          className={btnSecondaryClass}
        >
          Log another
        </button>
        <button
          type="button"
          onClick={() => router.push(ROUTES.chatter.myWhales)}
          className={btnSecondaryClass}
        >
          Back to My whales
        </button>
      </SuccessBlock>
    );
  }

  return (
    <form onSubmit={submit} className={formSpace}>
      <div>
        <Label>Whale</Label>
        <Select value={whaleId} onChange={(e) => setWhaleId(e.target.value)} required>
          <option value="" className={selectOptionClass}>Select whale</option>
          {whales.map((w) => (
            <option key={w.id} value={w.id} className={selectOptionClass}>
              {w.username}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label>Model name</Label>
        <Input
          value={modelName}
          onChange={(e) => setModelName(e.target.value)}
          placeholder="Auto-filled from whale"
        />
      </div>
      <div className={formRowClass}>
        <div>
          <Label>Date</Label>
          <Input
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
        </div>
        <div>
          <Label>Time</Label>
          <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </div>
      </div>
      <div>
        <Label>Session length (min)</Label>
        <Input
          type="number"
          min={0}
          value={sessionMinutes}
          onChange={(e) => setSessionMinutes(e.target.value)}
          placeholder="Required"
          required
          aria-invalid={sessionMinutes.trim() !== "" && !isSessionMinutesValid}
        />
        {sessionMinutes.trim() !== "" && !isSessionMinutesValid && (
          <p className="mt-1 text-xs text-rose-400/90">Enter a whole number (0 or more).</p>
        )}
      </div>
      <div className={formRowClass}>
        <div>
          <Label>Amount</Label>
          <Input
            type="number"
            min={0}
            step={0.01}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
        </div>
        <div>
          <Label>Currency</Label>
          <Select value={currency} onChange={(e) => setCurrency(e.target.value as TransactionCurrency)}>
            {TRANSACTION_CURRENCY_OPTIONS.map((c) => (
              <option key={c} value={c} className={selectOptionClass}>{c.toUpperCase()}</option>
            ))}
          </Select>
        </div>
      </div>
      <div>
        <Label>Type</Label>
        <Select value={type} onChange={(e) => setType(e.target.value as TransactionType)}>
          {TRANSACTION_TYPES.map((t) => (
            <option key={t} value={t} className={selectOptionClass}>{t}</option>
          ))}
        </Select>
      </div>
      <div>
        <Label>Note</Label>
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          placeholder="Optional"
        />
      </div>
      <SubmitButton disabled={pending || !isSessionMinutesValid}>
        {pending ? "Logging…" : "Log session"}
      </SubmitButton>
    </form>
  );
}
