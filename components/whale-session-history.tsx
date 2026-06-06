"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import {
  Banknote,
  Calendar,
  Clock,
  Layers,
  MessageSquare,
  Sparkles,
  Timer,
  Pencil,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { transactionTypeLabel, TRANSACTION_CURRENCY_OPTIONS, TRANSACTION_TYPES } from "@/lib/airtable-options";
import { formatDateEuropean, formatTimeEuropean, displayName, isoToEuropeanDisplay, parseEuropeanDateInput } from "@/lib/format";
import type { WhaleTransaction, TransactionType, TransactionCurrency } from "@/types";
import { deleteWhaleTransactionAction, updateWhaleTransactionAction } from "@/app/actions/whale-transactions";
import { CustomSelect } from "@/components/ui/custom-select";
import { ButtonSecondary } from "@/components/ui/form";
import { FormInput } from "@/components/ui/form-input";
import { FormTextarea } from "@/components/ui/form-textarea";
import { FieldShell, sanitizeDecimalInput } from "@/components/log-transaction-form";
import { cn } from "@/lib/utils";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

const selectTriggerLuxury =
  "border-white/12 bg-black/35 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] hover:border-pink-400/25 hover:bg-white/[0.06]";

function notePreview(note: string | undefined, maxLen = 48): string {
  if (!note?.trim()) return "—";
  const t = note.trim();
  return t.length <= maxLen ? t : t.slice(0, maxLen) + "…";
}

function timeForInput(time: string | undefined): string {
  const t = String(time ?? "").trim();
  if (!t) return "00:00";
  const m = t.match(/^(\d{1,2}):(\d{2})/);
  if (m) return `${m[1].padStart(2, "0")}:${m[2]}`;
  return t.slice(0, 5);
}

