"use client";

import { useState } from "react";
import { ExternalLink, Copy, Check } from "lucide-react";
import type { PaymentMethodRecord } from "@/types/client-portal";

type Props = {
  method: PaymentMethodRecord;
};

export function ClientPaymentMethodCard({ method }: Props) {
  const [toast, setToast] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 2500);
  };

  const handleCopy = async (text: string, field: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      showToast(`${label} copied`);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      showToast("Failed to copy");
    }
  };

  const hasPaymentDetails = method.iban || method.beneficiary || method.bic || method.wallet_address;
  const isZen = method.type.toLowerCase() === "zen" || method.label.toLowerCase() === "zen";
  const showOpenInApp = !!method.open_url && !isZen;

  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.04] p-3 transition-colors hover:border-violet-400/25">
      <div className="mb-1 flex items-center gap-2">
        <div className="h-2 w-2 rounded-full bg-gradient-to-r from-violet-400 to-purple-500" />
        <strong className="font-semibold text-violet-200">{method.label}</strong>
        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-gray-400">
          {method.type}
        </span>
      </div>
      <p className="text-sm leading-relaxed text-gray-300">{method.details}</p>
      {method.network && <p className="mt-1 text-xs text-gray-500">Network: {method.network}</p>}

      {hasPaymentDetails && (
        <div className="mt-3 space-y-2 border-t border-white/10 pt-3">
          {method.beneficiary && (
            <CopyRow
              label="Beneficiary"
              value={method.beneficiary}
              field="beneficiary"
              copiedField={copiedField}
              onCopy={handleCopy}
            />
          )}
          {method.iban && (
            <CopyRow
              label="IBAN"
              value={method.iban}
              field="iban"
              copiedField={copiedField}
              onCopy={handleCopy}
              mono
            />
          )}
          {method.bic && (
            <CopyRow
              label="BIC"
              value={method.bic}
              field="bic"
              copiedField={copiedField}
              onCopy={handleCopy}
              mono
            />
          )}
          {method.wallet_address && (
            <CopyRow
              label="Wallet"
              value={method.wallet_address}
              field="wallet"
              copiedField={copiedField}
              onCopy={handleCopy}
              mono
            />
          )}
        </div>
      )}

      {showOpenInApp && (
        <button
          type="button"
          onClick={() => {
            const url = method.open_url!;
            window.open(url, "_blank", "noopener,noreferrer");
          }}
          className="mt-3 inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-violet-600 to-purple-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-violet-900/30"
        >
          <ExternalLink className="h-4 w-4" />
          Open in App
        </button>
      )}

      {toast && (
        <div className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full border border-violet-400/30 bg-[#1a1228] px-4 py-2 text-sm text-white shadow-xl md:bottom-8">
          {toast}
        </div>
      )}
    </div>
  );
}

function CopyRow({
  label,
  value,
  field,
  copiedField,
  onCopy,
  mono,
}: {
  label: string;
  value: string;
  field: string;
  copiedField: string | null;
  onCopy: (text: string, field: string, label: string) => void;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-gray-400">{label}:</span>
      <div className="flex items-center gap-2">
        <span className={`text-xs text-gray-200 ${mono ? "font-mono" : ""}`}>{value}</span>
        <button
          type="button"
          onClick={() => onCopy(value, field, label)}
          className="rounded p-1 text-gray-400 hover:text-violet-300"
          aria-label={`Copy ${label}`}
        >
          {copiedField === field ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
      </div>
    </div>
  );
}
