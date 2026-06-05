"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Building2,
  Calendar,
  Check,
  ChevronRight,
  CreditCard,
  ExternalLink,
  Plus,
  Search,
  Users,
  X,
} from "lucide-react";
import { GlassModal } from "@/components/ui/glass-modal";
import { ButtonSecondary, Label } from "@/components/ui/form";
import { FormInput } from "@/components/ui/form-input";
import { FormSelect } from "@/components/ui/form-select";
import { FormSubmitButton } from "@/components/ui/form-submit-button";
import { getCycleAmountDue } from "@/lib/client-portal-utils";
import { formatDateEuropean } from "@/lib/format";
import { cn } from "@/lib/utils";
import type {
  AdminClientRecord,
  BillingCycleKind,
  BillingCycleRecord,
  BillingCycleStatus,
  ClientModelRecord,
  ClientTeamRole,
  ClientUserType,
  PaymentSubmissionRecord,
} from "@/types/client-portal";

type Props = {
  clients: AdminClientRecord[];
};

type ClientDetail = {
  models: ClientModelRecord[];
  billingCycles: BillingCycleRecord[];
  submissions: PaymentSubmissionRecord[];
};

const badgeVariants = {
  default: "bg-white/10 text-white/80 border-white/15",
  emerald: "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
  amber: "bg-amber-500/15 text-amber-300 border-amber-500/25",
  pink: "bg-[hsl(330,80%,55%)]/15 text-[hsl(330,90%,75%)] border-[hsl(330,80%,55%)]/25",
  slate: "bg-white/5 text-white/60 border-white/10",
  yellow: "bg-yellow-500/15 text-yellow-300 border-yellow-500/25",
  rose: "bg-rose-500/15 text-rose-300 border-rose-500/25",
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

function clientStatusVariant(status: AdminClientRecord["status"]): keyof typeof badgeVariants {
  if (status === "active") return "emerald";
  if (status === "suspended") return "amber";
  return "slate";
}

function cycleStatusVariant(status: BillingCycleStatus): keyof typeof badgeVariants {
  if (status === "confirmed_paid") return "emerald";
  if (status === "overdue") return "rose";
  if (status === "pending_review") return "yellow";
  if (status === "announced") return "pink";
  return "slate";
}

function formatKind(kind: BillingCycleKind): string {
  return kind === "crm_monthly" ? "CRM monthly" : "Chatting weekly";
}

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
      minimumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

function PortalAccessSwitch({
  checked,
  disabled,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        if (!disabled) onChange(!checked);
      }}
      className={cn(
        "relative h-7 w-12 shrink-0 rounded-full border-2 transition-colors duration-200",
        disabled && "cursor-not-allowed opacity-50",
        checked
          ? "border-pink-300/45 bg-gradient-to-r from-pink-500 to-fuchsia-600"
          : "border-white/18 bg-[#262626]"
      )}
    >
      <span
        className={cn(
          "absolute top-[3px] h-4 w-4 rounded-full bg-white shadow transition-transform duration-200",
          checked ? "translate-x-[22px]" : "translate-x-[3px]"
        )}
      />
    </button>
  );
}

function formatFeePercent(clientPercentage: number | undefined): string {
  if (typeof clientPercentage !== "number") return "—";
  return `${(clientPercentage * 100).toFixed(1)}%`;
}

const TEAM_ROLES: ClientTeamRole[] = ["admin", "manager", "chatter", "virtual_assistant"];

function AddClientModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (client: AdminClientRecord) => void;
}) {
  const [userType, setUserType] = React.useState<ClientUserType>("client");
  const [companyName, setCompanyName] = React.useState("");
  const [displayName, setDisplayName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [feePercent, setFeePercent] = React.useState("");
  const [role, setRole] = React.useState<ClientTeamRole>("chatter");
  const [status, setStatus] = React.useState<"active" | "inactive">("active");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!displayName.trim() || !email.trim() || !password) {
      setError("Display name, email, and password are required.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (userType === "client" && !companyName.trim()) {
      setError("Company name is required for clients.");
      return;
    }

    let clientPercentage: number | undefined;
    if (userType === "client" && feePercent.trim()) {
      const parsed = Number(feePercent);
      if (Number.isNaN(parsed) || parsed < 0 || parsed > 100) {
        setError("Fee % must be between 0 and 100.");
        return;
      }
      clientPercentage = parsed / 100;
    }

    setPending(true);
    try {
      const res = await fetch("/api/admin/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_type: userType,
          company_name: userType === "client" ? companyName.trim() : undefined,
          display_name: displayName.trim(),
          email: email.trim(),
          password,
          client_percentage: clientPercentage,
          role: userType === "team_member" ? role : undefined,
          status,
        }),
      });
      const data = (await res.json()) as { client?: AdminClientRecord; error?: string };
      if (!res.ok) {
        setError(data.error ?? "Failed to create user.");
        return;
      }
      if (data.client) onCreated(data.client);
      onClose();
    } catch {
      setError("Network error. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <GlassModal title="Add user" subtitle="Create a client or team member account" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4 p-4 md:p-5">
        <div>
          <Label>User type</Label>
          <div className="mt-2 flex gap-1 rounded-xl border border-white/10 bg-white/5 p-1">
            <button
              type="button"
              onClick={() => setUserType("client")}
              className={cn(
                "flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition",
                userType === "client"
                  ? "bg-pink-500/20 text-pink-300"
                  : "text-white/50 hover:text-white"
              )}
            >
              Client
            </button>
            <button
              type="button"
              onClick={() => setUserType("team_member")}
              className={cn(
                "flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition",
                userType === "team_member"
                  ? "bg-pink-500/20 text-pink-300"
                  : "text-white/50 hover:text-white"
              )}
            >
              Team member
            </button>
          </div>
        </div>

        {userType === "client" ? (
          <div>
            <Label htmlFor="add-company">Company name</Label>
            <FormInput
              id="add-company"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              required
            />
          </div>
        ) : null}

        <div>
          <Label htmlFor="add-display">Display name</Label>
          <FormInput
            id="add-display"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
          />
        </div>

        <div>
          <Label htmlFor="add-email">Email</Label>
          <FormInput
            id="add-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div>
          <Label htmlFor="add-password">Password</Label>
          <FormInput
            id="add-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
          />
        </div>

        {userType === "client" ? (
          <div>
            <Label htmlFor="add-fee">Fee % (0–100)</Label>
            <FormInput
              id="add-fee"
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={feePercent}
              onChange={(e) => setFeePercent(e.target.value)}
              placeholder="e.g. 20"
            />
          </div>
        ) : (
          <div>
            <Label htmlFor="add-role">Role</Label>
            <FormSelect id="add-role" value={role} onChange={(e) => setRole(e.target.value as ClientTeamRole)}>
              {TEAM_ROLES.map((r) => (
                <option key={r} value={r}>
                  {r.replace(/_/g, " ")}
                </option>
              ))}
            </FormSelect>
          </div>
        )}

        <div>
          <Label htmlFor="add-status">Status</Label>
          <FormSelect
            id="add-status"
            value={status}
            onChange={(e) => setStatus(e.target.value as "active" | "inactive")}
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </FormSelect>
        </div>

        {error ? <p className="text-sm text-rose-300">{error}</p> : null}

        <div className="flex gap-3 pt-2">
          <ButtonSecondary type="button" className="flex-1" onClick={onClose}>
            Cancel
          </ButtonSecondary>
          <FormSubmitButton className="flex-1" loading={pending} disabled={pending}>
            Create user
          </FormSubmitButton>
        </div>
      </form>
    </GlassModal>
  );
}