function EditTransactionModal({
  tx,
  onClose,
}: {
  tx: WhaleTransaction;
  onClose: () => void;
}) {
  const router = useRouter();
  const [modelName, setModelName] = React.useState(tx.model_name ?? "");
  const [dateDisplay, setDateDisplay] = React.useState(() => isoToEuropeanDisplay(tx.date));
  const [dateIso, setDateIso] = React.useState(tx.date);
  const [time, setTime] = React.useState(() => timeForInput(tx.time));
  const [sessionMinutes, setSessionMinutes] = React.useState(String(tx.session_length_minutes ?? ""));
  const [amount, setAmount] = React.useState(
    tx.amount != null ? String(tx.amount) : ""
  );
  const [currency, setCurrency] = React.useState<TransactionCurrency>(tx.currency);
  const [type, setType] = React.useState<TransactionType>(tx.type);
  const [note, setNote] = React.useState(tx.note ?? "");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const currencyOptions = React.useMemo(
    () => TRANSACTION_CURRENCY_OPTIONS.map((c) => ({ value: c, label: c.toUpperCase() })),
    []
  );
  const typeOptions = React.useMemo(
    () => TRANSACTION_TYPES.map((t) => ({ value: t, label: t })),
    []
  );

  const sessionMinutesNum = sessionMinutes.trim() ? parseInt(sessionMinutes, 10) : NaN;
  const isSessionMinutesValid = Number.isInteger(sessionMinutesNum) && sessionMinutesNum >= 0;
  const currencySymbol = currency === "usd" ? "$" : "€";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!isSessionMinutesValid) {
      setError("Session length must be a whole number (0 or more).");
      return;
    }
    const parsedDate = parseEuropeanDateInput(dateDisplay) ?? dateIso;
    setPending(true);
    try {
      const res = await updateWhaleTransactionAction(tx.id, {
        model_name: modelName.trim(),
        date: parsedDate,
        time,
        session_length_minutes: sessionMinutesNum,
        amount: parseFloat(amount) || 0,
        currency,
        type,
        note: note.trim(),
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.refresh();
      onClose();
    } finally {
      setPending(false);
    }
  }

  const node =
    typeof document !== "undefined"
      ? createPortal(
          <motion.div
            className="fixed inset-0 z-[100] flex items-end justify-center p-0 sm:items-center sm:p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <button
              type="button"
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              aria-label="Close"
              onClick={onClose}
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="edit-tx-title"
              className="relative z-[1] flex max-h-[min(92dvh,720px)] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-white/12 bg-gradient-to-b from-zinc-950 to-black shadow-2xl sm:rounded-2xl"
              initial={{ y: 24, opacity: 0.96 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 16, opacity: 0 }}
              transition={{ type: "spring", stiffness: 380, damping: 32 }}
            >
              <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-5 py-4">
                <div className="min-w-0">
                  <h2 id="edit-tx-title" className="truncate text-lg font-semibold text-white">
                    Edit session
                  </h2>
                  <p className="mt-0.5 truncate text-sm text-white/50">{displayName(tx.whale_username)}</p>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg border border-white/12 p-2 text-white/70 transition hover:border-white/25 hover:bg-white/10 hover:text-white"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5 pb-6">
                {error ? <p className="text-sm text-rose-300">{error}</p> : null}
                <FieldShell icon={Sparkles} label="Model name" htmlFor="edit-tx-model">
                  <FormInput id="edit-tx-model" value={modelName} onChange={(e) => setModelName(e.target.value)} />
                </FieldShell>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FieldShell icon={Calendar} label="Date" htmlFor="edit-tx-date">
                    <FormInput
                      id="edit-tx-date"
                      type="text"
                      inputMode="numeric"
                      value={dateDisplay}
                      onChange={(e) => setDateDisplay(e.target.value)}
                      onBlur={() => {
                        const iso = parseEuropeanDateInput(dateDisplay);
                        if (iso) setDateIso(iso);
                        else setDateDisplay(isoToEuropeanDisplay(dateIso));
                      }}
                    />
                  </FieldShell>
                  <FieldShell icon={Clock} label="Time" htmlFor="edit-tx-time">
                    <FormInput id="edit-tx-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
                  </FieldShell>
                </div>
                <FieldShell icon={Timer} label="Session length (minutes)" htmlFor="edit-tx-mins">
                  <FormInput
                    id="edit-tx-mins"
                    type="number"
                    min={0}
                    value={sessionMinutes}
                    onChange={(e) => setSessionMinutes(e.target.value)}
                    error={sessionMinutes.trim() !== "" && !isSessionMinutesValid ? "Whole number ≥ 0" : undefined}
                  />
                </FieldShell>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FieldShell icon={Banknote} label="Amount" htmlFor="edit-tx-amount">
                    <div className="relative">
                      <span
                        className="pointer-events-none absolute left-3 top-1/2 z-[1] -translate-y-1/2 text-[15px] font-semibold text-white/45"
                        aria-hidden
                      >
                        {currencySymbol}
                      </span>
                      <FormInput
                        id="edit-tx-amount"
                        type="text"
                        inputMode="decimal"
                        value={amount}
                        onChange={(e) => setAmount(sanitizeDecimalInput(e.target.value))}
                        className="pl-8 tabular-nums"
                      />
                    </div>
                  </FieldShell>
                  <FieldShell icon={Layers} label="Currency" htmlFor="edit-tx-currency">
                    <CustomSelect
                      id="edit-tx-currency"
                      value={currency}
                      onChange={(v) => setCurrency(v as TransactionCurrency)}
                      options={currencyOptions}
                      triggerClassName={selectTriggerLuxury}
                    />
                  </FieldShell>
                </div>
                <FieldShell icon={UserRound} label="Type" htmlFor="edit-tx-type">
                  <CustomSelect
                    id="edit-tx-type"
                    value={type}
                    onChange={(v) => setType(v as TransactionType)}
                    options={typeOptions}
                    triggerClassName={selectTriggerLuxury}
                  />
                </FieldShell>
                <FieldShell icon={MessageSquare} label="Note" htmlFor="edit-tx-note">
                  <FormTextarea id="edit-tx-note" value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
                </FieldShell>
                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="submit"
                    disabled={pending || !isSessionMinutesValid}
                    className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-xl border border-pink-400/45 bg-gradient-to-r from-pink-500/35 to-fuchsia-600/30 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_0_24px_-8px_hsl(330_80%_55%/0.35)] transition hover:brightness-110 disabled:pointer-events-none disabled:opacity-45 sm:flex-none"
                  >
                    {pending ? "Saving…" : "Save changes"}
                  </button>
                  <ButtonSecondary type="button" className="min-h-[44px] sm:px-6" onClick={onClose}>
                    Cancel
                  </ButtonSecondary>
                </div>
              </form>
            </motion.div>
          </motion.div>,
          document.body
        )
      : null;

  return node;
}

