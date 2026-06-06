"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { GlassModal } from "@/components/ui/glass-modal";
import { ButtonSecondary } from "@/components/ui/form";
import { FormSelect } from "@/components/ui/form-select";
import { FormSubmitButton } from "@/components/ui/form-submit-button";
import { formatDateTimeEuropean } from "@/lib/format";
import { cn } from "@/lib/utils";
import type {
  BillingCycleRecord,
  BillingClientRecord,
  PaymentSubmissionRecord,
} from "@/services/client-billing";

type Props = {
  allSubmissions: PaymentSubmissionRecord[];
  clients: BillingClientRecord[];
  billingCycles: BillingCycleRecord[];
};

type StatusFilter = "all" | "pending_review" | "approved" | "rejected";
type TypeFilter = "all" | "chatting_weekly" | "crm_monthly";

const badgeVariants = {
  default: "bg-white/10 text-white/80 border-white/15",
  emerald: "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
  amber: "bg-amber-500/15 text-amber-300 border-amber-500/25",
  pink: "bg-[hsl(330,80%,55%)]/15 text-[hsl(330,90%,75%)] border-[hsl(330,80%,55%)]/25",
  slate: "bg-white/5 text-white/60 border-white/10",
  yellow: "bg-yellow-500/15 text-yellow-300 border-yellow-500/25",
  rose: "bg-rose-500/15 text-rose-300 border-rose-500/25",
  blue: "bg-blue-500/15 text-blue-300 border-blue-500/25",
  purple: "bg-purple-500/15 text-purple-300 border-purple-500/25",
} as const;

function Badge({
  children,
  variant = "default",
}: {
  children: React.ReactNode;
  variant?: keyof typeof badgeVariants;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium capitalize",
        badgeVariants[variant]
      )}
    >
      {children}
    </span>
  );
}

