"use client";

import * as React from "react";
import { Plus, Star, Trash2 } from "lucide-react";
import { Hash } from "lucide-react";
import { AdminClarioSuiteAccountsLookup } from "@/components/admin-clariosuite-accounts-lookup";
import { FormField } from "@/components/ui/form-field";
import { FormInput } from "@/components/ui/form-input";
import { btnSecondaryClass } from "@/components/ui/form";
import { cn } from "@/lib/utils";
import type { ClarioSuiteIgProfile } from "@/types/clariosuite";

export type ClarioSuiteAccountDraft = {
  clariosuite_ig_user_id: string;
  account_label: string;
  is_primary: boolean;
};

type Props = {
  modelId: string;
  initialAccounts?: ClarioSuiteAccountDraft[];
  onChange?: (accounts: ClarioSuiteAccountDraft[]) => void;
};

function emptyRow(): ClarioSuiteAccountDraft {
  return { clariosuite_ig_user_id: "", account_label: "", is_primary: false };
}

export function ClarioSuiteAccountsEditor({
  modelId,
  initialAccounts = [],
  onChange,
}: Props) {
  const [accounts, setAccounts] = React.useState<ClarioSuiteAccountDraft[]>(
    initialAccounts.length ? initialAccounts : [emptyRow()]
  );
  const [showLookup, setShowLookup] = React.useState(false);

  React.useEffect(() => {
    if (initialAccounts.length) setAccounts(initialAccounts);
  }, [initialAccounts]);

  function emit(next: ClarioSuiteAccountDraft[]) {
    setAccounts(next);
    onChange?.(next);
  }

  function updateRow(idx: number, patch: Partial<ClarioSuiteAccountDraft>) {
    const next = accounts.map((a, i) => (i === idx ? { ...a, ...patch } : a));
    emit(next);
  }

  function removeRow(idx: number) {
    const next = accounts.filter((_, i) => i !== idx);
    emit(next.length ? next : [emptyRow()]);
  }

  function addRow() {
    emit([...accounts, emptyRow()]);
  }

  function setPrimary(idx: number) {
    emit(accounts.map((a, i) => ({ ...a, is_primary: i === idx })));
  }

  function linkFromLookup(profile: ClarioSuiteIgProfile, asPrimary: boolean) {
    const exists = accounts.some((a) => a.clariosuite_ig_user_id === profile.igUserId);
    if (exists) return;
    const label = profile.username ? `@${profile.username}` : "Account";
    let next = accounts.filter((a) => a.clariosuite_ig_user_id.trim() || a.account_label.trim());
    if (!next.length) next = [];
    const row: ClarioSuiteAccountDraft = {
      clariosuite_ig_user_id: profile.igUserId,
      account_label: label,
      is_primary: asPrimary || !next.some((a) => a.is_primary),
    };
    if (asPrimary) {
      next = next.map((a) => ({ ...a, is_primary: false }));
    }
    emit([...next, row]);
    setShowLookup(false);
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {accounts.map((row, idx) => (
          <div
            key={`${idx}-${row.clariosuite_ig_user_id}`}
            className={cn(
              "rounded-xl border p-3",
              row.is_primary ? "border-[#D4AF8C]/40 bg-[#D4AF8C]/5" : "border-white/10 bg-black/20"
            )}
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setPrimary(idx)}
                className={cn(
                  "inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                  row.is_primary
                    ? "bg-[#D4AF8C]/20 text-[#D4AF8C]"
                    : "border border-white/10 text-white/40 hover:text-white/70"
                )}
              >
                <Star className={cn("h-3 w-3", row.is_primary && "fill-current")} />
                {row.is_primary ? "Primary" : "Set primary"}
              </button>
              {accounts.length > 1 || row.clariosuite_ig_user_id ? (
                <button
                  type="button"
                  onClick={() => removeRow(idx)}
                  className="rounded-lg p-1.5 text-white/40 hover:bg-red-500/10 hover:text-red-300"
                  aria-label="Remove account"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label="Label" icon={<Hash />} htmlFor={`ig_label_${idx}`}>
                <FormInput
                  id={`ig_label_${idx}`}
                  value={row.account_label}
                  onChange={(e) => updateRow(idx, { account_label: e.target.value })}
                  placeholder='e.g. Main, Backup, "Reels only"'
                />
              </FormField>
              <FormField label="IG user ID" icon={<Hash />} htmlFor={`ig_id_${idx}`}>
                <FormInput
                  id={`ig_id_${idx}`}
                  value={row.clariosuite_ig_user_id}
                  onChange={(e) => updateRow(idx, { clariosuite_ig_user_id: e.target.value })}
                  placeholder="17841400000000000"
                  inputMode="numeric"
                  autoComplete="off"
                />
              </FormField>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={addRow} className={btnSecondaryClass}>
          <Plus className="mr-1.5 inline h-3.5 w-3.5" />
          Add account
        </button>
        <button
          type="button"
          onClick={() => setShowLookup((v) => !v)}
          className={btnSecondaryClass}
        >
          {showLookup ? "Hide lookup" : "Lookup from ClarioSuite"}
        </button>
      </div>

      {showLookup ? (
        <AdminClarioSuiteAccountsLookup
          linkMode
          onLinkPrimary={(p) => linkFromLookup(p, true)}
          onLinkSecondary={(p) => linkFromLookup(p, false)}
        />
      ) : null}

      <input type="hidden" name="clariosuite_accounts_model_id" value={modelId} readOnly />
    </div>
  );
}

export function draftAccountsForSave(rows: ClarioSuiteAccountDraft[]): ClarioSuiteAccountDraft[] {
  return rows.filter((a) => a.clariosuite_ig_user_id.trim());
}
