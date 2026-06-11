"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  Building2,
  Calendar,
  Check,
  CreditCard,
  ExternalLink,
  Eye,
  EyeOff,
  Loader2,
  Plus,
  Search,
  Send,
  UserRound,
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
import { ROUTES } from "@/lib/routes";
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

type BillingCycleWithAmount = BillingCycleRecord & { correct_amount_due?: number };

type EnrichedSubmission = PaymentSubmissionRecord & {
  payment_method_label?: string;
  payment_method_type?: string;
};

type ClientDetail = {
  models: ClientModelRecord[];
  billingCycles: BillingCycleWithAmount[];
  submissions: EnrichedSubmission[];
};

const cardClass = cn(
  "rounded-xl border border-white/[0.08] bg-zinc-950/80 p-5",
  "shadow-[0_4px_24px_-8px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.04)]"
);

const SEARCH_DEBOUNCE_MS = 300;

function sortRecentBillingCycles(cycles: BillingCycleWithAmount[]): BillingCycleWithAmount[] {
  return [...cycles]
    .sort((a, b) => b.period_start.localeCompare(a.period_start))
    .slice(0, 5);
}

function cycleAmountDue(cycle: BillingCycleWithAmount): number {
  if (typeof cycle.correct_amount_due === "number") return cycle.correct_amount_due;
  return getCycleAmountDue(cycle);
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

function formatCycleStatus(status: BillingCycleStatus): string {
  return status.replace(/_/g, " ");
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

function formatFeePercent(clientPercentage: number | undefined): string {
  if (typeof clientPercentage !== "number") return "—";
  return `${(clientPercentage * 100).toFixed(1)}%`;
}

function clientInitials(client: AdminClientRecord): string {
  const source = (client.company_name || client.display_name || client.email || "?").trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

function avatarClasses(status: AdminClientRecord["status"]): string {
  if (status === "active") {
    return "border-emerald-500/35 bg-gradient-to-br from-emerald-500/25 to-emerald-600/10 text-emerald-200";
  }
  if (status === "suspended") {
    return "border-amber-500/35 bg-gradient-to-br from-amber-500/25 to-amber-600/10 text-amber-200";
  }
  return "border-white/15 bg-gradient-to-br from-white/10 to-white/5 text-white/55";
}

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

function useIsLgDesktop(): boolean {
  const [isDesktop, setIsDesktop] = React.useState(false);
  React.useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return isDesktop;
}

function PortalAccessSwitch({
  checked,
  disabled,
  onChange,
  tooltip,
  compact,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
  tooltip?: string;
  compact?: boolean;
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
          "relative shrink-0 rounded-full border-2 transition-all duration-200",
          compact ? "h-6 w-11" : "h-8 w-14",
          disabled && "cursor-not-allowed opacity-50",
          checked
            ? "border-pink-300/55 bg-gradient-to-r from-pink-500 to-fuchsia-600 shadow-[0_0_12px_-2px_hsl(330_80%_55%/0.55)]"
            : "border-white/22 bg-[#262626] hover:border-white/35"
        )}
      >
        <span
          className={cn(
            "absolute top-[3px] rounded-full bg-white shadow-md transition-transform duration-200",
            compact ? "h-[16px] w-[16px]" : "h-[22px] w-[22px]",
            checked
              ? compact
                ? "translate-x-[21px]"
                : "translate-x-[26px]"
              : "translate-x-[3px]"
          )}
        />
      </button>
      {!compact ? (
        <span
          className={cn(
            "hidden text-xs font-medium sm:inline",
            checked ? "text-pink-300" : "text-white/40"
          )}
        >
          {checked ? "On" : "Off"}
        </span>
      ) : null}
    </div>
  );
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

function DetailEmptyState() {
  return (
    <div className={cn(cardClass, "flex h-full min-h-[320px] flex-col items-center justify-center text-center")}>
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-white/[0.04]">
        <UserRound className="h-7 w-7 text-white/25" aria-hidden />
      </div>
      <p className="text-base font-medium text-white/70">Select a client to view details</p>
      <p className="mt-1 max-w-xs text-sm text-white/40">
        Choose a client from the list to see billing, models, and submissions.
      </p>
    </div>
  );
}

function ClientDetailPanel({
  client,
  layout,
  onClose,
  onPortalAccessChange,
  onClientUpdated,
  onToggleStatus,
  statusPending,
}: {
  client: AdminClientRecord;
  layout: "desktop" | "mobile";
  onClose?: () => void;
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
        billingCycles?: BillingCycleWithAmount[];
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
    if (layout !== "mobile") return;
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
  }, [layout]);

  React.useEffect(() => {
    if (layout !== "mobile" || !onClose) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [layout, onClose]);

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

  const detailBody = (
    <div className="min-h-0 flex-1 overflow-y-auto">
      {loading ? (
        <div className="flex items-center gap-2 px-1 py-8 text-sm text-white/50">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Loading…
        </div>
      ) : loadError ? (
        <p className="px-1 py-4 text-sm text-rose-300">{loadError}</p>
      ) : detail ? (
        <div className="space-y-4">
          <section className={cardClass}>
            <h3 className="mb-4 flex items-center gap-2 text-sm font-medium text-white/80">
              <Building2 className="h-4 w-4 text-white/45" aria-hidden />
              Client info
            </h3>
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs text-white/45">Company</dt>
                <dd className="mt-1 text-sm text-white">{client.company_name || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-white/45">Display name</dt>
                <dd className="mt-1 text-sm text-white">{client.display_name || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-white/45">Email</dt>
                <dd className="mt-1 text-sm text-white">{client.email || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-white/45">Fee %</dt>
                <dd className="mt-1 text-sm text-white">
                  {typeof client.client_percentage === "number"
                    ? `${(client.client_percentage * 100).toFixed(1)}%`
                    : "—"}
                </dd>
              </div>
            </dl>
          </section>

          <section className={cardClass}>
            <div className="mb-4 flex items-center justify-between gap-2">
              <h3 className="flex items-center gap-2 text-sm font-medium text-white/80">
                <Send className="h-4 w-4 text-white/45" aria-hidden />
                Telegram
              </h3>
              {!editingTelegram ? (
                <button
                  type="button"
                  onClick={() => setEditingTelegram(true)}
                  className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/70 transition-colors hover:bg-white/5"
                >
                  Edit
                </button>
              ) : null}
            </div>
            {editingTelegram ? (
              <form onSubmit={handleTelegramSave} className="space-y-3">
                <div>
                  <Label htmlFor={`telegram-group-name-${layout}`}>Group name</Label>
                  <FormInput
                    id={`telegram-group-name-${layout}`}
                    value={telegramGroupName}
                    onChange={(e) => setTelegramGroupName(e.target.value)}
                    placeholder="e.g. Acme Agency Chat"
                    maxLength={200}
                  />
                </div>
                <div>
                  <Label htmlFor={`telegram-group-link-${layout}`}>Group link</Label>
                  <FormInput
                    id={`telegram-group-link-${layout}`}
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
            ) : client.telegram_group_link?.trim() || client.telegram_group_name?.trim() ? (
              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-xs text-white/45">Group name</p>
                  <p className="mt-1 text-white">{client.telegram_group_name?.trim() || "—"}</p>
                </div>
                {client.telegram_group_link?.trim() ? (
                  <>
                    <div>
                      <p className="text-xs text-white/45">Group link</p>
                      <a
                        href={client.telegram_group_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 inline-flex items-center gap-1.5 text-pink-300 hover:text-pink-200"
                      >
                        <span className="max-w-full truncate">{client.telegram_group_link}</span>
                        <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      </a>
                    </div>
                    <a
                      href={client.telegram_group_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-gradient-to-r from-rose-600 via-pink-600 to-pink-500 px-3 py-1.5 text-xs font-medium text-white shadow-[0_2px_12px_-2px_rgba(236,72,153,0.45)] transition-opacity hover:opacity-90"
                    >
                      <Send className="h-3 w-3 shrink-0 opacity-95" aria-hidden />
                      Open in Telegram
                    </a>
                  </>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-white/45">No Telegram group linked yet.</p>
            )}
          </section>

          <section className={cardClass}>
            <h3 className="mb-4 flex items-center gap-2 text-sm font-medium text-white/80">
              <Users className="h-4 w-4 text-white/45" aria-hidden />
              Models ({detail.models.length})
            </h3>
            {detail.models.length === 0 ? (
              <p className="text-sm text-white/45">No models assigned.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {detail.models.map((row) => (
                  <span
                    key={row.id}
                    className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-sm"
                  >
                    <span className="font-medium text-white">
                      {row.model_name?.trim() || "Unnamed model"}
                    </span>
                    <Badge variant="pink">Chatting Agency</Badge>
                  </span>
                ))}
              </div>
            )}
            <Link
              href={ROUTES.admin.models}
              className="mt-4 inline-flex items-center gap-1 text-xs text-pink-300/90 transition-colors hover:text-pink-200"
            >
              Manage on Models page
              <ExternalLink className="h-3 w-3" aria-hidden />
            </Link>
          </section>

          <section className={cardClass}>
            <h3 className="mb-4 flex items-center gap-2 text-sm font-medium text-white/80">
              <Calendar className="h-4 w-4 text-white/45" aria-hidden />
              Billing cycles
            </h3>
            {recentBillingCycles.length === 0 ? (
              <p className="text-sm text-white/45">No billing cycles yet.</p>
            ) : (
              <ul className="space-y-3">
                {recentBillingCycles.map((cycle) => (
                  <li
                    key={cycle.id}
                    className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-sm transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
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
                        <p className="font-medium tabular-nums text-white">
                          {formatMoney(cycleAmountDue(cycle), cycle.currency)}
                        </p>
                        <div className="mt-1.5">
                          <Badge variant={cycleStatusVariant(cycle.status)}>
                            {formatCycleStatus(cycle.status)}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className={cardClass}>
            <h3 className="mb-4 flex items-center gap-2 text-sm font-medium text-white/80">
              <CreditCard className="h-4 w-4 text-white/45" aria-hidden />
              Pending submissions ({detail.submissions.length})
            </h3>
            {detail.submissions.length === 0 ? (
              <p className="text-sm text-white/45">No payments awaiting review.</p>
            ) : (
              <ul className="space-y-3">
                {detail.submissions.map((sub) => {
                  const proofUrl = submissionProofUrl(sub);
                  return (
                    <li
                      key={sub.id}
                      className="rounded-lg border border-yellow-500/20 bg-yellow-500/[0.06] p-4 text-sm"
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
  );

  const header = (
    <div className="shrink-0 border-b border-white/10 pb-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-xl font-semibold text-white">
            {client.company_name || client.display_name || "Client"}
          </h2>
          {client.display_name && client.company_name ? (
            <p className="mt-0.5 truncate text-sm text-white/55">{client.display_name}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
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
            className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/70 transition-colors hover:bg-white/5"
          >
            Edit
          </button>
          {layout === "mobile" && onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-white/10 p-2 text-white/60 transition-colors hover:bg-white/5 hover:text-white"
              aria-label="Close panel"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Badge variant={clientStatusVariant(client.status)}>{client.status}</Badge>
        <Badge variant={portalAccess ? "pink" : "slate"}>
          Portal {portalAccess ? "enabled" : "disabled"}
        </Badge>
        <div className="flex items-center gap-2">
          <span className="text-xs text-white/45">Portal access</span>
          <PortalAccessSwitch
            checked={portalAccess}
            disabled={portalPending}
            onChange={(next) => void handlePortalToggle(next)}
            tooltip={
              portalAccess
                ? "Portal access enabled — click to disable"
                : "Portal access disabled — click to enable"
            }
          />
        </div>
      </div>
    </div>
  );

  const editModal = (
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
  );

  if (layout === "desktop") {
    return (
      <>
        <motion.div
          key={client.id}
          initial={{ opacity: 0, x: 8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className={cn(cardClass, "flex h-full min-h-0 flex-col overflow-hidden !p-0")}
        >
          <div className="px-5 pt-5">{header}</div>
          <div className="px-5 pb-5">{detailBody}</div>
        </motion.div>
        {editModal}
      </>
    );
  }

  return (
    <>
      <motion.div
        className="fixed inset-0 z-[70] flex items-end justify-center lg:hidden"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
      >
        <button
          type="button"
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          aria-label="Close"
          onClick={onClose}
        />
        <motion.aside
          className="relative z-[1] flex max-h-[min(88dvh,720px)] w-full flex-col overflow-hidden rounded-t-3xl border border-white/10 border-b-0 bg-zinc-950 shadow-[0_-12px_48px_rgba(0,0,0,0.55)]"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 28, stiffness: 320 }}
        >
          <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-white/20" aria-hidden />
          <div className="min-h-0 flex-1 overflow-hidden px-5 pb-5 pt-4">
            {header}
            {detailBody}
          </div>
        </motion.aside>
      </motion.div>
      {editModal}
    </>
  );
}

export function AdminClientsClient({ clients: initialClients }: Props) {
  const { addToast } = useToast();
  const isLgDesktop = useIsLgDesktop();
  const [clients, setClients] = React.useState(initialClients);
  const [search, setSearch] = React.useState("");
  const debouncedSearch = useDebouncedValue(search, SEARCH_DEBOUNCE_MS);
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
    const q = debouncedSearch.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (c) =>
        c.company_name.toLowerCase().includes(q) ||
        c.display_name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q)
    );
  }, [clients, debouncedSearch, showInactive]);

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
    <div className="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-[1600px] flex-col px-4 py-6 md:px-6 md:py-8 lg:flex-row lg:gap-6">
      <div className="flex min-h-0 w-full flex-col lg:w-[40%] lg:shrink-0">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-white">Clients</h1>
            <span className="rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-0.5 text-xs font-medium tabular-nums text-white/60">
              {filtered.length}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setShowAddClient(true)}
            className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-pink-400/40 bg-gradient-to-r from-pink-500 to-fuchsia-600 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_0_24px_-8px_hsl(330_80%_55%/0.45)] transition hover:brightness-110"
          >
            <Plus className="h-4 w-4" />
            Add client
          </button>
        </div>

        <div className="relative mb-3">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
          <FormInput
            className="w-full pl-10"
            placeholder="Search company, name, or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="mb-4 flex justify-end">
          <button
            type="button"
            onClick={() => setShowInactive((v) => !v)}
            title={showInactive ? "Hide inactive clients" : "Include inactive clients"}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors",
              showInactive
                ? "border-amber-500/35 bg-amber-500/10 text-amber-200"
                : "border-white/10 bg-white/[0.03] text-white/50 hover:border-white/20 hover:text-white/70"
            )}
          >
            {showInactive ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
            Show inactive
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pb-4 lg:pb-0">
          {filtered.length === 0 ? (
            <div className={cn(cardClass, "py-10 text-center text-sm text-white/45")}>
              {debouncedSearch.trim() ? "No clients match your search." : "No clients yet."}
            </div>
          ) : (
            filtered.map((client) => {
              const isSelected = selectedClient?.id === client.id;
              const isInactive = client.status === "inactive";
              const statusBusy = statusPendingId === client.id;
              return (
                <button
                  key={client.id}
                  type="button"
                  onClick={() => setSelectedClient(client)}
                  className={cn(
                    "w-full rounded-xl border bg-zinc-950/80 p-4 text-left transition-all duration-200",
                    "hover:border-white/15 hover:bg-white/[0.04]",
                    isSelected
                      ? "border-l-[3px] border-l-pink-500 border-pink-500/25 bg-pink-500/[0.06] shadow-[inset_0_0_0_1px_rgba(236,72,153,0.08)]"
                      : "border-white/[0.08]",
                    isInactive && !isSelected && "opacity-60"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={cn(
                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
                        avatarClasses(client.status)
                      )}
                    >
                      {clientInitials(client)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-white">
                            {client.company_name || client.display_name || "—"}
                          </p>
                          {client.display_name && client.company_name ? (
                            <p className="truncate text-sm text-white/50">{client.display_name}</p>
                          ) : null}
                          <p className="truncate text-[12px] text-white/40">{client.email || "—"}</p>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1.5">
                          {isInactive ? (
                            <Badge variant="slate">Inactive</Badge>
                          ) : (
                            <Badge variant={clientStatusVariant(client.status)}>
                              {client.status}
                            </Badge>
                          )}
                          <Badge variant="default">{formatFeePercent(client.client_percentage)} fee</Badge>
                        </div>
                      </div>
                      <div
                        className="mt-3 flex items-center justify-between gap-2 border-t border-white/[0.06] pt-3"
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-white/40">Portal</span>
                          <PortalAccessSwitch
                            compact
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
                              ? "Mark this client inactive"
                              : "Mark this client active"
                          }
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleToggleStatus(client);
                          }}
                          className={cn(
                            "text-[11px] text-white/40 transition-colors hover:text-white/65",
                            statusBusy && "cursor-not-allowed opacity-50"
                          )}
                        >
                          {client.status === "active" ? "Mark inactive" : "Mark active"}
                        </button>
                      </div>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      <div className="hidden min-h-0 flex-1 lg:flex lg:w-[60%]">
        <div className="flex h-full w-full min-h-[480px] flex-col">
          {selectedClient && isLgDesktop ? (
            <ClientDetailPanel
              key={selectedClient.id}
              layout="desktop"
              client={selectedClient}
              onPortalAccessChange={handlePortalAccessChange}
              onClientUpdated={handleClientUpdated}
              onToggleStatus={(c) => void handleToggleStatus(c)}
              statusPending={statusPendingId === selectedClient.id}
            />
          ) : (
            <DetailEmptyState />
          )}
        </div>
      </div>

      <AnimatePresence>
        {showAddClient ? (
          <AddClientModal
            onClose={() => setShowAddClient(false)}
            onCreated={(client) => setClients((prev) => [client, ...prev])}
          />
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {selectedClient && !isLgDesktop ? (
          <ClientDetailPanel
            key={`mobile-${selectedClient.id}`}
            layout="mobile"
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
