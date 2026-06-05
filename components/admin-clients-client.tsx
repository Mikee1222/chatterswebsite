"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  Building2,
  Calendar,
  Check,
  ChevronRight,
  CreditCard,
  ExternalLink,
  Eye,
  EyeOff,
  Loader2,
  Plus,
  Search,
  Send,
  Users,
  X,
} from "lucide-react";
import { GlassModal } from "@/components/ui/glass-modal";
import { ButtonSecondary, Label } from "@/components/ui/form";
import { FormInput } from "@/components/ui/form-input";
import { FormSelect } from "@/components/ui/form-select";
import { FormSubmitButton } from "@/components/ui/form-submit-button";
import { useToast } from "@/contexts/toast-context";
import { getCycleAmountDue } from "@/lib/client-portal-utils";
import { formatDateEuropean } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AppNotification } from "@/types";
import type {
  AdminClientRecord,
  BillingCycleKind,
  BillingCycleRecord,
  BillingCycleStatus,
  ClientModelRecord,
  PaymentSubmissionRecord,
} from "@/types/client-portal";

type Props = {
  clients: AdminClientRecord[];
};

type EnrichedSubmission = PaymentSubmissionRecord & {
  payment_method_label?: string;
  payment_method_type?: string;
};

type ClientDetail = {
  models: ClientModelRecord[];
  billingCycles: BillingCycleRecord[];
  submissions: EnrichedSubmission[];
};

function sortRecentBillingCycles(cycles: BillingCycleRecord[]): BillingCycleRecord[] {
  return [...cycles]
    .sort((a, b) => b.period_start.localeCompare(a.period_start))
    .slice(0, 5);
}

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

const badgeVariants = {
  default: "bg-white/10 text-white/80 border-white/15",
  emerald: "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
  amber: "bg-amber-500/15 text-amber-300 border-amber-500/25",
  pink: "bg-[hsl(330,80%,55%)]/15 text-[hsl(330,90%,75%)] border-[hsl(330,80%,55%)]/25",
  slate: "bg-white/5 text-white/60 border-white/10",
  gray: "bg-gray-500/15 text-gray-300 border-gray-500/25",
  blue: "bg-blue-500/15 text-blue-300 border-blue-500/25",
  yellow: "bg-yellow-500/15 text-yellow-300 border-yellow-500/25",
  rose: "bg-rose-500/15 text-rose-300 border-rose-500/25",
  red: "bg-red-500/15 text-red-300 border-red-500/25",
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
  if (status === "overdue") return "red";
  if (status === "pending_review") return "yellow";
  if (status === "announced") return "blue";
  if (status === "draft") return "gray";
  return "slate";
}

function submissionProofUrl(sub: PaymentSubmissionRecord): string | undefined {
  if (sub.proof_url) return sub.proof_url;
  return sub.proof_attachment?.[0]?.url;
}

function formatPaymentMethod(sub: EnrichedSubmission): string {
  if (sub.payment_method_label?.trim()) return sub.payment_method_label.trim();
  if (sub.payment_method_type?.trim()) return sub.payment_method_type.trim();
  return "—";
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
  tooltip,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
  tooltip?: string;
}) {
  return (
    <div
      className="inline-flex items-center gap-2"
      title={tooltip}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={tooltip ?? (checked ? "Portal enabled" : "Portal disabled")}
        title={tooltip}
        disabled={disabled}
        onClick={() => {
          if (!disabled) onChange(!checked);
        }}
        className={cn(
          "relative h-8 w-14 shrink-0 rounded-full border-2 transition-all duration-200",
          disabled && "cursor-not-allowed opacity-50",
          checked
            ? "border-pink-300/55 bg-gradient-to-r from-pink-500 to-fuchsia-600 shadow-[0_0_12px_-2px_hsl(330_80%_55%/0.55)]"
            : "border-white/22 bg-[#262626] hover:border-white/35"
        )}
      >
        <span
          className={cn(
            "absolute top-[3px] h-[22px] w-[22px] rounded-full bg-white shadow-md transition-transform duration-200",
            checked ? "translate-x-[26px]" : "translate-x-[3px]"
          )}
        />
      </button>
      <span
        className={cn(
          "hidden text-xs font-medium sm:inline",
          checked ? "text-pink-300" : "text-white/40"
        )}
      >
        {checked ? "On" : "Off"}
      </span>
    </div>
  );
}

