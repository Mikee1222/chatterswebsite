"use client";

import { ExternalLink, FileText } from "lucide-react";
import { MobileCard } from "@/components/mobile-card";
import { formatDateYmd, formatDateTime } from "@/lib/format-date";
import type { BillingCycleKind, EnrichedInvoice } from "@/types/client-portal";

type Props = {
  invoices: EnrichedInvoice[];
};

function kindLabel(kind: BillingCycleKind): string {
  return kind === "chatting_weekly" ? "Chatting Weekly" : "CRM Monthly";
}

function getInvoiceUrl(invoice: EnrichedInvoice): string | null {
  if (invoice.attachment?.[0]?.url) return invoice.attachment[0].url;
  return null;
}

export function ClientInvoicesClient({ invoices }: Props) {
  if (invoices.length === 0) {
    return (
      <div className="glass-card rounded-2xl p-10 text-center">
        <FileText className="mx-auto mb-3 h-10 w-10 text-white/25" />
        <p className="font-medium text-white">No invoices yet</p>
        <p className="mt-1 text-sm text-white/50">Invoices will appear here once sent.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-20 md:pb-0">
      <div className="hidden md:block glass-card overflow-hidden rounded-2xl">
        <table className="w-full text-sm">
          <thead className="border-b border-white/10 bg-white/[0.04]">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-white/45">Invoice</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-white/45">Billing cycle</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-white/45">Sent</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-white/45">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {invoices.map((invoice) => {
              const url = getInvoiceUrl(invoice);
              const cycle = invoice.billingCycleInfo;
              return (
                <tr key={invoice.id} className="hover:bg-white/[0.03]">
                  <td className="px-4 py-3 font-medium text-white">
                    {invoice.invoice_number ?? `Invoice ${invoice.id.slice(0, 8)}`}
                  </td>
                  <td className="px-4 py-3 text-white/70">
                    {cycle
                      ? `${kindLabel(cycle.kind)} (${formatDateYmd(cycle.period_start)} – ${formatDateYmd(cycle.period_end)})`
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-white/60">{formatDateTime(invoice.sent_at)}</td>
                  <td className="px-4 py-3 text-right">
                    {url ? (
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-sm font-medium text-pink-400 hover:text-pink-300"
                      >
                        View <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    ) : (
                      <span className="text-white/30">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 md:hidden">
        {invoices.map((invoice) => {
          const url = getInvoiceUrl(invoice);
          const cycle = invoice.billingCycleInfo;
          return (
            <MobileCard
              key={invoice.id}
              className="glass-card border-white/10 bg-white/[0.04] !rounded-2xl"
              padding="md"
            >
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-pink-400" />
                <span className="font-medium text-white">
                  {invoice.invoice_number ?? `Invoice ${invoice.id.slice(0, 8)}`}
                </span>
              </div>
              <p className="mt-2 text-sm text-white/55">
                {cycle
                  ? `${kindLabel(cycle.kind)} · ${formatDateYmd(cycle.period_start)} – ${formatDateYmd(cycle.period_end)}`
                  : "Billing cycle N/A"}
              </p>
              <p className="mt-1 text-xs text-white/40">{formatDateTime(invoice.sent_at)}</p>
              {url && (
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-pink-500 to-purple-600 px-4 py-2.5 text-sm font-semibold text-white"
                >
                  View invoice <ExternalLink className="h-4 w-4" />
                </a>
              )}
            </MobileCard>
          );
        })}
      </div>
    </div>
  );
}
