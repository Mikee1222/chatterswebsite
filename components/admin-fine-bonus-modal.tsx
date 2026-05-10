"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Coins } from "lucide-react";
import { cn } from "@/lib/utils";
import { getTodayYmdAthens } from "@/lib/airtable-datetime";
import { useToast } from "@/contexts/toast-context";
import type { AppNotification } from "@/types";
import type { FineBonusUserRole, FineBonusType } from "@/services/fines-bonuses";

function localToast(id: string, title: string, body: string, priority: "normal" | "high"): AppNotification {
  return {
    id,
    notification_id: id,
    user_id: "local",
    category: "system",
    event_type: "system_alert",
    priority,
    title,
    body,
    entity_type: "system",
    entity_id: "",
    read_at: null,
    created_at: new Date().toISOString(),
  };
}

type PickUser = { id: string; name: string; user_role: FineBonusUserRole };

const BONUS_CHIPS = [
  "Monthly target hit",
  "Exceptional performance",
  "New whale added",
  "Perfect attendance",
  "Going above and beyond",
];
const FINE_CHIPS = ["Late start", "No-show", "Policy violation", "Client complaint"];

function defaultMonth(): string {
  return getTodayYmdAthens().slice(0, 7);
}

export function FineBonusQuickActionSheetRow({
  onClose,
  onOpen,
}: {
  onClose: () => void;
  onOpen: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={() => {
          onClose();
          onOpen();
        }}
        className="flex min-h-[52px] w-full items-center gap-3 rounded-xl px-3 py-3.5 text-left text-[15px] font-medium text-white/95 transition-colors active:bg-white/10"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-green-500/20 text-green-400">
          <Coins className="h-5 w-5" />
        </span>
        <div>
          <p className="text-white">Add fine / bonus</p>
          <p className="text-xs text-white/40">Issue to chatter or VA</p>
        </div>
      </button>
    </li>
  );
}

export function FineBonusQuickActionNavRow({ onClose, onOpen }: { onClose: () => void; onOpen: () => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={() => {
          onClose();
          onOpen();
        }}
        className={cn(
          "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-white/5"
        )}
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-green-500/20">
          <Coins className="h-4 w-4 text-green-400" />
        </div>
        <div>
          <p className="text-sm font-medium text-white">Add fine / bonus</p>
          <p className="text-xs text-white/40">Issue to chatter or VA</p>
        </div>
      </button>
    </li>
  );
}

type Props = {
  open: boolean;
  onClose: () => void;
};

export function AdminFineBonusModal({ open, onClose }: Props) {
  const { addToast } = useToast();
  const [type, setType] = React.useState<FineBonusType>("bonus");
  const [userId, setUserId] = React.useState("");
  const [amount, setAmount] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [month, setMonth] = React.useState(defaultMonth);
  const [users, setUsers] = React.useState<PickUser[]>([]);
  const [loadingUsers, setLoadingUsers] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setLoadingUsers(true);
    fetch("/api/admin/fines-bonuses?pick_users=1")
      .then((r) => r.json())
      .then((d: { users?: PickUser[] }) => {
        if (Array.isArray(d.users)) setUsers(d.users);
      })
      .catch(() => setUsers([]))
      .finally(() => setLoadingUsers(false));
  }, [open]);

  React.useEffect(() => {
    if (!open) {
      setType("bonus");
      setUserId("");
      setAmount("");
      setReason("");
      setNotes("");
      setMonth(defaultMonth());
    }
  }, [open]);

  const selectedUser = users.find((u) => u.id === userId);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const amt = Number.parseFloat(amount);
    if (!userId || !selectedUser || !reason.trim() || !Number.isFinite(amt) || amt < 0) {
      addToast(localToast("fb-val", "Check form", "Pick a user, amount, and reason.", "normal"));
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/fines-bonuses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          user_name: selectedUser.name,
          user_role: selectedUser.user_role,
          type,
          amount: amt,
          reason: reason.trim(),
          notes: notes.trim(),
          month,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        addToast(localToast("fb-err", "Failed", typeof data.error === "string" ? data.error : "Could not save.", "high"));
        return;
      }
      addToast(localToast("fb-ok", "Saved", "Fine / bonus recorded.", "normal"));
      onClose();
    } finally {
      setSubmitting(false);
    }
  }

  const chips = type === "bonus" ? BONUS_CHIPS : FINE_CHIPS;

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.button
            type="button"
            aria-label="Close"
            className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => !submitting && onClose()}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="fine-bonus-title"
            className="fixed inset-x-4 top-[8vh] z-[201] max-h-[min(84dvh,640px)] overflow-y-auto rounded-2xl border border-white/10 bg-zinc-950 p-5 shadow-2xl md:left-1/2 md:w-full md:max-w-md md:-translate-x-1/2"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
          >
            <h2 id="fine-bonus-title" className="text-lg font-semibold text-white">
              Add fine / bonus
            </h2>
            <form onSubmit={submit} className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setType("bonus")}
                  className={`rounded-xl border py-3 font-semibold transition-all ${
                    type === "bonus"
                      ? "border-green-500/30 bg-green-500/20 text-green-400"
                      : "border-white/10 bg-white/5 text-white/40"
                  }`}
                >
                  🎉 Bonus
                </button>
                <button
                  type="button"
                  onClick={() => setType("fine")}
                  className={`rounded-xl border py-3 font-semibold transition-all ${
                    type === "fine"
                      ? "border-red-500/30 bg-red-500/20 text-red-400"
                      : "border-white/10 bg-white/5 text-white/40"
                  }`}
                >
                  ⚠️ Fine
                </button>
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-white/40">Recipient</label>
                <select
                  required
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  disabled={loadingUsers}
                  className="mt-1 flex min-h-11 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white"
                >
                  <option value="">{loadingUsers ? "Loading…" : "Select user"}</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.user_role === "va" ? "[🖥️ VA] " : "[👤 Chatter] "}
                      {u.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-white/40">Amount</label>
                <div className="relative mt-1">
                  <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/40">€</span>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-white/5 py-3 pl-8 pr-4 text-white focus:border-pink-500/50 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-white/40">Reason</label>
                <input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  required
                  placeholder="e.g. Monthly performance bonus"
                  className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/25 focus:border-pink-500/50 focus:outline-none"
                />
                <div className="mt-2 flex flex-wrap gap-2">
                  {chips.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setReason(r)}
                      className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-white/50 transition-colors hover:bg-white/10"
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-white/40">Month</label>
                <input
                  type="month"
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:border-pink-500/50 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-white/40">Notes (optional)</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="mt-1 w-full resize-none rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/25 focus:border-pink-500/50 focus:outline-none"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={onClose}
                  className="flex-1 rounded-xl border border-white/15 py-3 text-sm text-white/70"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 rounded-xl bg-gradient-to-r from-pink-500/80 to-fuchsia-600/80 py-3 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {submitting ? "Saving…" : "Submit"}
                </button>
              </div>
            </form>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  );
}