export function AdminSubmissionsClient({ allSubmissions, clients, billingCycles }: Props) {
  const router = useRouter();
  const [submissions, setSubmissions] = React.useState(allSubmissions);
  const [filter, setFilter] = React.useState<StatusFilter>("pending_review");
  const [typeFilter, setTypeFilter] = React.useState<TypeFilter>("all");
  const [clientFilter, setClientFilter] = React.useState("all");
  const [dateFrom, setDateFrom] = React.useState("");
  const [dateTo, setDateTo] = React.useState("");
  const [selectedSubmission, setSelectedSubmission] = React.useState<PaymentSubmissionRecord | null>(
    null
  );
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [adminNote, setAdminNote] = React.useState("");

  React.useEffect(() => {
    setSubmissions(allSubmissions);
  }, [allSubmissions]);

  const activeAttachment = React.useMemo(() => {
    if (!selectedSubmission) return null;
    const attachment = selectedSubmission.proof_attachment?.[0];
    if (!attachment?.url) return null;
    return {
      url: attachment.url,
      filename: attachment.filename || "proof file",
      type: "",
    };
  }, [selectedSubmission]);

  const isActiveAttachmentImage = React.useMemo(() => {
    if (!activeAttachment?.url) return false;
    return /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(activeAttachment.url);
  }, [activeAttachment]);

  const cycleKindById = React.useMemo(() => {
    const map = new Map<string, BillingCycleRecord["kind"]>();
    for (const c of billingCycles) map.set(c.id, c.kind);
    return map;
  }, [billingCycles]);

  const getClientName = (clientId?: string) => {
    if (!clientId) return "Unknown";
    const client = clients.find((c) => c.id === clientId);
    return client?.display_name || client?.company_name || "Unknown";
  };

  const getBillingCycleKind = (billingCycleId?: string) => {
    if (!billingCycleId) return null;
    return cycleKindById.get(billingCycleId) ?? null;
  };

  const formatKind = (kind: string | null) => {
    if (!kind) return "-";
    return kind === "chatting_weekly" ? "Chatting" : kind === "crm_monthly" ? "CRM" : kind;
  };

  const filteredSubmissions = React.useMemo(() => {
    let filtered = submissions;
    if (filter !== "all") filtered = filtered.filter((s) => s.status === filter);
    if (typeFilter !== "all") {
      filtered = filtered.filter((s) => getBillingCycleKind(s.billing_cycle[0]) === typeFilter);
    }
    if (clientFilter !== "all") {
      filtered = filtered.filter((s) => s.client[0] === clientFilter);
    }
    if (dateFrom) {
      const fromDate = new Date(dateFrom);
      fromDate.setHours(0, 0, 0, 0);
      filtered = filtered.filter((s) => new Date(s.submitted_datetime) >= fromDate);
    }
    if (dateTo) {
      const toDate = new Date(dateTo);
      toDate.setHours(23, 59, 59, 999);
      filtered = filtered.filter((s) => new Date(s.submitted_datetime) <= toDate);
    }
    return filtered;
  }, [submissions, filter, typeFilter, clientFilter, dateFrom, dateTo, cycleKindById]);

  const hasActiveFilters =
    typeFilter !== "all" || clientFilter !== "all" || Boolean(dateFrom) || Boolean(dateTo);

  async function handleReview(submissionId: string, status: "approved" | "rejected") {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/submissions/${submissionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, admin_note: adminNote || undefined }),
      });
      const data = (await res.json()) as {
        error?: string;
        submission?: PaymentSubmissionRecord;
      };
      if (!res.ok) {
        setError(data.error ?? "Failed to update submission");
        return;
      }
      if (data.submission) {
        setSubmissions((prev) =>
          prev.map((s) => (s.id === submissionId ? data.submission! : s))
        );
      }
      setSelectedSubmission(null);
      setAdminNote("");
      router.refresh();
    } catch {
      setError("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  }

  async function openSubmission(submissionId: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/submissions/${submissionId}`);
      const data = (await res.json()) as { submission?: PaymentSubmissionRecord; error?: string };
      if (!res.ok || !data.submission) {
        setError(data.error ?? "Failed to load submission");
        return;
      }
      setSelectedSubmission(data.submission);
      setAdminNote(data.submission.admin_note ?? "");
    } catch {
      setError("Network error loading submission");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] p-6 backdrop-blur-xl shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
        {error ? (
          <div className="mb-5 rounded-xl border border-red-500/30 bg-red-500/20 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        ) : null}

        <div className="mb-6 flex flex-wrap gap-2">
          {(
            [
              ["pending_review", "Pending Review", "yellow"],
              ["approved", "Approved", "emerald"],
              ["rejected", "Rejected", "rose"],
              ["all", "All History", "pink"],
            ] as const
          ).map(([key, label, variant]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={cn(
                "rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-wide transition-all",
                filter === key
                  ? badgeVariants[variant]
                  : "border-white/10 bg-white/5 text-gray-400 hover:border-pink-500/30 hover:text-gray-200"
              )}
            >
              {label} (
              {key === "all"
                ? submissions.length
                : submissions.filter((s) => s.status === key).length}
              )
            </button>
          ))}
        </div>

        <div className="mb-5 flex flex-wrap gap-4 rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="min-w-[140px] flex-1">
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-400">
              Type
            </label>
            <FormSelect value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}>
              <option value="all">All types</option>
              <option value="chatting_weekly">Chatting</option>
              <option value="crm_monthly">CRM</option>
            </FormSelect>
          </div>
          <div className="min-w-[140px] flex-1">
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-400">
              Client
            </label>
            <FormSelect value={clientFilter} onChange={(e) => setClientFilter(e.target.value)}>
              <option value="all">All clients</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.display_name || client.company_name}
                </option>
              ))}
            </FormSelect>
          </div>
          <div className="min-w-[140px] flex-1">
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-400">
              From
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-[#141414] px-4 py-2.5 text-white focus:border-pink-500/50 focus:outline-none focus:ring-1 focus:ring-pink-500/20"
            />
          </div>
          <div className="min-w-[140px] flex-1">
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-400">
              To
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              min={dateFrom || undefined}
              className="w-full rounded-xl border border-white/10 bg-[#141414] px-4 py-2.5 text-white focus:border-pink-500/50 focus:outline-none focus:ring-1 focus:ring-pink-500/20"
            />
          </div>
          {hasActiveFilters ? (
            <div className="flex items-end">
              <ButtonSecondary
                type="button"
                onClick={() => {
                  setTypeFilter("all");
                  setClientFilter("all");
                  setDateFrom("");
                  setDateTo("");
                }}
              >
                Clear filters
              </ButtonSecondary>
            </div>
          ) : null}
        </div>

        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-white">Submissions</h2>
          <p className="text-sm text-gray-400">
            Showing {filteredSubmissions.length} of {submissions.length}
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-white/10 bg-white/5">
              <tr className="text-left text-xs uppercase tracking-wide text-gray-400">
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Submitted</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {filteredSubmissions.map((submission) => {
                const kind = getBillingCycleKind(submission.billing_cycle[0]);
                return (
                  <tr key={submission.id} className="hover:bg-white/[0.04]">
                    <td className="px-4 py-3 text-sm font-medium text-white">
                      {getClientName(submission.client[0])}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={kind === "chatting_weekly" ? "blue" : kind === "crm_monthly" ? "purple" : "slate"}>
                        {formatKind(kind)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-white">
                      {submission.submitted_amount} {submission.submitted_currency}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-400">
                      {formatDateTimeEuropean(submission.submitted_datetime)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant={
                          submission.status === "approved"
                            ? "emerald"
                            : submission.status === "rejected"
                              ? "rose"
                              : "yellow"
                        }
                      >
                        {submission.status.replace("_", "")}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => void openSubmission(submission.id)}
                        className="rounded-full border border-pink-500/30 bg-pink-500/10 px-3 py-1.5 text-xs font-semibold text-pink-300 hover:bg-pink-500/20"
                      >
                        {submission.status === "pending_review" ? "Review" : "View"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {selectedSubmission ? (
        <GlassModal title="Review submission" subtitle="Approve or reject payment proof" onClose={() => setSelectedSubmission(null)}>
          <div className="space-y-4 p-4 md:p-5">
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-400">Amount</p>
              <p className="text-lg font-semibold text-white">
                {selectedSubmission.submitted_amount} {selectedSubmission.submitted_currency}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-400">Client</p>
              <p className="text-white">{getClientName(selectedSubmission.client[0])}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-400">Submitted</p>
              <p className="text-white">{formatDateTimeEuropean(selectedSubmission.submitted_datetime)}</p>
            </div>
            {selectedSubmission.note ? (
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-400">Client note</p>
                <p className="text-gray-300">{selectedSubmission.note}</p>
              </div>
            ) : null}
            {activeAttachment ? (
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-400">Proof</p>
                <a
                  href={activeAttachment.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-pink-300 underline hover:text-pink-200"
                >
                  {activeAttachment.filename}
                </a>
                {isActiveAttachmentImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={activeAttachment.url}
                    alt={activeAttachment.filename}
                    className="mt-2 max-h-48 rounded-lg border border-white/10 object-contain"
                  />
                ) : null}
              </div>
            ) : null}
            <div>
              <label className="mb-2 block text-sm text-white/70">Admin note</label>
              <textarea
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
                rows={3}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white placeholder:text-white/40 focus:border-pink-500/40 focus:outline-none"
                placeholder="Add admin note…"
              />
            </div>
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <ButtonSecondary type="button" onClick={() => setSelectedSubmission(null)}>
                Close
              </ButtonSecondary>
              {selectedSubmission.status === "pending_review" ? (
                <>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => void handleReview(selectedSubmission.id, "rejected")}
                    className="rounded-xl border border-red-500/30 bg-red-500/20 px-4 py-2 text-sm font-semibold text-red-300 hover:bg-red-500/30 disabled:opacity-50"
                  >
                    Reject
                  </button>
                  <FormSubmitButton
                    type="button"
                    loading={loading}
                    disabled={loading}
                    onClick={() => void handleReview(selectedSubmission.id, "approved")}
                  >
                    Approve
                  </FormSubmitButton>
                </>
              ) : null}
            </div>
          </div>
        </GlassModal>
      ) : null}
    </>
  );
}