function CreateBillingCycleModal({
  client,
  onClose,
  onCreated,
}: {
  client: AdminClientRecord;
  onClose: () => void;
  onCreated: (cycle: BillingCycleRecord) => void;
}) {
  const [kind, setKind] = React.useState<BillingCycleKind>("chatting_weekly");
  const [periodStart, setPeriodStart] = React.useState("");
  const [periodEnd, setPeriodEnd] = React.useState("");
  const [dueDate, setDueDate] = React.useState("");
  const [amount, setAmount] = React.useState("");
  const [currency, setCurrency] = React.useState("USD");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsedAmount = Number(amount);
    if (!periodStart || !periodEnd || !dueDate || Number.isNaN(parsedAmount)) {
      setError("Fill in all required fields.");
      return;
    }
    setPending(true);
    try {
      const res = await fetch(`/api/admin/clients/${client.id}/billing-cycles`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          period_start: periodStart,
          period_end: periodEnd,
          due_date: dueDate,
          amount: parsedAmount,
          currency,
        }),
      });
      const data = (await res.json()) as { billingCycle?: BillingCycleRecord; error?: string };
      if (!res.ok) {
        setError(data.error ?? "Failed to create billing cycle.");
        return;
      }
      if (data.billingCycle) onCreated(data.billingCycle);
      onClose();
    } catch {
      setError("Network error. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <GlassModal
      title="Create billing cycle"
      subtitle={client.company_name || client.display_name}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="space-y-4 p-4 md:p-5">
        <div>
          <Label htmlFor="bc-kind">Kind</Label>
          <FormSelect
            id="bc-kind"
            value={kind}
            onChange={(e) => setKind(e.target.value as BillingCycleKind)}
          >
            <option value="chatting_weekly">Chatting weekly</option>
            <option value="crm_monthly">CRM monthly</option>
          </FormSelect>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="bc-start">Period start</Label>
            <FormInput
              id="bc-start"
              type="date"
              value={periodStart}
              onChange={(e) => setPeriodStart(e.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="bc-end">Period end</Label>
            <FormInput
              id="bc-end"
              type="date"
              value={periodEnd}
              onChange={(e) => setPeriodEnd(e.target.value)}
              required
            />
          </div>
        </div>
        <div>
          <Label htmlFor="bc-due">Due date</Label>
          <FormInput
            id="bc-due"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            required
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="bc-amount">Amount</Label>
            <FormInput
              id="bc-amount"
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="bc-currency">Currency</Label>
            <FormInput
              id="bc-currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value.toUpperCase())}
              maxLength={8}
              required
            />
          </div>
        </div>
        {error ? <p className="text-sm text-rose-300">{error}</p> : null}
        <div className="flex gap-3 pt-2">
          <ButtonSecondary type="button" className="flex-1" onClick={onClose}>
            Cancel
          </ButtonSecondary>
          <FormSubmitButton className="flex-1" loading={pending} disabled={pending}>
            Create cycle
          </FormSubmitButton>
        </div>
      </form>
    </GlassModal>
  );
}

function ClientDetailSheet({
  client,
  onClose,
  onPortalAccessChange,
}: {
  client: AdminClientRecord;
  onClose: () => void;
  onPortalAccessChange: (clientId: string, portalAccess: boolean) => void;
}) {
  const [detail, setDetail] = React.useState<ClientDetail | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [portalPending, setPortalPending] = React.useState(false);
  const [portalAccess, setPortalAccess] = React.useState(client.portal_access);
  const [showCreateCycle, setShowCreateCycle] = React.useState(false);
  const [reviewingId, setReviewingId] = React.useState<string | null>(null);
  const [adminNote, setAdminNote] = React.useState("");

  const loadDetail = React.useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [detailRes, submissionsRes] = await Promise.all([
        fetch(`/api/admin/clients/${client.id}`),
        fetch(`/api/admin/clients/${client.id}/submissions`),
      ]);
      const detailJson = (await detailRes.json()) as {
        models?: ClientModelRecord[];
        billingCycles?: BillingCycleRecord[];
        error?: string;
      };
      const submissionsJson = (await submissionsRes.json()) as {
        submissions?: PaymentSubmissionRecord[];
        error?: string;
      };
      if (!detailRes.ok || !submissionsRes.ok) {
        setLoadError(detailJson.error ?? submissionsJson.error ?? "Failed to load client details.");
        return;
      }
      setDetail({
        models: detailJson.models ?? [],
        billingCycles: detailJson.billingCycles ?? [],
        submissions: submissionsJson.submissions ?? [],
      });
    } catch {
      setLoadError("Network error loading details.");
    } finally {
      setLoading(false);
    }
  }, [client.id]);

  React.useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  React.useEffect(() => {
    setPortalAccess(client.portal_access);
  }, [client.portal_access]);

  React.useEffect(() => {
    const body = document.body;
    const html = document.documentElement;
    const prevOverflow = body.style.overflow;
    const prevPaddingRight = body.style.paddingRight;
    body.style.overflow = "hidden";
    const scrollbarGap = Math.max(0, window.innerWidth - html.clientWidth);
    if (scrollbarGap > 0) body.style.paddingRight = `${scrollbarGap}px`;
    return () => {
      body.style.overflow = prevOverflow;
      body.style.paddingRight = prevPaddingRight;
    };
  }, []);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function handlePortalToggle(next: boolean) {
    setPortalPending(true);
    try {
      const res = await fetch(`/api/admin/clients/${client.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ portal_access: next }),
      });
      const data = (await res.json()) as { client?: AdminClientRecord; error?: string };
      if (!res.ok) return;
      if (data.client) {
        setPortalAccess(data.client.portal_access);
        onPortalAccessChange(client.id, data.client.portal_access);
      }
    } finally {
      setPortalPending(false);
    }
  }

  async function handleSubmissionReview(
    submissionId: string,
    status: "approved" | "rejected"
  ) {
    setReviewingId(submissionId);
    try {
      const res = await fetch(`/api/admin/submissions/${submissionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          admin_note: adminNote.trim() || undefined,
        }),
      });
      if (res.ok) {
        setAdminNote("");
        await loadDetail();
      }
    } finally {
      setReviewingId(null);
    }
  }

  return (
    <>
      <motion.div
        layout={false}
        className="fixed inset-0 z-[70] flex justify-end"
        initial={{ opacity: 0, pointerEvents: "none" }}
        animate={{ opacity: 1, pointerEvents: "auto" }}
        exit={{
          opacity: 0,
          pointerEvents: "none",
          transition: { opacity: { duration: 0.15 }, pointerEvents: { duration: 0 } },
        }}
        transition={{ duration: 0.15 }}
      >
        <button
          type="button"
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          aria-label="Close"
          onClick={onClose}
        />
        <motion.aside
          layout={false}
          className="relative z-[1] flex h-full w-full max-w-lg flex-col border-l border-white/10 bg-black/95 shadow-2xl"
          initial={{ x: 48 }}
          animate={{ x: 0 }}
          exit={{ x: 48 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
        >
          <div className="border-b border-white/10 px-5 py-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-white">
                  {client.company_name || client.display_name || "Client"}
                </h2>
                {client.display_name && client.company_name ? (
                  <p className="mt-0.5 text-sm text-white/55">{client.display_name}</p>
                ) : null}
                <p className="mt-1 text-sm text-white/45">{client.email || "—"}</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-white/10 p-2 text-white/60 hover:bg-white/5 hover:text-white"
                aria-label="Close panel"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Badge variant={clientStatusVariant(client.status)}>{client.status}</Badge>
              <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1">
                <span className="text-xs text-white/50">Portal</span>
                <PortalAccessSwitch
                  checked={portalAccess}
                  disabled={portalPending}
                  onChange={handlePortalToggle}
                />
              </div>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            {loading ? (
              <p className="text-sm text-white/50">Loading…</p>
            ) : loadError ? (
              <p className="text-sm text-rose-300">{loadError}</p>
            ) : detail ? (
              <div className="space-y-6">
                <section>
                  <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-white/40">
                    <Building2 className="h-3.5 w-3.5" />
                    Client info
                  </div>
                  <div className="space-y-2 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm">
                    <div className="flex justify-between gap-4">
                      <span className="text-white/45">Company</span>
                      <span className="text-right text-white">{client.company_name || "—"}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-white/45">Display name</span>
                      <span className="text-right text-white">{client.display_name || "—"}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-white/45">Email</span>
                      <span className="text-right text-white">{client.email || "—"}</span>
                    </div>
                    {typeof client.client_percentage === "number" ? (
                      <div className="flex justify-between gap-4">
                        <span className="text-white/45">Client %</span>
                        <span className="text-right text-white">
                          {(client.client_percentage * 100).toFixed(1)}%
                        </span>
                      </div>
                    ) : null}
                  </div>
                </section>

                <section>
                  <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-white/40">
                    <Users className="h-3.5 w-3.5" />
                    Models ({detail.models.length})
                  </div>
                  {detail.models.length === 0 ? (
                    <p className="text-sm text-white/45">No models assigned.</p>
                  ) : (
                    <ul className="space-y-2">
                      {detail.models.map((row) => (
                        <li
                          key={row.id}
                          className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm"
                        >
                          <span className="font-medium text-white">
                            {row.model_name?.trim() || "Unnamed model"}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <section>
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-white/40">
                      <Calendar className="h-3.5 w-3.5" />
                      Recent billing cycles
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowCreateCycle(true)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[hsl(330,80%,55%)]/40 bg-[hsl(330,80%,55%)]/15 px-3 py-1.5 text-xs font-medium text-[hsl(330,90%,75%)] hover:bg-[hsl(330,80%,55%)]/25"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Create cycle
                    </button>
                  </div>
                  {detail.billingCycles.length === 0 ? (
                    <p className="text-sm text-white/45">No billing cycles yet.</p>
                  ) : (
                    <ul className="space-y-2">
                      {detail.billingCycles.map((cycle) => (
                        <li
                          key={cycle.id}
                          className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="font-medium text-white">{formatKind(cycle.kind)}</p>
                              <p className="mt-0.5 text-xs text-white/45">
                                {formatDateEuropean(cycle.period_start)} –{" "}
                                {formatDateEuropean(cycle.period_end)}
                              </p>
                              <p className="mt-1 text-xs text-white/40">
                                Due {formatDateEuropean(cycle.due_date)}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-medium text-white">
                                {formatMoney(getCycleAmountDue(cycle), cycle.currency)}
                              </p>
                              <div className="mt-1">
                                <Badge variant={cycleStatusVariant(cycle.status)}>
                                  {cycle.status.replace(/_/g, " ")}
                                </Badge>
                              </div>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <section>
                  <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-white/40">
                    <CreditCard className="h-3.5 w-3.5" />
                    Pending submissions ({detail.submissions.length})
                  </div>
                  {detail.submissions.length === 0 ? (
                    <p className="text-sm text-white/45">No payments awaiting review.</p>
                  ) : (
                    <ul className="space-y-3">
                      {detail.submissions.map((sub) => (
                        <li
                          key={sub.id}
                          className="rounded-xl border border-yellow-500/20 bg-yellow-500/[0.06] p-4 text-sm"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="font-medium text-white">
                                {formatMoney(sub.submitted_amount, sub.submitted_currency)}
                              </p>
                              <p className="mt-0.5 text-xs text-white/45">
                                {formatDateEuropean(sub.submitted_datetime)}
                              </p>
                              {sub.reference_id ? (
                                <p className="mt-1 text-xs text-white/40">Ref: {sub.reference_id}</p>
                              ) : null}
                              {sub.note ? (
                                <p className="mt-2 text-xs text-white/55">{sub.note}</p>
                              ) : null}
                            </div>
                            {sub.proof_url ? (
                              <a
                                href={sub.proof_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-[hsl(330,90%,75%)] hover:underline"
                                onClick={(e) => e.stopPropagation()}
                              >
                                Proof
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            ) : null}
                          </div>
                          <div className="mt-3">
                            <FormInput
                              placeholder="Admin note (optional)"
                              value={reviewingId === sub.id ? adminNote : ""}
                              onChange={(e) => {
                                setReviewingId(sub.id);
                                setAdminNote(e.target.value);
                              }}
                              onFocus={() => setReviewingId(sub.id)}
                            />
                          </div>
                          <div className="mt-3 flex gap-2">
                            <button
                              type="button"
                              disabled={reviewingId !== null}
                              onClick={() => void handleSubmissionReview(sub.id, "approved")}
                              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/15 px-3 py-2 text-xs font-medium text-emerald-300 hover:bg-emerald-500/25 disabled:opacity-50"
                            >
                              <Check className="h-3.5 w-3.5" />
                              Approve
                            </button>
                            <button
                              type="button"
                              disabled={reviewingId !== null}
                              onClick={() => void handleSubmissionReview(sub.id, "rejected")}
                              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/15 px-3 py-2 text-xs font-medium text-rose-300 hover:bg-rose-500/25 disabled:opacity-50"
                            >
                              <X className="h-3.5 w-3.5" />
                              Reject
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </div>
            ) : null}
          </div>

          <div className="border-t border-white/10 p-4">
            <ButtonSecondary type="button" className="w-full" onClick={onClose}>
              Close
            </ButtonSecondary>
          </div>
        </motion.aside>
      </motion.div>

      <AnimatePresence>
        {showCreateCycle ? (
          <CreateBillingCycleModal
            client={client}
            onClose={() => setShowCreateCycle(false)}
            onCreated={(cycle) => {
              setDetail((prev) =>
                prev
                  ? {
                      ...prev,
                      billingCycles: [cycle, ...prev.billingCycles].slice(0, 5),
                    }
                  : prev
              );
            }}
          />
        ) : null}
      </AnimatePresence>
    </>
  );
}

export function AdminClientsClient({ clients: initialClients }: Props) {
  const [clients, setClients] = React.useState(initialClients);
  const [tab, setTab] = React.useState<"clients" | "team_members">("clients");
  const [search, setSearch] = React.useState("");
  const [selectedClient, setSelectedClient] = React.useState<AdminClientRecord | null>(null);
  const [portalPendingId, setPortalPendingId] = React.useState<string | null>(null);
  const [showAddClient, setShowAddClient] = React.useState(false);

  React.useEffect(() => {
    setClients(initialClients);
  }, [initialClients]);

  const tabFiltered = React.useMemo(() => {
    return clients.filter((c) =>
      tab === "team_members" ? c.user_type === "team_member" : c.user_type !== "team_member"
    );
  }, [clients, tab]);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tabFiltered;
    return tabFiltered.filter(
      (c) =>
        c.company_name.toLowerCase().includes(q) ||
        c.display_name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q)
    );
  }, [tabFiltered, search]);

  function handlePortalAccessChange(clientId: string, portalAccess: boolean) {
    setClients((prev) =>
      prev.map((c) => (c.id === clientId ? { ...c, portal_access: portalAccess } : c))
    );
    setSelectedClient((prev) =>
      prev?.id === clientId ? { ...prev, portal_access: portalAccess } : prev
    );
  }

  async function handleListPortalToggle(client: AdminClientRecord, next: boolean) {
    setPortalPendingId(client.id);
    try {
      const res = await fetch(`/api/admin/clients/${client.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ portal_access: next }),
      });
      const data = (await res.json()) as { client?: AdminClientRecord };
      if (res.ok && data.client) {
        handlePortalAccessChange(client.id, data.client.portal_access);
      }
    } finally {
      setPortalPendingId(null);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 md:px-6 md:py-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">Users</h1>
          <p className="mt-1 text-sm text-white/55">Manage clients and internal team members</p>
        </div>
        <button
          type="button"
          onClick={() => setShowAddClient(true)}
          className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-pink-400/40 bg-gradient-to-r from-pink-500 to-fuchsia-600 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_0_24px_-8px_hsl(330_80%_55%/0.45)] transition hover:brightness-110"
        >
          <Plus className="h-4 w-4" />
          Add user
        </button>
      </div>

      <div className="flex gap-1 rounded-xl border border-white/10 bg-white/5 p-1 w-fit">
        <button
          type="button"
          onClick={() => setTab("clients")}
          className={
            tab === "clients"
              ? "rounded-lg bg-pink-500/20 px-4 py-1.5 text-sm font-medium text-pink-300"
              : "px-4 py-1.5 text-sm text-white/50 hover:text-white"
          }
        >
          Clients
        </button>
        <button
          type="button"
          onClick={() => setTab("team_members")}
          className={
            tab === "team_members"
              ? "rounded-lg bg-pink-500/20 px-4 py-1.5 text-sm font-medium text-pink-300"
              : "px-4 py-1.5 text-sm text-white/50 hover:text-white"
          }
        >
          Team members
        </button>
      </div>

      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
        <FormInput
          className="pl-10"
          placeholder="Search company, name, or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div
        className="overflow-hidden rounded-2xl border border-white/10 bg-black/40 backdrop-blur-xl"
        style={{
          boxShadow:
            "0 0 0 1px rgba(255,255,255,0.06), 0 0 48px -12px hsl(330 80% 55% / 0.1)",
        }}
      >
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.03] text-xs uppercase tracking-wider text-white/40">
                <th className="px-4 py-3 font-medium">{tab === "team_members" ? "Name" : "Company"}</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Status</th>
                {tab === "clients" ? (
                  <th className="px-4 py-3 font-medium">Fee %</th>
                ) : null}
                <th className="px-4 py-3 font-medium">Portal</th>
                <th className="w-10 px-4 py-3" aria-hidden />
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={tab === "clients" ? 6 : 5}
                    className="px-4 py-10 text-center text-white/45"
                  >
                    {search.trim()
                      ? `No ${tab === "team_members" ? "team members" : "clients"} match your search.`
                      : `No ${tab === "team_members" ? "team members" : "clients"} yet.`}
                  </td>
                </tr>
              ) : (
                filtered.map((client) => (
                  <tr
                    key={client.id}
                    className="cursor-pointer border-b border-white/5 transition-colors hover:bg-white/[0.04]"
                    onClick={() => setSelectedClient(client)}
                  >
                    <td className="px-4 py-3">
                      {tab === "team_members" ? (
                        <>
                          <p className="font-medium text-white">{client.display_name || "—"}</p>
                          {client.role ? (
                            <p className="text-xs capitalize text-white/45">
                              {client.role.replace(/_/g, " ")}
                            </p>
                          ) : null}
                        </>
                      ) : (
                        <>
                          <p className="font-medium text-white">{client.company_name || "—"}</p>
                          {client.display_name ? (
                            <p className="text-xs text-white/45">{client.display_name}</p>
                          ) : null}
                        </>
                      )}
                    </td>
                    <td className="px-4 py-3 text-white/70">{client.email || "—"}</td>
                    <td className="px-4 py-3">
                      <Badge variant={clientStatusVariant(client.status)}>{client.status}</Badge>
                    </td>
                    {tab === "clients" ? (
                      <td className="px-4 py-3 text-white/70">
                        {formatFeePercent(client.client_percentage)}
                      </td>
                    ) : null}
                    <td className="px-4 py-3">
                      <PortalAccessSwitch
                        checked={client.portal_access}
                        disabled={portalPendingId === client.id}
                        onChange={(next) => void handleListPortalToggle(client, next)}
                      />
                    </td>
                    <td className="px-4 py-3 text-white/30">
                      <ChevronRight className="h-4 w-4" />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="divide-y divide-white/10 md:hidden">
          {filtered.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-white/45">
              {search.trim()
                ? `No ${tab === "team_members" ? "team members" : "clients"} match your search.`
                : `No ${tab === "team_members" ? "team members" : "clients"} yet.`}
            </p>
          ) : (
            filtered.map((client) => (
              <button
                key={client.id}
                type="button"
                className="flex w-full items-center gap-3 px-4 py-4 text-left transition-colors hover:bg-white/[0.04]"
                onClick={() => setSelectedClient(client)}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-white">
                    {tab === "team_members"
                      ? client.display_name || "—"
                      : client.company_name || "—"}
                  </p>
                  <p className="truncate text-xs text-white/45">{client.email || "—"}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Badge variant={clientStatusVariant(client.status)}>{client.status}</Badge>
                    {tab === "clients" ? (
                      <span className="text-xs text-white/45">
                        Fee {formatFeePercent(client.client_percentage)}
                      </span>
                    ) : client.role ? (
                      <span className="text-xs capitalize text-white/45">
                        {client.role.replace(/_/g, " ")}
                      </span>
                    ) : null}
                  </div>
                </div>
                <div
                  className="shrink-0"
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                >
                  <PortalAccessSwitch
                    checked={client.portal_access}
                    disabled={portalPendingId === client.id}
                    onChange={(next) => void handleListPortalToggle(client, next)}
                  />
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-white/30" />
              </button>
            ))
          )}
        </div>
      </div>

      <p className="text-xs text-white/35">
        {filtered.length} {tab === "team_members" ? "team member" : "client"}
        {filtered.length === 1 ? "" : "s"}
        {search.trim() ? ` matching “${search.trim()}”` : ""}
      </p>

      <AnimatePresence>
        {showAddClient ? (
          <AddClientModal
            onClose={() => setShowAddClient(false)}
            onCreated={(client) => setClients((prev) => [client, ...prev])}
          />
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {selectedClient ? (
          <ClientDetailSheet
            key={selectedClient.id}
            client={selectedClient}
            onClose={() => setSelectedClient(null)}
            onPortalAccessChange={handlePortalAccessChange}
          />
        ) : null}
      </AnimatePresence>
    </div>
  );
}
