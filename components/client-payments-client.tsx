"use client";

import { useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, Clock, CreditCard, X } from "lucide-react";
import { MobileCard, MobileTouchButton } from "@/components/mobile-card";
import { formatDateYmd } from "@/lib/format-date";
import type {
  BillingCycleRecord,
  PaymentMethodRecord,
  PaymentSubmissionRecord,
} from "@/types/client-portal";
import { getCycleAmountDue } from "@/lib/client-portal-utils";

type CycleWithSubmission = BillingCycleRecord & {
  latestSubmission: PaymentSubmissionRecord | null;
};

type Props = {
  cycles: CycleWithSubmission[];
  paymentMethods: PaymentMethodRecord[];
};

function formatMoney(amount: number, currency: string): string {
  return `${new Intl.NumberFormat("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)} ${currency}`;
}

function kindLabel(kind: BillingCycleRecord["kind"]): string {
  return kind === "chatting_weekly" ? "Chatting Weekly" : "CRM Monthly";
}

function statusBadge(cycle: CycleWithSubmission) {
  const subStatus = cycle.latestSubmission?.status;
  if (subStatus === "pending_review") {
    return { label: "Pending Review", tone: "text-yellow-300 bg-yellow-500/10 border-yellow-500/30", icon: Clock };
  }
  if (subStatus === "approved") {
    return { label: "Approved", tone: "text-emerald-300 bg-emerald-500/10 border-emerald-500/30", icon: CheckCircle2 };
  }
  if (subStatus === "rejected") {
    return { label: "Rejected", tone: "text-red-300 bg-red-500/10 border-red-500/30", icon: AlertCircle };
  }
  if (cycle.status === "overdue") {
    return { label: "Overdue", tone: "text-red-300 bg-red-500/10 border-red-500/30", icon: AlertCircle };
  }
  return { label: "Due", tone: "text-blue-300 bg-blue-500/10 border-blue-500/30", icon: CreditCard };
}