function formatFeePercent(clientPercentage: number | undefined): string {
  if (typeof clientPercentage !== "number") return "—";
  return `${(clientPercentage * 100).toFixed(1)}%`;
}

function AddClientModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (client: AdminClientRecord) => void;
}) {
  const [companyName, setCompanyName] = React.useState("");
  const [displayName, setDisplayName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [feePercent, setFeePercent] = React.useState("");
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
    if (!companyName.trim()) {
      setError("Company name is required.");
      return;
    }

    let clientPercentage: number | undefined;
    if (feePercent.trim()) {
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
          user_type: "client",
          company_name: companyName.trim(),
          display_name: displayName.trim(),
          email: email.trim(),
          password,
          client_percentage: clientPercentage,
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
    <GlassModal title="Add user" subtitle="Create a client account" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4 p-4 md:p-5">
        <div>
          <Label htmlFor="add-company">Company name</Label>
          <FormInput
            id="add-company"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            required
          />
        </div>

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

function EditClientModal({
  client,
  onClose,
  onUpdated,
}: {
  client: AdminClientRecord;
  onClose: () => void;
  onUpdated: (client: AdminClientRecord) => void;
}) {
  const [companyName, setCompanyName] = React.useState(client.company_name ?? "");
  const [displayName, setDisplayName] = React.useState(client.display_name ?? "");
  const [email, setEmail] = React.useState(client.email ?? "");
  const [feePercent, setFeePercent] = React.useState(
    typeof client.client_percentage === "number"
      ? String((client.client_percentage * 100).toFixed(1))
      : ""
  );
  const [status, setStatus] = React.useState<AdminClientRecord["status"]>(client.status);
  const [password, setPassword] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => setMounted(true), []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!displayName.trim() || !email.trim()) {
      setError("Display name and email are required.");
      return;
    }
    if (password && password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    let clientPercentage: number | undefined;
    if (feePercent.trim()) {
      const parsed = Number(feePercent);
      if (Number.isNaN(parsed) || parsed < 0 || parsed > 100) {
        setError("Fee % must be between 0 and 100.");
        return;
      }
      clientPercentage = parsed / 100;
    }

    setPending(true);
    try {
      const res = await fetch(`/api/admin/clients/${client.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_name: companyName.trim(),
          display_name: displayName.trim(),
          email: email.trim(),
          client_percentage: clientPercentage,
          status,
          ...(password ? { password } : {}),
        }),
      });
      const data = (await res.json()) as { client?: AdminClientRecord; error?: string };
      if (!res.ok) {
        setError(data.error ?? "Failed to update client.");
        return;
      }
      if (data.client) onUpdated(data.client);
      onClose();
    } catch {
      setError("Network error. Try again.");
    } finally {
      setPending(false);
    }
  }

  if (!mounted) return null;

  return createPortal(
    <motion.div
      className="fixed inset-0 z-[200] flex items-end justify-center md:items-center md:p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.1, ease: "easeOut" }}
    >
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-md"
        aria-hidden
        onClick={onClose}
      />
      <motion.div
        className="relative flex max-h-[95dvh] w-full flex-col rounded-t-2xl border border-white/10 border-b-0 bg-black/95 shadow-2xl shadow-black/50 backdrop-blur-xl md:max-h-[calc(100vh-3rem)] md:max-w-md md:rounded-2xl md:border"
        style={{
          boxShadow:
            "0 0 0 1px rgba(255,255,255,0.06), 0 24px 64px -12px rgba(0,0,0,0.7), 0 0 80px -24px hsl(330 80% 55% / 0.08)",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.1, ease: "easeIn" } }}
        transition={{ duration: 0.15, ease: "easeOut" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 border-b border-white/10 px-4 py-4 md:px-5">
          <h2 className="text-lg font-semibold tracking-tight text-white">Edit client</h2>
          <p className="mt-1 text-sm text-white/55">
            {client.company_name || client.display_name}
          </p>
          <div className="mt-2 h-px w-12 rounded-full bg-pink-500/40" />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <form onSubmit={handleSubmit} className="space-y-4 p-4 md:p-5">
            <div>
              <Label htmlFor="edit-company">Company name</Label>
              <FormInput
                id="edit-company"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="edit-display">Display name</Label>
              <FormInput
                id="edit-display"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="edit-email">Email</Label>
              <FormInput
                id="edit-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="edit-fee">Fee % (0–100)</Label>
              <FormInput
                id="edit-fee"
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={feePercent}
                onChange={(e) => setFeePercent(e.target.value)}
                placeholder="e.g. 20"
              />
            </div>
            <div>
              <Label htmlFor="edit-status">Status</Label>
              <FormSelect
                id="edit-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as AdminClientRecord["status"])}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="suspended">Suspended</option>
              </FormSelect>
            </div>
            <div>
              <Label htmlFor="edit-password">New password (optional)</Label>
              <FormInput
                id="edit-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                placeholder="Leave blank to keep current"
              />
            </div>
            {error ? <p className="text-sm text-rose-300">{error}</p> : null}
            <div className="flex gap-3 pt-2">
              <ButtonSecondary type="button" className="flex-1" onClick={onClose}>
                Cancel
              </ButtonSecondary>
              <FormSubmitButton className="flex-1" loading={pending} disabled={pending}>
                Save changes
              </FormSubmitButton>
            </div>
          </form>
        </div>
      </motion.div>
    </motion.div>,
    document.body
  );
}

function ClientDetailSheet({
  client,
  onClose,
  onPortalAccessChange,
  onClientUpdated,
  onToggleStatus,
  statusPending,
}: {
  client: AdminClientRecord;
  onClose: () => void;
  onPortalAccessChange: (clientId: string, portalAccess: boolean) => void;
  onClientUpdated: (client: AdminClientRecord) => void;
  onToggleStatus: (client: AdminClientRecord) => void;
  statusPending: boolean;
}) {
  const [detail, setDetail] = React.useState<ClientDetail | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [portalPending, setPortalPending] = React.useState(false);
  const [portalAccess, setPortalAccess] = React.useState(client.portal_access);
  const [editingClient, setEditingClient] = React.useState(false);
  const [editingTelegram, setEditingTelegram] = React.useState(false);
  const [telegramGroupLink, setTelegramGroupLink] = React.useState(
    client.telegram_group_link ?? ""
  );
  const [telegramGroupName, setTelegramGroupName] = React.useState(
    client.telegram_group_name ?? ""
  );
  const [telegramPending, setTelegramPending] = React.useState(false);
  const [telegramError, setTelegramError] = React.useState<string | null>(null);
  const [reviewingId, setReviewingId] = React.useState("");
  const [reviewingAction, setReviewingAction] = React.useState<"approved" | "rejected" | "">("");
  const [activeNoteId, setActiveNoteId] = React.useState("");
  const [adminNote, setAdminNote] = React.useState("");
  const { addToast } = useToast();

  const recentBillingCycles = React.useMemo(
    () => (detail ? sortRecentBillingCycles(detail.billingCycles) : []),
    [detail]
  );

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
        submissions?: EnrichedSubmission[];
        error?: string;
      };
      if (!detailRes.ok || !submissionsRes.ok) {
        setLoadError(detailJson.error ?? submissionsJson.error ?? "Failed to load client details.");
        return;
      }
      setDetail({
        models: detailJson.models ?? [],
        billingCycles: sortRecentBillingCycles(detailJson.billingCycles ?? []),
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
    if (!editingTelegram) {
      setTelegramGroupLink(client.telegram_group_link ?? "");
      setTelegramGroupName(client.telegram_group_name ?? "");
      setTelegramError(null);
    }
  }, [client.telegram_group_link, client.telegram_group_name, editingTelegram]);

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

  function handleTelegramCancel() {
    setTelegramGroupLink(client.telegram_group_link ?? "");
    setTelegramGroupName(client.telegram_group_name ?? "");
    setTelegramError(null);
    setEditingTelegram(false);
  }

  async function handleTelegramSave(e: React.FormEvent) {
    e.preventDefault();
    setTelegramError(null);

    const link = telegramGroupLink.trim();
    const name = telegramGroupName.trim();

    if (link) {
      try {
        new URL(link);
      } catch {
        setTelegramError("Enter a valid Telegram group URL.");
        return;
      }
    }

    setTelegramPending(true);
    try {
      const res = await fetch(`/api/admin/clients/${client.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          telegram_group_link: link,
          telegram_group_name: name,
        }),
      });
      const data = (await res.json()) as { client?: AdminClientRecord; error?: string };
      if (!res.ok) {
        setTelegramError(data.error ?? "Failed to save Telegram details.");
        return;
      }
      if (data.client) onClientUpdated(data.client);
      setEditingTelegram(false);
    } catch {
      setTelegramError("Network error. Try again.");
    } finally {
      setTelegramPending(false);
    }
  }

  async function handleSubmissionReview(
    submissionId: string,
    status: "approved" | "rejected"
  ) {
    setReviewingId(submissionId);
    setReviewingAction(status);
    const note = adminNote.trim() || undefined;
    try {
      const res = await fetch(`/api/admin/submissions/${submissionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          admin_note: note,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        addToast(
          localToast(
            `submission-review-error-${submissionId}`,
            "Review failed",
            data.error ?? "Could not update submission.",
            "high"
          )
        );
        return;
      }

      setAdminNote("");
      setActiveNoteId("");
      addToast(
        localToast(
          `submission-review-${submissionId}-${status}`,
          status === "approved" ? "Payment approved" : "Payment rejected",
          status === "approved"
            ? "The submission was approved and billing was updated."
            : "The submission was rejected.",
          "normal"
        )
      );

      await new Promise((r) => setTimeout(r, 2500));
      await loadDetail();
    } catch {
      addToast(
        localToast(
          `submission-review-network-${submissionId}`,
          "Network error",
          "Could not reach the server. Try again.",
          "high"
        )
      );
    } finally {
      setReviewingId("");
      setReviewingAction("");
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
          className="relative z-[1] flex h-full w-full max-w-lg flex-col border-l border-white/10 bg-black/95 shadow-2xl overflow-hidden"
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
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={statusPending}
                  onClick={() => onToggleStatus(client)}
                  className={cn(
                    "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                    client.status === "active"
                      ? "border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20"
                      : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20",
                    statusPending && "cursor-not-allowed opacity-50"
                  )}
                >
                  {client.status === "active" ? "Mark inactive" : "Mark active"}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingClient(true)}
                  className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/70 hover:bg-white/5"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg border border-white/10 p-2 text-white/60 hover:bg-white/5 hover:text-white"
                  aria-label="Close panel"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <Badge variant={clientStatusVariant(client.status)}>{client.status}</Badge>
              <button
                type="button"
                onClick={() => void handlePortalToggle(!portalAccess)}
                disabled={portalPending}
                className={cn(
                  "inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                  portalAccess
                    ? "border-pink-400/30 bg-pink-500/15 text-pink-300 hover:bg-pink-500/25"
                    : "border-white/15 bg-white/5 text-white/50 hover:bg-white/10",
                  portalPending && "cursor-not-allowed opacity-50"
                )}
              >
                <span
                  className={cn(
                    "h-2 w-2 rounded-full",
                    portalAccess ? "bg-pink-400" : "bg-white/30"
                  )}
                />
                Portal {portalAccess ? "enabled" : "disabled"}
                {portalPending ? " …" : null}
              </button>
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
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-white/40">
                      <Send className="h-3.5 w-3.5" />
                      Telegram
                    </div>
                    {!editingTelegram ? (
                      <button
                        type="button"
                        onClick={() => setEditingTelegram(true)}
                        className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/70 hover:bg-white/5"
                      >
                        Edit
                      </button>
                    ) : null}
                  </div>
                  {editingTelegram ? (
                    <form
                      onSubmit={handleTelegramSave}
                      className="space-y-3 rounded-xl border border-white/10 bg-white/[0.03] p-4"
                    >
                      <div>
                        <Label htmlFor="telegram-group-name">Group name</Label>
                        <FormInput
                          id="telegram-group-name"
                          value={telegramGroupName}
                          onChange={(e) => setTelegramGroupName(e.target.value)}
                          placeholder="e.g. Acme Agency Chat"
                          maxLength={200}
                        />
                      </div>
                      <div>
                        <Label htmlFor="telegram-group-link">Group link</Label>
                        <FormInput
                          id="telegram-group-link"
                          type="url"
                          value={telegramGroupLink}
                          onChange={(e) => setTelegramGroupLink(e.target.value)}
                          placeholder="https://t.me/..."
                        />
                      </div>
                      {telegramError ? (
                        <p className="text-sm text-rose-300">{telegramError}</p>
                      ) : null}
                      <div className="flex gap-2 pt-1">
                        <ButtonSecondary
                          type="button"
                          className="flex-1"
                          onClick={handleTelegramCancel}
                          disabled={telegramPending}
                        >
                          Cancel
                        </ButtonSecondary>
                        <FormSubmitButton
                          className="flex-1"
                          loading={telegramPending}
                          disabled={telegramPending}
                        >
                          Save
                        </FormSubmitButton>
                      </div>
                    </form>
                  ) : (
                    <div className="space-y-2 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm">
                      <div className="flex justify-between gap-4">
                        <span className="text-white/45">Group name</span>
                        <span className="text-right text-white">
                          {client.telegram_group_name?.trim() || "—"}
                        </span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-white/45">Group link</span>
                        {client.telegram_group_link?.trim() ? (
                          <a
                            href={client.telegram_group_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-right text-pink-300 hover:text-pink-200"
                          >
                            <span className="max-w-[200px] truncate">
                              {client.telegram_group_link}
                            </span>
                            <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden />
                          </a>
                        ) : (
                          <span className="text-right text-white">—</span>
                        )}
                      </div>
                      {client.telegram_group_link?.trim() ? (
                        <a
                          href={client.telegram_group_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-gradient-to-r from-rose-600 via-pink-600 to-pink-500 px-3 py-1.5 text-xs font-medium text-white shadow-[0_2px_12px_-2px_rgba(236,72,153,0.45)] transition-opacity hover:opacity-90"
                        >
                          <Send className="h-3 w-3 shrink-0 opacity-95" aria-hidden />
                          Open in Telegram
                        </a>
                      ) : null}
                    </div>
                  )}
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
                          className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm"
                        >
                          <span className="font-medium text-white">
                            {row.model_name?.trim() || "Unnamed model"}
                          </span>
                          <Badge variant="pink">Chatting Agency</Badge>
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="mt-3 text-xs text-white/40">
                    Manage model assignments from the Models page.
                  </p>
                </section>

                <section>
                  <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-white/40">
                    <Calendar className="h-3.5 w-3.5" />
                    Recent billing cycles
                  </div>
                  {recentBillingCycles.length === 0 ? (
                    <p className="text-sm text-white/45">No billing cycles yet.</p>
                  ) : (
                    <ul className="space-y-2">
                      {recentBillingCycles.map((cycle) => (
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
                      {detail.submissions.map((sub) => {
                        const proofUrl = submissionProofUrl(sub);
                        return (
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
                              <p className="mt-1 text-xs text-white/45">
                                Payment method: {formatPaymentMethod(sub)}
                              </p>
                              {sub.reference_id ? (
                                <p className="mt-1 text-xs text-white/40">Ref: {sub.reference_id}</p>
                              ) : null}
                              {sub.note ? (
                                <p className="mt-2 text-xs text-white/55">{sub.note}</p>
                              ) : null}
                            </div>
                            {proofUrl ? (
                              <a
                                href={proofUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-[hsl(330,90%,75%)] hover:underline"
                                onClick={(e) => e.stopPropagation()}
                              >
                                View proof
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            ) : null}
                          </div>
                          <div className="mt-3">
                            <FormInput
                              placeholder="Admin note (optional)"
                              value={activeNoteId === sub.id ? adminNote : ""}
                              onChange={(e) => {
                                setActiveNoteId(sub.id);
                                setAdminNote(e.target.value);
                              }}
                              onFocus={() => setActiveNoteId(sub.id)}
                              disabled={!!reviewingId}
                            />
                          </div>
                          <div className="mt-3 flex gap-2">
                            <button
                              type="button"
                              disabled={!!reviewingId}
                              onClick={() => void handleSubmissionReview(sub.id, "approved")}
                              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/15 px-3 py-2 text-xs font-medium text-emerald-300 hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {reviewingId === sub.id && reviewingAction === "approved" ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                              ) : (
                                <Check className="h-3.5 w-3.5" />
                              )}
                              Approve
                            </button>
                            <button
                              type="button"
                              disabled={!!reviewingId}
                              onClick={() => void handleSubmissionReview(sub.id, "rejected")}
                              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/15 px-3 py-2 text-xs font-medium text-rose-300 hover:bg-rose-500/25 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {reviewingId === sub.id && reviewingAction === "rejected" ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                              ) : (
                                <X className="h-3.5 w-3.5" />
                              )}
                              Reject
                            </button>
                          </div>
                        </li>
                        );
                      })}
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
        {editingClient ? (
          <EditClientModal
            client={client}
            onClose={() => setEditingClient(false)}
            onUpdated={(updated) => {
              onClientUpdated(updated);
              setEditingClient(false);
            }}
          />
        ) : null}
      </AnimatePresence>
    </>
  );
}

export function AdminClientsClient({ clients: initialClients }: Props) {
  const { addToast } = useToast();
  const [clients, setClients] = React.useState(initialClients);
  const [search, setSearch] = React.useState("");
  const [showInactive, setShowInactive] = React.useState(false);
  const [selectedClient, setSelectedClient] = React.useState<AdminClientRecord | null>(null);
  const [portalPendingId, setPortalPendingId] = React.useState<string | null>(null);
  const [statusPendingId, setStatusPendingId] = React.useState<string | null>(null);
  const [showAddClient, setShowAddClient] = React.useState(false);

  React.useEffect(() => {
    setClients(initialClients);
  }, [initialClients]);

  const filtered = React.useMemo(() => {
    let list = clients;
    if (!showInactive) {
      list = list.filter((c) => c.status === "active");
    }
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (c) =>
        c.company_name.toLowerCase().includes(q) ||
        c.display_name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q)
    );
  }, [clients, search, showInactive]);

  function handlePortalAccessChange(clientId: string, portalAccess: boolean) {
    setClients((prev) =>
      prev.map((c) => (c.id === clientId ? { ...c, portal_access: portalAccess } : c))
    );
    setSelectedClient((prev) =>
      prev?.id === clientId ? { ...prev, portal_access: portalAccess } : prev
    );
  }

  function handleClientUpdated(updated: AdminClientRecord) {
    setClients((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    setSelectedClient((prev) => (prev?.id === updated.id ? updated : prev));
  }

  function handleStatusChange(clientId: string, status: string) {
    setClients((prev) =>
      prev.map((c) =>
        c.id === clientId ? { ...c, status: status as AdminClientRecord["status"] } : c
      )
    );
    setSelectedClient((prev) =>
      prev?.id === clientId ? { ...prev, status: status as AdminClientRecord["status"] } : prev
    );
  }

  const handleToggleStatus = React.useCallback(
    async (client: AdminClientRecord) => {
      if (statusPendingId) return;

      const newStatus = client.status === "active" ? "inactive" : "active";
      const prevStatus = client.status;
      const label = client.company_name || client.display_name || "User";

      handleStatusChange(client.id, newStatus);
      setStatusPendingId(client.id);

      try {
        const res = await fetch(`/api/admin/clients/${client.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: newStatus }),
        });
        if (!res.ok) {
          handleStatusChange(client.id, prevStatus);
          addToast(
            localToast(
              `client-status-err-${client.id}-${Date.now()}`,
              "Could not update status",
              "Please try again.",
              "high"
            )
          );
          return;
        }
        addToast(
          localToast(
            `client-status-ok-${client.id}-${Date.now()}`,
            newStatus === "active" ? "Marked active" : "Marked inactive",
            `${label} is now ${newStatus}.`,
            "normal"
          )
        );
      } catch {
        handleStatusChange(client.id, prevStatus);
        addToast(
          localToast(
            `client-status-net-${client.id}-${Date.now()}`,
            "Network error",
            "Could not update client status.",
            "high"
          )
        );
      } finally {
        setStatusPendingId(null);
      }
    },
    [statusPendingId, addToast]
  );

  async function handleListPortalToggle(client: AdminClientRecord, next: boolean) {
    setPortalPendingId(client.id);
    const label = client.company_name || client.display_name || "User";
    try {
      const res = await fetch(`/api/admin/clients/${client.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ portal_access: next }),
      });
      const data = (await res.json()) as { client?: AdminClientRecord };
      if (res.ok && data.client) {
        handlePortalAccessChange(client.id, data.client.portal_access);
        addToast(
          localToast(
            `portal-${client.id}-${Date.now()}`,
            next ? "Portal enabled" : "Portal disabled",
            `${label} portal access is now ${next ? "on" : "off"}.`,
            "normal"
          )
        );
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

      <div className="flex max-w-3xl flex-wrap items-center gap-3">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
          <FormInput
            className="pl-10"
            placeholder="Search company, name, or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button
          type="button"
          onClick={() => setShowInactive((v) => !v)}
          title={showInactive ? "Hide inactive users from the list" : "Include inactive users in the list"}
          className={cn(
            "inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-all",
            showInactive
              ? "border-amber-500/45 bg-amber-500/15 text-amber-200 shadow-[0_0_20px_-8px_hsl(38_92%_50%/0.45)] ring-1 ring-amber-500/25"
              : "border-white/15 bg-white/[0.06] text-white/65 hover:border-white/25 hover:bg-white/[0.09] hover:text-white"
          )}
        >
          {showInactive ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          {showInactive ? "Showing inactive" : "Show inactive"}
        </button>
      </div>

      <div
        className="overflow-hidden rounded-2xl border border-white/10 bg-black/40 backdrop-blur-xl"
        style={{
          boxShadow:
            "0 0 0 1px rgba(255,255,255,0.06), 0 0 48px -12px hsl(330 80% 55% / 0.1)",
        }}
      >
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.03] text-xs uppercase tracking-wider text-white/40">
                <th className="px-4 py-3 font-medium">Company</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Fee %</th>
                <th className="px-4 py-3 font-medium">Portal</th>
                <th className="px-4 py-3 font-medium">Actions</th>
                <th className="w-10 px-4 py-3" aria-hidden />
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-white/45">
                    {search.trim() ? "No users match your search." : "No users yet."}
                  </td>
                </tr>
              ) : (
                filtered.map((client) => {
                  const isInactive = client.status === "inactive";
                  const statusBusy = statusPendingId === client.id;
                  return (
                  <tr
                    key={client.id}
                    className={cn(
                      "cursor-pointer border-b border-white/5 transition-colors hover:bg-white/[0.06]",
                      isInactive && "opacity-50"
                    )}
                    onClick={() => setSelectedClient(client)}
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-white">
                        {client.company_name || client.display_name || "—"}
                      </p>
                      {client.display_name && client.company_name ? (
                        <p className="text-xs text-white/45">{client.display_name}</p>
                      ) : client.user_type === "team_member" && client.role ? (
                        <p className="text-xs capitalize text-white/45">
                          {client.role.replace(/_/g, " ")}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-white/70">{client.email || "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {isInactive ? (
                          <Badge variant="slate">Inactive</Badge>
                        ) : (
                          <Badge variant={clientStatusVariant(client.status)}>{client.status}</Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-white/70">
                      {formatFeePercent(client.client_percentage)}
                    </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <PortalAccessSwitch
                        checked={client.portal_access}
                        disabled={portalPendingId === client.id}
                        tooltip={
                          client.portal_access
                            ? "Portal access enabled — click to disable"
                            : "Portal access disabled — click to enable"
                        }
                        onChange={(next) => void handleListPortalToggle(client, next)}
                      />
                    </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        disabled={statusBusy}
                        title={
                          client.status === "active"
                            ? "Mark this user inactive"
                            : "Mark this user active"
                        }
                        onClick={() => void handleToggleStatus(client)}
                        className={cn(
                          "rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap",
                          client.status === "active"
                            ? "border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20"
                            : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20",
                          statusBusy && "cursor-not-allowed opacity-50"
                        )}
                      >
                        {client.status === "active" ? "Mark inactive" : "Mark active"}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-white/30">
                      <ChevronRight className="h-4 w-4" />
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="divide-y divide-white/10 md:hidden">
          {filtered.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-white/45">
              {search.trim() ? "No users match your search." : "No users yet."}
            </p>
          ) : (
            filtered.map((client) => {
              const isInactive = client.status === "inactive";
              const statusBusy = statusPendingId === client.id;
              return (
              <button
                key={client.id}
                type="button"
                className={cn(
                  "flex w-full items-center gap-3 px-4 py-4 text-left transition-colors hover:bg-white/[0.06]",
                  isInactive && "opacity-50"
                )}
                onClick={() => setSelectedClient(client)}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-white">
                    {client.company_name || client.display_name || "—"}
                  </p>
                  <p className="truncate text-xs text-white/45">{client.email || "—"}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {isInactive ? (
                      <Badge variant="slate">Inactive</Badge>
                    ) : (
                      <Badge variant={clientStatusVariant(client.status)}>{client.status}</Badge>
                    )}
                    <span className="text-xs text-white/45">
                      Fee {formatFeePercent(client.client_percentage)}
                    </span>
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <div
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                  >
                    <PortalAccessSwitch
                      checked={client.portal_access}
                      disabled={portalPendingId === client.id}
                      tooltip={
                        client.portal_access
                          ? "Portal access enabled — click to disable"
                          : "Portal access disabled — click to enable"
                      }
                      onChange={(next) => void handleListPortalToggle(client, next)}
                    />
                  </div>
                  <button
                    type="button"
                    disabled={statusBusy}
                    title={
                      client.status === "active"
                        ? "Mark this user inactive"
                        : "Mark this user active"
                    }
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleToggleStatus(client);
                    }}
                    className={cn(
                      "rounded-lg border px-2 py-1 text-[11px] font-medium transition-colors whitespace-nowrap",
                      client.status === "active"
                        ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
                        : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
                      statusBusy && "cursor-not-allowed opacity-50"
                    )}
                  >
                    {client.status === "active" ? "Mark inactive" : "Mark active"}
                  </button>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-white/30" />
              </button>
              );
            })
          )}
        </div>
      </div>

      <p className="text-xs text-white/35">
        {filtered.length} user{filtered.length === 1 ? "" : "s"}
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
            onClientUpdated={handleClientUpdated}
            onToggleStatus={(c) => void handleToggleStatus(c)}
            statusPending={statusPendingId === selectedClient.id}
          />
        ) : null}
      </AnimatePresence>
    </div>
  );
}