export function WhaleSessionHistory({ transactions }: { transactions: WhaleTransaction[] }) {
  const router = useRouter();
  const [editing, setEditing] = React.useState<WhaleTransaction | null>(null);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [deleteTx, setDeleteTx] = React.useState<WhaleTransaction | null>(null);

  async function runDeleteSession(tx: WhaleTransaction) {
    setDeletingId(tx.id);
    try {
      const res = await deleteWhaleTransactionAction(tx.id);
      if (!res.ok) {
        window.alert(res.error);
        return;
      }
      setDeleteTx(null);
      router.refresh();
    } finally {
      setDeletingId(null);
    }
  }

  function requestDeleteSession(tx: WhaleTransaction) {
    setDeleteTx(tx);
  }

  return (
    <>
    <div className="glass-card overflow-hidden border border-white/[0.08] shadow-[0_0_40px_-16px_hsl(330_80%_55%/0.12)]">
      <div className="border-b border-white/10 bg-white/[0.03] px-5 py-4">
        <h2 className="text-base font-semibold tracking-tight text-white">Previous sessions</h2>
        <p className="mt-1 text-[13px] leading-snug text-white/50">Your recent whale sessions — hover a row for actions.</p>
      </div>
      <div className="max-h-[min(520px,62vh)] overflow-x-auto overflow-y-auto">
        {transactions.length === 0 ? (
          <div className="px-6 py-14 text-center text-sm text-white/45">No sessions logged yet.</div>
        ) : (
          <table className="w-full min-w-[720px] border-collapse text-left">
            <thead className="sticky top-0 z-10 border-b border-white/10 bg-black/80 backdrop-blur-md">
              <tr className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/45">
                <th className="whitespace-nowrap px-4 py-3.5 pl-5">Whale</th>
                <th className="whitespace-nowrap px-4 py-3.5">Model</th>
                <th className="whitespace-nowrap px-4 py-3.5 text-right">Amount</th>
                <th className="min-w-[140px] px-4 py-3.5">Type</th>
                <th className="whitespace-nowrap px-4 py-3.5 text-right tabular-nums">Min</th>
                <th className="whitespace-nowrap px-4 py-3.5">Date</th>
                <th className="whitespace-nowrap px-4 py-3.5">Time</th>
                <th className="min-w-[120px] max-w-[180px] px-4 py-3.5">Note</th>
                <th className="sticky right-0 w-[1%] whitespace-nowrap bg-black/80 px-3 py-3.5 pr-4 text-center backdrop-blur-md">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx) => (
                <tr
                  key={tx.id}
                  className={cn(
                    "group border-b border-white/[0.06] text-[13px] transition-colors duration-150",
                    "hover:bg-pink-500/[0.07] hover:shadow-[inset_3px_0_0_0_hsl(330_80%_55%/0.55)]"
                  )}
                >
                  <td className="px-4 py-3.5 pl-5 font-semibold text-white/95">{displayName(tx.whale_username)}</td>
                  <td className="px-4 py-3.5 text-[13px] text-white/80">{displayName(tx.model_name)}</td>
                  <td className="px-4 py-3.5 text-right font-medium tabular-nums text-white/95">
                    {tx.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{""}
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-white/45">
                      {tx.currency}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-[13px] leading-snug text-white/75">{transactionTypeLabel(tx.type)}</td>
                  <td className="px-4 py-3.5 text-right tabular-nums text-white/70">{tx.session_length_minutes ?? "—"}</td>
                  <td className="px-4 py-3.5 tabular-nums text-white/70">{formatDateEuropean(tx.date)}</td>
                  <td className="px-4 py-3.5 tabular-nums text-white/70">{formatTimeEuropean(tx.time)}</td>
                  <td
                    className="max-w-[180px] truncate px-4 py-3.5 text-[13px] text-white/55"
                    title={tx.note || undefined}
                  >
                    {notePreview(tx.note)}
                  </td>
                  <td
                    className={cn(
                      "sticky right-0 w-[1%] whitespace-nowrap border-l border-white/[0.06] bg-black/40 px-2 py-2 text-center backdrop-blur-sm",
                      "transition-colors group-hover:bg-pink-950/30"
                    )}
                  >
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => setEditing(tx)}
                        disabled={deletingId === tx.id}
                        className="rounded-lg border border-white/10 p-2 text-white/55 transition hover:border-pink-400/35 hover:bg-pink-500/15 hover:text-pink-100 disabled:opacity-40"
                        aria-label="Edit session"
                      >
                        <Pencil className="h-4 w-4" aria-hidden />
                      </button>
                      <button
                        type="button"
                        onClick={() => requestDeleteSession(tx)}
                        disabled={deletingId === tx.id}
                        className="rounded-lg border border-white/10 p-2 text-white/55 transition hover:border-red-400/40 hover:bg-red-500/15 hover:text-red-200 disabled:opacity-40"
                        aria-label="Delete session"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <AnimatePresence>
        {editing ? <EditTransactionModal key={editing.id} tx={editing} onClose={() => setEditing(null)} /> : null}
      </AnimatePresence>
    </div>
    <ConfirmDialog
      open={deleteTx != null}
      onClose={() => deletingId == null && setDeleteTx(null)}
      onConfirm={() => {
        const tx = deleteTx;
        if (tx) return runDeleteSession(tx);
      }}
      title="Delete session?"
      description={
        deleteTx
          ? `Delete this session for ${deleteTx.whale_username || "this whale"}? This cannot be undone.`
          : ""
      }
      confirmLabel="Delete"
      confirmVariant="danger"
      loading={deletingId != null}
    />
    </>
  );
}