export function ClientPaymentsClient({ cycles, paymentMethods }: Props) {
  const [selectedCycle, setSelectedCycle] = useState<CycleWithSubmission | null>(null);
  const [paymentMethodId, setPaymentMethodId] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [referenceId, setReferenceId] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const payableCycles = useMemo(
    () =>
      cycles.filter((c) => {
        const sub = c.latestSubmission;
        if (sub && sub.status !== "rejected") return false;
        return c.status === "announced" || c.status === "overdue" || c.status === "pending_review";
      }),
    [cycles]
  );

  const openPayModal = (cycle: CycleWithSubmission) => {
    setSelectedCycle(cycle);
    setPaymentMethodId(paymentMethods[0]?.id ?? "");
    setAmount(String(getCycleAmountDue(cycle)));
    setCurrency(cycle.currency || "USD");
    setReferenceId("");
    setNote("");
    setError(null);
    setSuccess(false);
  };

  const closeModal = () => {
    setSelectedCycle(null);
    setError(null);
    setSuccess(false);
  };

  const handleSubmit = async () => {
    if (!selectedCycle || !paymentMethodId || !amount) {
      setError("Please fill in all required fields.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/client/submit-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          billing_cycle_id: selectedCycle.id,
          payment_method_id: paymentMethodId,
          amount: parseFloat(amount),
          currency,
          datetime: new Date().toISOString(),
          reference_id: referenceId || undefined,
          note: note || undefined,
        }),
      });

      const data = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || !data.success) {
        throw new Error(data.error ?? "Submission failed");
      }

      setSuccess(true);
      setTimeout(() => {
        window.location.reload();
      }, 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 pb-20 md:pb-0">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">Payments</h1>
        <p className="mt-1 text-sm text-white/55">
          Submit payment proof for pending billing cycles
        </p>
      </div>

      {payableCycles.length === 0 ? (
        <div className="glass-card rounded-2xl p-8 text-center">
          <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-emerald-400/70" />
          <p className="text-white font-medium">You&apos;re all caught up</p>
          <p className="mt-1 text-sm text-white/50">No pending or overdue payments right now.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {payableCycles.map((cycle) => {
            const badge = statusBadge(cycle);
            const Icon = badge.icon;
            const due = getCycleAmountDue(cycle);
            return (
              <MobileCard
                key={cycle.id}
                className="glass-card border-white/10 bg-white/[0.04] !rounded-2xl"
                padding="lg"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-white">{kindLabel(cycle.kind)}</p>
                    <p className="mt-1 text-sm text-white/50">
                      {formatDateYmd(cycle.period_start)} – {formatDateYmd(cycle.period_end)}
                    </p>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${badge.tone}`}
                  >
                    <Icon className="h-3 w-3" />
                    {badge.label}
                  </span>
                </div>
                <div className="mt-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-white/50">Amount due</span>
                    <span className="font-semibold text-white tabular-nums">
                      {formatMoney(due, cycle.currency)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/50">Due date</span>
                    <span className="text-white/80">{formatDateYmd(cycle.due_date)}</span>
                  </div>
                </div>
                <div className="mt-5">
                  <MobileTouchButton onClick={() => openPayModal(cycle)} variant="primary">
                    Pay now
                  </MobileTouchButton>
                </div>
              </MobileCard>
            );
          })}
        </div>
      )}

      {paymentMethods.length > 0 && (
        <div className="glass-card rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-white/80">Available payment methods</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {paymentMethods.map((method) => (
              <div
                key={method.id}
                className="rounded-xl border border-white/10 bg-white/[0.04] p-4"
              >
                <p className="font-medium text-white">{method.label}</p>
                <p className="mt-1 text-xs text-white/45">{method.type}</p>
                {method.wallet_address && (
                  <p className="mt-2 truncate text-xs text-pink-300/80">{method.wallet_address}</p>
                )}
                {method.iban && (
                  <p className="mt-2 truncate text-xs text-pink-300/80">{method.iban}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {selectedCycle && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={closeModal} aria-hidden />
          <div className="relative w-full max-w-lg rounded-2xl border border-white/10 bg-[#14141a]/95 p-6 shadow-2xl backdrop-blur-xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Submit payment</h2>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-lg p-1.5 text-white/50 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {success ? (
              <div className="py-8 text-center">
                <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-emerald-400" />
                <p className="text-white font-medium">Payment submitted</p>
                <p className="mt-1 text-sm text-white/50">Refreshing…</p>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-white/55">
                  {kindLabel(selectedCycle.kind)} · {formatDateYmd(selectedCycle.period_start)} –{""}
                  {formatDateYmd(selectedCycle.period_end)}
                </p>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-white/50">
                    Payment method
                  </label>
                  <select
                    value={paymentMethodId}
                    onChange={(e) => setPaymentMethodId(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2.5 text-sm text-white focus:border-pink-400/40 focus:outline-none"
                  >
                    {paymentMethods.map((m) => (
                      <option key={m.id} value={m.id} className="bg-[#1a1a1a]">
                        {m.label} ({m.type})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-white/50">Amount</label>
                    <input
                      type="number"
                      step="0.01"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2.5 text-sm text-white focus:border-pink-400/40 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-white/50">Currency</label>
                    <select
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2.5 text-sm text-white focus:border-pink-400/40 focus:outline-none"
                    >
                      {["USD", "EUR", "USDT", "USDC", "SOL"].map((c) => (
                        <option key={c} value={c} className="bg-[#1a1a1a]">
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-white/50">
                    Reference ID (optional)
                  </label>
                  <input
                    type="text"
                    value={referenceId}
                    onChange={(e) => setReferenceId(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2.5 text-sm text-white focus:border-pink-400/40 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-white/50">Note (optional)</label>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={2}
                    className="w-full rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2.5 text-sm text-white focus:border-pink-400/40 focus:outline-none"
                  />
                </div>

                {error && (
                  <p className="text-sm text-red-400">{error}</p>
                )}

                <MobileTouchButton
                  onClick={handleSubmit}
                  disabled={submitting || paymentMethods.length === 0}
                  variant="primary"
                >
                  {submitting ? "Submitting…" : "Submit payment"}
                </MobileTouchButton>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
